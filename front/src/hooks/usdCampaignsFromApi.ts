import { useState, useEffect } from "react";

export const useCampaignsFromApi = () => {
  const [campaignAddresses, setCampaignAddresses] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const base = import.meta.env.VITE_BACKEND_URL || "";
        const res = await fetch(`${base}/api/campaigns`);
        const data = await res.json();
        // предполагаем, что data — массив объектов с campaignAddress
        setCampaignAddresses(data.map((c: any) => c.campaignAddress));
      } catch (e: any) {
        setError(e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return { campaignAddresses, isLoading, error, refetch: () => window.location.reload() };
};
