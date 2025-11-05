import { useCampaign } from './useCampaign';
import { useCampaignFromGraph } from './useCampaignFromGraph';
import type { CampaignData } from '../services/CampaignsService';
import type { CampaignSummary } from './useCampaign';

interface UseCampaignDataOptions {
  live?: boolean;
}

/**
 * Универсальный хук, который решает:
 * - брать ли данные из Graph (summary)
 * - или из контракта (полные данные)
 */
export const useCampaignData = (address: string, options: UseCampaignDataOptions = {}) => {
  const { live = false } = options;

  const {
    data: graphData,
    isLoading: graphLoading,
    error: graphError,
    refetch: refetchGraph,
  } = useCampaignFromGraph(address);

  const {
    data: chainData,
    isLoading: chainLoading,
    error: chainError,
    refetch: refetchChain,
  } = useCampaign(address);

  const isLoading = live ? chainLoading : graphLoading;
  const error = live ? chainError : graphError;
  const data: CampaignSummary | CampaignData | null = live ? chainData : graphData;

  const refetch = async () => {
    if (live) await refetchChain?.();
    else await refetchGraph?.();
  };

  return {
    data,
    isLoading,
    error,
    refetch,
  };
};