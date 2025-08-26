import { useEffect } from 'react';
import { usePublicClient, useAccount } from 'wagmi';
import { decodeEventLog } from 'viem';
import { useNotifications } from '../contexts/NotificationContext';
import { CampaignABI } from '../utils/abi';

export const useCampaignEvents = (campaignAddress: string) => {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { addNotification } = useNotifications();

  useEffect(() => {
    if (!publicClient || !address) return;

    const unwatch = publicClient.watchContractEvent({
      address: campaignAddress as `0x${string}`,
      abi: CampaignABI,
      onLogs: (logs) => {
        logs.forEach((log) => {
          try {
            const decoded = decodeEventLog({
              abi: CampaignABI,
              data: log.data,
              topics: log.topics,
            }) as unknown as { eventName: string; args: any };

            // Обрабатываем события кампании
            if (decoded.eventName === 'CampaignContribution' && decoded.args.contributor === address) {
              addNotification({
                type: 'success',
                message: `✅ Contribution successful: ${decoded.args.amount} tokens`,
                isGlobal: false,
                account: address.toLowerCase(),
                transactionHash: log.transactionHash ? log.transactionHash : undefined
              });
            }
            // Добавьте обработчики для других событий кампании...

          } catch (error) {
            console.warn('Failed to decode campaign event:', error);
          }
        });
      },
    });

    return () => unwatch();
  }, [publicClient, address, campaignAddress, addNotification]);
};