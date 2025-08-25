import { useEffect, useRef } from 'react';
import { usePublicClient } from 'wagmi';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { decodeEventLog } from 'viem';

// Типы для событий
export interface CampaignCreatedEvent {
  NewCampaignAddress: string;
  founder: string;
  token: string;
  goal: bigint;
}

export interface PlatformEventCallbacks {
  onCampaignCreated?: (event: CampaignCreatedEvent) => void;
  onError?: (error: Error) => void;
}

export const usePlatformEvents = (callbacks: PlatformEventCallbacks) => {
  const publicClient = usePublicClient();
  const callbackRef = useRef(callbacks);
  const handledTransactions = useRef(new Set<string>());

  useEffect(() => {
    callbackRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!publicClient) return;

    let isMounted = true;

    const unwatch = publicClient.watchContractEvent({
      address: PLATFORM_ADDRESS,
      abi: PlatformABI,
      eventName: 'FVCampaignCreated',
      onLogs: (logs) => {
        if (!isMounted) return;

        // Очищаем Set если стал слишком большим
        if (handledTransactions.current.size > 1000) {
          const recentTransactions = Array.from(handledTransactions.current)
            .slice(-100);
          handledTransactions.current = new Set(recentTransactions);
        }

        logs.forEach((log) => {
          try {
            // Проверяем что transactionHash существует и это строка
            if (typeof log.transactionHash !== 'string') return;
            
            if (handledTransactions.current.has(log.transactionHash)) return;
            handledTransactions.current.add(log.transactionHash);

            const decoded = decodeEventLog({
              abi: PlatformABI,
              data: log.data,
              topics: log.topics,
            }) as unknown as { args: any };

            if (decoded.args?.NewCampaignAddress) {
              callbackRef.current.onCampaignCreated?.({
                NewCampaignAddress: decoded.args.NewCampaignAddress,
                founder: decoded.args.founder,
                token: decoded.args.token || '0x0',
                goal: decoded.args.goal
              });
            }
          } catch (error) {
            console.warn('Failed to decode event:', error);
            callbackRef.current.onError?.(error as Error);
          }
        });
      },
    });

    return () => {
      isMounted = false;
      unwatch();
    };
  }, [publicClient]);
};