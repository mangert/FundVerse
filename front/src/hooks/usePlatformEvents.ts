import { useEffect, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { decodeEventLog } from 'viem';
import { useNotifications } from '../contexts/NotificationContext';

export const usePlatformEvents = (onCampaignCreated?: (event: any) => void) => {
  const publicClient = usePublicClient();
  const { addNotification } = useNotifications();
  const lastProcessedBlock = useRef<bigint>(0n);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!publicClient) return;

    // Инициализация - получаем текущий блок и начинаем опрос
    const initPolling = async () => {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        lastProcessedBlock.current = currentBlock;
        
        // Начинаем опрос с интервалом в 5 секунд
        pollingInterval.current = setInterval(pollNewEvents, 5000);
      } catch (error) {
        console.error('Error initializing event polling:', error);
      }
    };

    const pollNewEvents = async () => {
      try {
        if (!publicClient) return;

        // Получаем текущий блок
        const currentBlock = await publicClient.getBlockNumber();
        
        // Если нет новых блоков, выходим
        if (currentBlock <= lastProcessedBlock.current) {
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
          fromBlock: lastProcessedBlock.current + 1n,
          toBlock: currentBlock
        });

        // Обрабатываем каждое найденное событие
        for (const log of logs) {
          try {
            const decoded = decodeEventLog({
              abi: PlatformABI,
              data: log.data,
              topics: log.topics,
            }) as unknown as { args: any };

            if (decoded.args?.NewCampaignAddress) {
              const eventData = {
                NewCampaignAddress: decoded.args.NewCampaignAddress,
                founder: decoded.args.founder,
                token: decoded.args.token || '0x0',
                goal: decoded.args.goal
              };

              console.log('Processing new campaign event from block:', log.blockNumber, eventData);
              
              // Вызываем callback если передан
              onCampaignCreated?.(eventData);
              
              // Добавляем уведомление
              addNotification({
                type: 'success',
                message: `🎉 New campaign created: ${eventData.NewCampaignAddress.slice(0, 8)}...`,
                isGlobal: true,
                transactionHash: log.transactionHash
              });
            }
          } catch (error) {
            console.warn('Failed to decode event:', error);
          }
        }

        // Обновляем последний обработанный блок
        lastProcessedBlock.current = currentBlock;

      } catch (error) {
        console.error('Error polling events:', error);
      }
    };

    initPolling();

    // Очистка при размонтировании
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [publicClient, addNotification, onCampaignCreated]);
};