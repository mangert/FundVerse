import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useCampaigns } from './useCampaigns';
import { getCampaignSummary } from '../services/campaignService';
import type { CampaignSummary } from './useCampaign';

export const useCreatedCampaigns = () => {
  const { campaignAddresses, isLoading: isLoadingAddresses, refetch: refetchAddresses } = useCampaigns();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [createdCampaigns, setCreatedCampaigns] = useState<CampaignSummary[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCreatedCampaigns = async () => {
      if (!address || !publicClient || campaignAddresses.length === 0) {
        setCreatedCampaigns([]);
        return;
      }

      setIsLoadingDetails(true);
      try {
        // Получаем детали всех кампаний
        const allCampaigns = await Promise.all(
          campaignAddresses.map(address => getCampaignSummary(address, publicClient))
        );

        // Фильтруем только созданные текущим пользователем
        const userCampaigns = allCampaigns.filter(campaign => 
          campaign && campaign.creator.toLowerCase() === address.toLowerCase()
        ) as CampaignSummary[];

        setCreatedCampaigns(userCampaigns);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching created campaigns:', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchCreatedCampaigns();
  }, [campaignAddresses, address, publicClient]);

  const refetch = async () => {
    await refetchAddresses();
  };

  return {
    createdCampaigns,
    isLoading: isLoadingAddresses || isLoadingDetails,
    error,
    refetch
  };
};