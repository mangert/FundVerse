import { useCampaign } from './useCampaign';
import { useCampaignFromGraph } from './useCampaignFromGraph';

export interface UnifiedCampaignData {
  id: string;
  campaignId: bigint;
  creator: string;
  goal: bigint;
  raised: bigint;
  deadline: bigint;
  token: string;
  campaignMeta: string;
  status: number;
  isFundsWithdrawn?: boolean;
  blockNumber?: bigint;
  blockTimestamp?: bigint;
  transactionHash?: string;
}

interface UseCampaignDataOptions {
  live?: boolean;
}

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

  // Формируем универсальные данные
  let unified: UnifiedCampaignData | null = null;

  if (live && chainData) {
    unified = {
      id: address,
      campaignId: chainData.id, // контракты не возвращают
      creator: chainData.creator,
      goal: chainData.goal,
      raised: chainData.raised,
      deadline: chainData.deadline,
      token: chainData.token,
      campaignMeta: chainData.campaignMeta,
      status: chainData.status,
      // поля, которых нет в контракте
      isFundsWithdrawn: undefined,
      blockNumber: undefined,
      blockTimestamp: undefined,
      transactionHash: undefined,
    };
  } else if (graphData) {
    unified = {
      id: graphData.address,
      campaignId: graphData.campaignId,
      creator: graphData.creator,
      goal: graphData.goal,
      raised: graphData.raised,
      deadline: graphData.deadline,
      token: graphData.token,
      campaignMeta: graphData.campaignMeta,
      status: graphData.status,
      isFundsWithdrawn: graphData.isFundsWithdrawn,
      blockNumber: graphData.blockNumber,
      blockTimestamp: graphData.blockTimestamp,
      transactionHash: graphData.transactionHash,
    };
  }

  const refetch = async () => {
    if (live) await refetchChain?.();
    else await refetchGraph?.();
  };

  return {
    data: unified,
    isLoading,
    error,
    refetch,
  };
};
