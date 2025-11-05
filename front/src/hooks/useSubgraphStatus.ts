import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";

const SUBGRAPH_URL = import.meta.env.VITE_GRAPHQL_API_URL ||
      "https://api.studio.thegraph.com/query/121375/fund-verse/v0.0.1";

export function useSubgraphStatus(pollInterval = 15000) {
  const publicClient = usePublicClient();
  const [status, setStatus] = useState({
    isUpToDate: true,
    latestIndexedBlock: 0,
    currentBlock: 0,
    lag: 0,
  });

  useEffect(() => {
    if (!publicClient) return;

    const fetchStatus = async () => {
      try {
        const query = `
          {
            _meta {
              block {
                number
              }
            }
          }
        `;
        const res = await fetch(SUBGRAPH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const json = await res.json();
        const latestIndexedBlock = json.data?._meta?.block?.number ?? 0;

        const currentBlock = await publicClient.getBlockNumber();
        const lag = Number(currentBlock) - Number(latestIndexedBlock);

        setStatus({
          isUpToDate: lag <= 3,
          latestIndexedBlock,
          currentBlock: Number(currentBlock),
          lag,
        });
      } catch (err) {
        console.error("Failed to fetch subgraph status:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [publicClient, pollInterval]);

  return status;
}
