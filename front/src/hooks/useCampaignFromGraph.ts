import { useEffect, useState, useCallback } from 'react';
import { fetchCampaignByAddress, type CampaignData } from '../services/CampaignsService';

export const useCampaignFromGraph = (address: string) => {
  const [data, setData] = useState<CampaignData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!address) return;
    try {
      setIsLoading(true);
      const campaign = await fetchCampaignByAddress(address);
      setData(campaign);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    isLoading,
    error,
    refetch: load,
  };
};