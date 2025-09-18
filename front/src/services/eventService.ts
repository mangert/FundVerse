// сервис получения данных о создаваемых кампаниях
// прокладка между бэкендом и компонентами
import { parseAbiItem } from 'viem';
import { PLATFORM_ADDRESS } from '../utils/addresses';

// подключение к бэкенду
// Такое замороченное, чтобы можно было видеть и при использовании доменного имени
// и при подключении к приложению по прямому ip 
const INDEXER_API_BASE = window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/) 
  ? `http://${window.location.hostname}:3001/api`
  : '/api';

let isPolling = false;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
let lastProcessedBlock = 0n;
let notificationCallback: ((notification: any) => void) | null = null;
const processedEvents = new Set<string>(); // будем хранить txHash и txHash-logIndex
const MAX_BLOCK_RANGE = 100n; // максимальный диапазон (локально)
const PROVIDER_MAX_BLOCK_RANGE = 10n; // Alchemy limit 10 blocks per request
const POLL_INTERVAL = 30_000; // 30 сек
const BLOCK_HISTORY_WINDOW = 2000n; // если indexer недоступен — стартуем отсюда
const REQUEST_DELAY = 300; // ms

// Инициализация сервиса
export const initEventService = async (publicClient: any, callback: (notification: any) => void) => {
  if (isPolling || !publicClient) return;

  isPolling = true;
  notificationCallback = callback;

  try {
    console.log('Initializing event service...');

    // 1) Попробуем получить статус/историю от indexer, если указан
    if (INDEXER_API_BASE) {
      try {
        const statusRes = await fetch(`${INDEXER_API_BASE}/status`);
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          if (statusJson?.events?.lastProcessedBlock) {
            lastProcessedBlock = BigInt(statusJson.events.lastProcessedBlock);
            console.log('Loaded lastProcessedBlock from indexer:', lastProcessedBlock.toString());
          }
        }

        // Загрузим historical campaigns (чтобы пометить их как обработанные и не уведомлять)
        const campaignsRes = await fetch(`${INDEXER_API_BASE}/campaigns`);
        if (campaignsRes.ok) {
          const campaigns = await campaignsRes.json();
          if (Array.isArray(campaigns)) {
            console.log(`Loaded ${campaigns.length} historical campaigns from indexer`);
            for (const c of campaigns) {
              // indexer сохраняет поле txHash; используем его для дедупликации
              if (c?.txHash) {
                processedEvents.add(c.txHash);
              }
              // если indexer хранит logIndex, можно добавить processedEvents.add(`${c.txHash}-${c.logIndex}`);
            }
          }
        }
      } catch (err) {
        console.warn('Indexer fetch failed — will fallback to local history scan:', err);
      }
    }

    // 2) Если indexer не дал lastProcessedBlock, берём current - BLOCK_HISTORY_WINDOW
    if (!lastProcessedBlock || lastProcessedBlock === 0n) {
      const currentBlock = await publicClient.getBlockNumber();
      lastProcessedBlock = currentBlock > BLOCK_HISTORY_WINDOW ? currentBlock - BLOCK_HISTORY_WINDOW : 0n;
      console.log('No indexer info — starting from block:', lastProcessedBlock.toString());
    }

    // 3) Сразу делаем один цикл опроса, затем запускаем интервал
    await pollEvents(publicClient);
    pollingInterval = setInterval(() => pollEvents(publicClient), POLL_INTERVAL);

    console.log('Event service initialized. Polling for new campaign events.');

  } catch (error) {
    console.error('Failed to initialize event service:', error);
    isPolling = false;
  }
};

