import { useReadContract, useReadContracts } from 'wagmi';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { useMemo } from 'react';
import { useCampaign } from './useCampaign';

export const useCampaigns = () => {
  // Получаем общее количество кампаний
  const { data: totalCampaigns } = useReadContract({
    address: PLATFORM_ADDRESS,
    abi: PlatformABI,
    functionName: 'getTotalCampaigns',
  });

  // Создаем массив индексов [0, 1, 2, ..., total-1]
  const indices = useMemo(() => {
    if (!totalCampaigns) return [];
    return Array.from({ length: Number(totalCampaigns) }, (_, i) => i);
  }, [totalCampaigns]);

  // Параллельно загружаем все адреса кампаний
  const { data: campaignsData, isLoading: isLoadingAddresses } = useReadContracts({
    contracts: indices.map(index => ({
      address: PLATFORM_ADDRESS,
      abi: PlatformABI,
      functionName: 'getCampaignByIndex',
      args: [index],
    })),
  });

  // Преобразуем данные в массив адресов
  const campaignAddresses = useMemo(() => {
    if (!campaignsData) return [];
    return campaignsData.map(item => item.result as string).filter(Boolean);
  }, [campaignsData]);

  // Для каждого адреса получаем сводку через useCampaign
  const campaigns = campaignAddresses.map(address => {
    const { data: summary } = useCampaign(address);
    return {
      address,
      summary,
      isLoading: !summary,
    };
  });

  const isLoading = isLoadingAddresses || campaigns.some(c => c.isLoading);

  return { campaigns, isLoading };
};