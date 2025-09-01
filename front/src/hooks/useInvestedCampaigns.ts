import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useCampaigns } from './useCampaigns';
import { getCampaignSummary } from '../services/campaignService';
import { CampaignABI } from '../utils/abi';
import type { CampaignSummary } from './useCampaign';

export interface InvestedCampaign {
  campaign: CampaignSummary;
  contribution: bigint;
}

export const useInvestedCampaigns = () => {
  const { campaignAddresses, isLoading: isLoadingAddresses, refetch: refetchAddresses } = useCampaigns();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [investedCampaigns, setInvestedCampaigns] = useState<InvestedCampaign[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchInvestedCampaigns = async () => {
      if (!address || !publicClient || campaignAddresses.length === 0) {
        setInvestedCampaigns([]);
        return;
      }

      setIsLoadingDetails(true);
      try {
        const results = await Promise.all(
          campaignAddresses.map(async (campaignAddress) => {
            try {
              // Получаем детали кампании
              const campaign = await getCampaignSummary(campaignAddress, publicClient);
              if (!campaign) return null;

              // Получаем взнос пользователя
              const contribution = await publicClient.readContract({
                address: campaignAddress as `0x${string}`,
                abi: CampaignABI,
                functionName: 'getContribution',
                args: [address as `0x${string}`],
              }) as bigint;

              return { campaign, contribution };
            } catch (err) {
              console.error(`Error fetching campaign ${campaignAddress}:`, err);
              return null;
            }
          })
        );

        // Фильтруем кампании с ненулевым взносом
        const invested = results.filter(result => 
          result !== null && result.contribution > 0n
        ) as InvestedCampaign[];

        setInvestedCampaigns(invested);
      } catch (err) {
        setError(err as Error);
        console.error('Error fetching invested campaigns:', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };

    fetchInvestedCampaigns();
  }, [campaignAddresses, address, publicClient]);

  const refetch = async () => {
    await refetchAddresses();
  };

  return {
    investedCampaigns,
    isLoading: isLoadingAddresses || isLoadingDetails,
    error,
    refetch
  };
};