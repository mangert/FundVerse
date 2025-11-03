// useCampaigns.ts
import { useState, useEffect } from "react";
import { fetchCampaigns, type CampaignData } from "../services/CampaingsService";

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = async () => {
    try {
      const newData = await fetchCampaigns();
      console.log("Refeching use Campaigns");

      // сравниваем только id (или address)
      const same =
        newData.length === campaigns.length &&
        newData.every((c, i) => c.address === campaigns[i]?.address);

      if (!same) {
        console.log("Campaign list changed, updating state");
        setCampaigns(newData);
      } else {
        console.log("No change in campaigns, skip update");
      }
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);  

  return { campaigns, isLoading, error, refetch };
}