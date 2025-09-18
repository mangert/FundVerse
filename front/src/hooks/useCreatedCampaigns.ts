// хук для получения списка кампаний, созданных пользователем
import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useCampaigns } from './useCampaigns';
import { getCampaignSummary } from '../services/campaignService';
import { type CampaignSummary } from './useCampaign';

export const useCreatedCampaigns = () => {
  const { campaignAddresses, isLoading: isLoadingAddresses, refetch: refetchAddresses } = useCampaigns();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [createdCampaigns, setCreatedCampaigns] = useState<{summary: CampaignSummary, address: string}[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const fetchCreatedCampaigns = useCallback(async () => {
    if (!address || !publicClient || campaignAddresses.length === 0) {
      setCreatedCampaigns([]);
      setIsLoadingDetails(false);
      return;
    }

    setIsLoadingDetails(true);
    try {
      // Получаем детали всех кампаний
      const allCampaigns = await Promise.all(
        campaignAddresses.map(address => getCampaignSummary(address, publicClient))
      );

      // Фильтруем только созданные текущим пользователем и сохраняем адреса
      const userCampaigns = allCampaigns
        .map((campaign, index) => ({ summary: campaign, address: campaignAddresses[index] }))
        .filter(item => 
          item.summary && item.summary.creator.toLowerCase() === address.toLowerCase()
        ) as {summary: CampaignSummary, address: string}[];

      setCreatedCampaigns(userCampaigns);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching created campaigns:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [campaignAddresses, address, publicClient]);

  useEffect(() => {
    fetchCreatedCampaigns();
  }, [fetchCreatedCampaigns, refreshCounter]);

  const refetch = useCallback(async () => {
    // Сначала обновляем список адресов кампаний
    await refetchAddresses();
    
    // Затем увеличиваем счетчик обновления, чтобы перезагрузить данные
    setRefreshCounter(prev => prev + 1);
  }, [refetchAddresses]);

  return {
    createdCampaigns,
    isLoading: isLoadingAddresses || isLoadingDetails,
    error,
    refetch
  };
};