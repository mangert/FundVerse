import { useReadContract } from 'wagmi';
import { CampaignABI } from '../utils/abi';

export interface CampaignSummary {
  creator: string;
  id: number;
  token: string;
  goal: bigint;
  raised: bigint;
  deadline: number;
  campaignMeta: string;
  status: number;
}

export const useCampaign = (address: string) => {
  const { data, isLoading, error, refetch } = useReadContract({
    address: address as `0x${string}`,
    abi: CampaignABI,
    functionName: 'getSummary',
  });

  // Если данные загружаются или ошибка
  if (isLoading || error || !data) {
    return { 
      isLoading: true, 
      error, 
      data: null,
      refetch // Добавляем refetch даже при загрузке/ошибке
    };
  }

  // Парсим результат getSummary
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

  return {
    data: summary,
    isLoading: false,
    error: null,
    refetch // Добавляем refetch
  };
};