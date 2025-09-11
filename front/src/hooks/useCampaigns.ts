import { useReadContract, useReadContracts } from 'wagmi';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { useMemo, useCallback } from 'react';

interface UseCampaignsOptions {
  latestFirst?: boolean; // CHG: добавлен флаг для переворота списка
}

export const useCampaigns = ({ latestFirst = true }: UseCampaignsOptions = {}) => {
  // Получаем общее количество кампаний
  const { 
    data: totalCampaigns, 
    refetch: refetchTotal,
    isLoading: isLoadingTotal 
  } = useReadContract({
    address: PLATFORM_ADDRESS,
    abi: PlatformABI,
    functionName: 'getTotalCampaigns',
  });

  // Создаем массив индексов
  const indices = useMemo(() => {
    if (!totalCampaigns) return [];
    return Array.from({ length: Number(totalCampaigns) }, (_, i) => i);
  }, [totalCampaigns]);

  // Загружаем адреса кампаний
  const { 
    data: campaignsData, 
    isLoading: isLoadingAddresses, 
    refetch: refetchAddresses 
  } = useReadContracts({
    contracts: indices.map(index => ({
      address: PLATFORM_ADDRESS,
      abi: PlatformABI,
      functionName: 'getCampaignByIndex',
      args: [index],
    })),
    query: {
      enabled: indices.length > 0,
      staleTime: 10000, // 10 секунд кэширования
    }
  });

  // Преобразуем данные в массив адресов
  const campaignAddresses = useMemo(() => {
    if (!campaignsData) return [];
    const addresses = campaignsData
      .map(item => item.status === 'success' ? item.result as string : null)
      .filter(Boolean) as string[];

    // CHG: переворачиваем массив, если latestFirst = true
    return latestFirst ? addresses.slice().reverse() : addresses;
  }, [campaignsData, latestFirst]);

  // Функция для полного обновления
  const refetch = useCallback(async () => {    
    await Promise.all([refetchTotal(), refetchAddresses()]);
  }, [refetchTotal, refetchAddresses]);

  const isLoading = isLoadingTotal || isLoadingAddresses;

  return { 
    campaignAddresses, 
    isLoading,
    refetch 
  };
};