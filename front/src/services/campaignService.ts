// сервис получения данных о кампании (прокладка между хуком и компонентами)
import type { PublicClient } from 'viem';
import { CampaignABI } from '../utils/abi';
import type { CampaignSummary } from '../hooks/useCampaign';

export const getCampaignSummary = async (address: string, publicClient: PublicClient): Promise<CampaignSummary | null> => {
  try {
    console.log('Fetching summary for campaign:', address);
    
    const data = await publicClient.readContract({
        address: address as `0x${string}`,
        abi: CampaignABI,
        functionName: 'getSummary',
        args: []
    });

    console.log('Raw campaign data:', data);

    const [creator, id, token, goal, raised, deadline, campaignMeta, status] = data as [
      string, number, string, bigint, bigint, number, string, number
    ];

    const summary: CampaignSummary = {
      creator,
      id,
      token,
      goal,
      raised,
      deadline,
      campaignMeta,
      status,
    };

    console.log('Processed campaign summary:', summary);
    return summary;
  } catch (error) {
    console.error(`Failed to fetch campaign summary for ${address}:`, error);
    return null;
  }
};