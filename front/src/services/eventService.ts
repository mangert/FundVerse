import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';

let isPolling = false;
let pollingInterval: NodeJS.Timeout | null = null;
let lastProcessedBlock = 0n;
let notificationCallback: ((notification: any) => void) | null = null;
const processedEvents = new Set<string>();

// Загружаем последний обработанный блок из localStorage
const loadLastBlock = (): bigint => {
  try {
    const stored = localStorage.getItem('last-processed-block');
    return stored ? BigInt(stored) : 0n;
  } catch {
    return 0n;
  }
};

// Сохраняем последний обработанный блок в localStorage
const saveLastBlock = (blockNumber: bigint) => {
  try {
    localStorage.setItem('last-processed-block', blockNumber.toString());
  } catch (error) {
    console.warn('Failed to save last block:', error);
  }
};

// Инициализация сервиса
export const initEventService = (publicClient: any, callback: (notification: any) => void) => {
  if (isPolling || !publicClient) return;

  isPolling = true;
  notificationCallback = callback;
  lastProcessedBlock = loadLastBlock();
  
  console.log('Initializing event service with getLogs polling...');
  console.log('Starting from block:', lastProcessedBlock.toString());

  // Функция для опроса новых событий
  const pollEvents = async () => {
    try {
      if (!publicClient) return;

      // Получаем текущий блок
      const currentBlock = await publicClient.getBlockNumber();
      
      // Если нет новых блоков, выходим
      if (currentBlock <= lastProcessedBlock) {
        return;
      }

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
        fromBlock: lastProcessedBlock > 0n ? lastProcessedBlock + 1n : 'earliest',
        toBlock: currentBlock
      });

      console.log(`Found ${logs.length} new events in blocks ${lastProcessedBlock + 1n}-${currentBlock}`);

      // Обрабатываем каждое найденное событие
      for (const log of logs) {
        try {
          if (!log.transactionHash || !log.logIndex) continue;

          const eventId = `${log.transactionHash}-${log.logIndex}`;
          
          // Если событие уже обрабатывали - пропускаем
          if (processedEvents.has(eventId)) {
            continue;
          }

          processedEvents.add(eventId);
          
          console.log('New campaign event:', eventId);
          
          notificationCallback?.({
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
      if (logs.length > 0) {
        lastProcessedBlock = currentBlock;
        saveLastBlock(lastProcessedBlock);
      }

    } catch (error) {
      console.error('Error polling events:', error);
    }
  };

  // Запускаем опрос сразу и затем каждые 5 секунд
  pollEvents();
  pollingInterval = setInterval(pollEvents, 5000);

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
  localStorage.removeItem('last-processed-block');
  console.log('Cleared processed events and block history');
};