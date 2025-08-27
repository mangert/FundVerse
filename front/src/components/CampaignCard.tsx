import { useCampaign } from '../hooks/useCampaign';
import { formatEther } from 'viem';
import { tokenService } from '../services/TokenService';
import { getStatusText, getStatusClass, type CampaignStatus } from '../types/Campaign';
import { getCampaignName } from '../utils/campaignMeta'; 

interface CampaignCardProps {
  address: string;
}

export const CampaignCard = ({ address }: CampaignCardProps) => {
  const { data: summary, isLoading } = useCampaign(address);

  if (isLoading) {
    return (
      <div className="card">
        <div>Loading campaign...</div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="card">
        <div>Failed to load campaign</div>
      </div>
    );
  }

  const tokenInfo = tokenService.getTokenInfo(summary.token);
  const displaySymbol = tokenInfo?.symbol || 'ETH';
  const statusText = getStatusText(summary.status as CampaignStatus);
  const statusClass = getStatusClass(summary.status as CampaignStatus);

  // Получаем название кампании
  const campaignName = getCampaignName(summary.campaignMeta);

  const progress = Number(summary.raised) / Number(summary.goal) * 100;
  const daysLeft = Math.max(0, Math.ceil((summary.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="card">
      <div className="card-header">
        <h3>{campaignName}</h3> 
        <span className={`status-badge ${statusClass}`}>{statusText}</span>
      </div>
      
      <p>ID: #{summary.id.toString()} • By: {summary.creator.slice(0, 8)}...</p> {/* ← ДОБАВЛЯЕМ ID */}
      <p><strong>Currency:</strong> {displaySymbol}</p>
      
      <div className="progress-bar">
        <div style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>      
      
      <div className="campaign-stats">
        <div><strong>Raised:</strong> {formatEther(summary.raised)} {displaySymbol}</div>
        <div><strong>Goal:</strong> {formatEther(summary.goal)} {displaySymbol}</div>
        <div><strong>Progress:</strong> {progress.toFixed(1)}%</div>
        <div><strong>Time left:</strong> {daysLeft} days</div>
      </div>

      <button className="btn btn-primary">
        View Campaign
      </button>
    </div>
  );
};