// Основная функция опроса (ищет только новые события с lastProcessedBlock+1 до текущего)
const pollEvents = async (publicClient: any) => {
  try {
    if (!publicClient || !notificationCallback) return;

    const currentBlock = await publicClient.getBlockNumber();

    if (currentBlock <= lastProcessedBlock) {
      // нет новых блоков
      return;
    }

    // ограничим общий диапазон (например, если долго не запускали)
    let toBlock = currentBlock;
    if (currentBlock - lastProcessedBlock > MAX_BLOCK_RANGE) {
      toBlock = lastProcessedBlock + MAX_BLOCK_RANGE;
      console.log(`Limiting block range to ${MAX_BLOCK_RANGE} blocks (${lastProcessedBlock + 1n}..${toBlock})`);
    }

    console.log(`Polling events from ${lastProcessedBlock + 1n} to ${toBlock}`);

    let fromBlock = lastProcessedBlock + 1n;
    const allLogs: any[] = [];

    while (fromBlock <= toBlock) {
      const chunkToBlock = fromBlock + PROVIDER_MAX_BLOCK_RANGE - 1n > toBlock ? toBlock : fromBlock + PROVIDER_MAX_BLOCK_RANGE - 1n;
      const blockRange = chunkToBlock - fromBlock + 1n;
      if (blockRange > PROVIDER_MAX_BLOCK_RANGE) {
        console.warn('Chunk > PROVIDER_MAX_BLOCK_RANGE, skipping adjust (should not happen)');
        break;
      }

      console.log(`Fetching chunk ${fromBlock}..${chunkToBlock} (${blockRange} blocks)`);

      try {
        const logs = await publicClient.getLogs({
          address: PLATFORM_ADDRESS,
          event: {
            type: 'event',
            name: 'FVCampaignCreated',
            inputs: [
              { type: 'address', indexed: true, name: 'NewCampaignAddress' },
              { type: 'address', indexed: true, name: 'founder' },
              { type: 'address', indexed: true, name: 'token' },
              { type: 'uint256', name: 'goal' }
            ]
          },
          fromBlock,
          toBlock: chunkToBlock
        });

        if (Array.isArray(logs) && logs.length) {
          console.log(`Chunk has ${logs.length} logs`);
          allLogs.push(...logs);
        }

        // короткая пауза между запросами
        await new Promise(r => setTimeout(r, REQUEST_DELAY));
      } catch (err: any) {
        console.error(`Error fetching logs ${fromBlock}-${chunkToBlock}:`, err?.message || err);
        // при rate limit подождём и попробуем следующий chunk
        await new Promise(r => setTimeout(r, 2000));
      }

      fromBlock = chunkToBlock + 1n;
    }

    console.log(`Total new logs found: ${allLogs.length}`);

    // Обрабатываем новые логи — но не шлём нотификации для тех, что уже отмечены из indexer
    for (const log of allLogs) {
      try {
        if (!log.transactionHash) continue;
        const txHash = log.transactionHash as string;
        const logIndex = (log.logIndex !== undefined && log.logIndex !== null) ? String(log.logIndex) : '0';
        const eventId = `${txHash}-${logIndex}`;

        // Если обработан txHash из indexer или конкретный лог — пропускаем
        if (processedEvents.has(txHash) || processedEvents.has(eventId)) {
          // пометим также конкретный eventId, чтобы дальнейшие проверки были надёжны
          processedEvents.add(eventId);
          continue;
        }

        // Отмечаем как обработанное (и по txHash и по eventId)
        processedEvents.add(txHash);
        processedEvents.add(eventId);

        console.log('New campaign event detected:', eventId, 'tx:', txHash);

        // вызываем callback для уведомлений/обновлений UI
        notificationCallback({
          type: 'success',
          message: `💎 New campaign created!`,
          isGlobal: true,
          transactionHash: txHash
        });

      } catch (err) {
        console.warn('Failed to process log entry:', err);
      }
    }

    // Обновляем последний обработанный блок
    lastProcessedBlock = toBlock;
    console.log(`Finished processing up to block ${toBlock}`);

  } catch (err) {
    console.error('Error in pollEvents:', err);
    // в случае фатальной ошибки — сдвигаем lastProcessedBlock к текущему, чтобы не зацикливаться
    try {
      if (publicClient) {
        const currentBlock = await publicClient.getBlockNumber();
        lastProcessedBlock = currentBlock;
        console.log('Recovered by moving lastProcessedBlock to current:', currentBlock.toString());
      }
    } catch (e) {
      console.error('Recovery failed:', e);
    }
  }
};

// Остановка сервиса
export const stopEventService = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  isPolling = false;
  notificationCallback = null;
  console.log('Event service stopped');
};

// Очистка processed events (для переиндексации на клиенте)
export const clearProcessedEvents = () => {
  processedEvents.clear();
  console.log('Cleared processed events');
};
