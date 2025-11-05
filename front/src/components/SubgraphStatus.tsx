import { useSubgraphStatus } from "../hooks/useSubgraphStatus";

export const SubgraphStatus = () => {
  const { isUpToDate, lag, latestIndexedBlock, currentBlock } = useSubgraphStatus();

  return (
    <div className="subgraph-status">
      {isUpToDate ? (
        <span className="status-ok">
          ✅ Subgraph up to date (block {latestIndexedBlock})
        </span>
      ) : (
        <span className="status-lagging">
          🕓 Indexing… {lag} blocks behind (latest {latestIndexedBlock} / network {currentBlock})
        </span>
      )}
    </div>
  );
};
