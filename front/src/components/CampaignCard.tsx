//обновленная
import { useState } from 'react';
import { useCampaign } from '../hooks/useCampaign';
import { formatEther, formatUnits } from 'viem';
import { tokenService } from '../services/TokenService';
import { getStatusText, getStatusClass, type CampaignStatus } from '../types/Campaign';
import { getCampaignName } from '../utils/campaignMeta';
import { CampaignDetails } from './CampaignDetails';

interface CampaignCardProps {
  address: string;
  onUpdate?: () => void; // Добавляем новый пропс
}

export const CampaignCard = ({ address, onUpdate }: CampaignCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
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
  const decimals = tokenInfo?.decimals || 18;
  const statusText = getStatusText(summary.status as CampaignStatus);
  const statusClass = getStatusClass(summary.status as CampaignStatus);
  const campaignName = getCampaignName(summary.campaignMeta);

  const progress = Number(summary.raised) / Number(summary.goal) * 100;
  const daysLeft = Math.max(0, Math.ceil((summary.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
  const isDeadlineExpired = Date.now() > summary.deadline * 1000;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <h3>{campaignName}</h3> 
          <span className={`status-badge ${statusClass}`}>{statusText}
          {/* CHG: если Live и дедлайн прошёл, добавляем пометку */}
          {summary.status === 0 && isDeadlineExpired && (
            <span className="deadline-warning">(deadline passed)</span>
          )}
        </span>
        </div>
        
        <p>ID: #{summary.id.toString()} • By: {summary.creator.slice(0, 8)}...</p>
        <p><strong>Currency:</strong> {displaySymbol}</p>
        
        <div className="progress-bar">          
          <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>      
        
        <div className="campaign-stats">
          <div><strong>Raised:</strong> {formatUnits(summary.raised, decimals)} {displaySymbol}</div>
          <div><strong>Goal:</strong> {formatUnits(summary.goal, decimals)} {displaySymbol}</div>          
          <div><strong>Progress:</strong> {progress.toFixed(1)}%</div>
          <div><strong>Time left:</strong> {daysLeft} days</div>
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
          onClose={() => setShowDetails(false)}
          onUpdate={onUpdate} // Передаем callback обновления
        />
      )}
    </>
  );
};