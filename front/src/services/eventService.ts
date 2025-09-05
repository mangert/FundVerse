import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';

let isPolling = false;
let pollingInterval: NodeJS.Timeout | null = null;
let lastProcessedBlock = 0n;
let notificationCallback: ((notification: any) => void) | null = null;
const processedEvents = new Set<string>();
const MAX_BLOCK_RANGE = 100n; // Максимальный диапазон блоков за один опрос
const PROVIDER_MAX_BLOCK_RANGE = 10n; // Ограничение Alchemy - 10 блоков за запрос
const POLL_INTERVAL = 30000; // 30 секунд между опросами
const BLOCK_HISTORY_WINDOW = 2000n; // Окно истории блоков
const REQUEST_DELAY = 300; // Задержка между запросами в мс

// Инициализация сервиса
export const initEventService = async (publicClient: any, callback: (notification: any) => void) => {
  if (isPolling || !publicClient) return;

  isPolling = true;
  notificationCallback = callback;
  
  try {
    // Получаем текущий блок
    const currentBlock = await publicClient.getBlockNumber();
    
    // Определяем начальный блок для опроса
    lastProcessedBlock = currentBlock > BLOCK_HISTORY_WINDOW 
      ? currentBlock - BLOCK_HISTORY_WINDOW
      : 0n;
    
    console.log('Initializing event service for Alchemy (10 block limit)...');
    console.log('Starting from block:', lastProcessedBlock.toString());
    console.log('Current block:', currentBlock.toString());

    // Запускаем опрос сразу и затем с интервалом
    await pollEvents(publicClient);
    pollingInterval = setInterval(() => pollEvents(publicClient), POLL_INTERVAL);

  } catch (error) {
    console.error('Failed to initialize event service:', error);
    isPolling = false;
  }
};

// Функция для опроса новых событий
const pollEvents = async (publicClient: any) => {
  try {
    if (!publicClient || !notificationCallback) return;

    // Получаем текущий блок
    const currentBlock = await publicClient.getBlockNumber();
    
    // Если нет новых блоков, выходим
    if (currentBlock <= lastProcessedBlock) {
      console.log('No new blocks since last poll');
      return;
    }

    // Ограничиваем диапазон блоков для запроса
    let toBlock = currentBlock;
    if (currentBlock - lastProcessedBlock > MAX_BLOCK_RANGE) {
      toBlock = lastProcessedBlock + MAX_BLOCK_RANGE;
      console.log(`Limiting block range to ${MAX_BLOCK_RANGE} blocks (${lastProcessedBlock + 1n}-${toBlock})`);
    }

    console.log(`Polling events from block ${lastProcessedBlock + 1n} to ${toBlock}`);

    // Пагинация для провайдеров с ограничением
    let fromBlock = lastProcessedBlock + 1n;
    let allLogs: any[] = [];

    while (fromBlock <= toBlock) {
      const chunkToBlock = fromBlock + PROVIDER_MAX_BLOCK_RANGE - 1n > toBlock 
        ? toBlock 
        : fromBlock + PROVIDER_MAX_BLOCK_RANGE - 1n;

      // Убедимся, что диапазон не превышает 10 блоков
      const blockRange = chunkToBlock - fromBlock + 1n;
      if (blockRange > 10n) {
        console.error('Block range exceeds 10 blocks, adjusting...');
        break;
      }

      console.log(`Fetching chunk: ${fromBlock} to ${chunkToBlock} (${blockRange} blocks)`);

      try {
        // Ищем события в новых блоках      
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
          fromBlock: fromBlock,
          toBlock: chunkToBlock
        });

        allLogs = allLogs.concat(logs);
        console.log(`Found ${logs.length} events in chunk`);

        // Добавляем задержку между запросами
        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));

      } catch (error) {
        console.error(`Error fetching blocks ${fromBlock}-${chunkToBlock}:`, error);
        
        // При ошибке пропускаем этот чанк и двигаемся дальше
        if (error instanceof Error && (error.message.includes('rate limit') || error.message.includes('429') || error.message.includes('10 block range'))) {
          console.log('Rate limit or block range exceeded, waiting before next request...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Ждем 2 секунды при лимите
        }
      }

      fromBlock = chunkToBlock + 1n;
    }

    console.log(`Found ${allLogs.length} new events in blocks ${lastProcessedBlock + 1n}-${toBlock}`);

    // Обрабатываем каждое найденное событие
    for (const log of allLogs) {
      try {
        if (!log.transactionHash || !log.logIndex) continue;

        const eventId = `${log.transactionHash}-${log.logIndex}`;
        
        // Если событие уже обрабатывали - пропускаем
        if (processedEvents.has(eventId)) {
          continue;
        }

        processedEvents.add(eventId);
        
        console.log('New campaign event:', eventId, log);
        
        notificationCallback({
          type: 'success',
          message: `💎 New campaign created!`,
          isGlobal: true,
          transactionHash: log.transactionHash
        });

      } catch (error) {
        console.warn('Failed to process event:', error);
      }
    }

    // Обновляем последний обработанный блок
    lastProcessedBlock = toBlock;
    console.log(`Finished processing events up to block ${toBlock}`);

  } catch (error) {
    console.error('Error polling events:', error);
    
    // В случае ошибки, пытаемся пропустить проблемный диапазон блоков
    if (publicClient) {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        lastProcessedBlock = currentBlock;
        console.log('Skipping problematic block range, moving to current block:', currentBlock.toString());
      } catch (e) {
        console.error('Failed to recover from error:', e);
      }
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
  console.log('Event service stopped');
};

// Очистка processed events
export const clearProcessedEvents = () => {
  processedEvents.clear();
  console.log('Cleared processed events');
};