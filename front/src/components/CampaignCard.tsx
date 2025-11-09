// компонент карточки кампаний на дашборде
import { useEffect, useState } from 'react';
import { useCampaignData } from '../hooks/useCampaignData';
import { formatUnits } from 'viem';
import { tokenService } from '../services/TokenService';
import { getStatusText, getStatusClass, type CampaignStatus } from '../types/Campaign';
import { getCampaignName } from '../utils/campaignMeta';
import { CampaignDetails } from './CampaignDetails';

interface CampaignCardProps {
  address: string;
  onUpdate?: () => void;
}

export const CampaignCard = ({ address, onUpdate }: CampaignCardProps) => {
  const { data: summary, isLoading, refetch } = useCampaignData(address);

  // 🔹 добавлено: локальное состояние для плавного отображения данных
  const [localSummary, setLocalSummary] = useState(summary);

  // 🔹 изменено: обновляем локальное состояние при изменении summary из хука
  useEffect(() => {
    if (summary) setLocalSummary(summary);
  }, [summary]);

  const [showDetails, setShowDetails] = useState(false);

  // 🔹 добавлено: периодический refetch без "мигания"
  useEffect(() => {
    const interval = setInterval(() => {
      refetch().catch(() => {
        /* таймауты или ошибки игнорируем для UI */
      });
    }, 10000); // каждые 10 секунд, можно подстроить
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading && !localSummary) { // 🔹 изменено: показываем спиннер только если нет данных
    return (
      <div className="card">
        <div>Loading campaign...</div>
      </div>
    );
  }

  if (!localSummary) {
    return (
      <div className="card">
        <div>Failed to load campaign</div>
      </div>
    );
  }

  const tokenInfo = tokenService.getTokenInfo(localSummary.token);
  const displaySymbol = tokenInfo?.symbol || 'ETH';
  const decimals = tokenInfo?.decimals || 18;
  const statusText = getStatusText(localSummary.status as CampaignStatus);
  const statusClass = getStatusClass(localSummary.status as CampaignStatus);
  const campaignName = getCampaignName(localSummary.campaignMeta);

  const progress = Number(localSummary.raised) / Number(localSummary.goal) * 100;
  const daysLeft = Math.max(
    0,
    Math.ceil(Number((localSummary.deadline * 1000n - BigInt(Date.now())) / (1000n * 60n * 60n * 24n))),
  );
  const isDeadlineExpired = Date.now() > localSummary.deadline * 1000n;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3>{campaignName}</h3>
          <span className={`status-badge ${statusClass}`}>
            {statusText}
            {localSummary.status === 0 && isDeadlineExpired && (
              <span className="deadline-warning">(deadline passed)</span>
            )}
          </span>
        </div>

        <p>ID: #{localSummary.campaignId.toString()} • By: {localSummary.creator.slice(0, 8)}...</p>
        <p><strong>Currency:</strong> {displaySymbol}</p>

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>

        <div className="campaign-stats">
          <div>
            <strong>Raised:</strong> {formatUnits(localSummary.raised, decimals)} {displaySymbol}
          </div>
          <div>
            <strong>Goal:</strong> {formatUnits(localSummary.goal, decimals)} {displaySymbol}
          </div>
          <div>
            <strong>Progress:</strong> {progress.toFixed(1)}%
          </div>
          <div>
            <strong>Time left:</strong> {daysLeft} days
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setShowDetails(true)}
        >
          View Campaign
        </button>
      </div>

      {showDetails && (
        <CampaignDetails
          address={address}
          onClose={() => {
            setShowDetails(false);
            // 🔹 изменено: убрали refetch из onClose, теперь карточка обновляется только по таймеру
            onUpdate?.();
          }}
        />
      )}
    </>
  );
};