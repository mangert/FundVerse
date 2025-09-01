import { useState } from 'react';
import { formatEther } from 'viem';
import { tokenService } from '../services/TokenService';
import { getStatusText, getStatusClass, type CampaignStatus } from '../types/Campaign';
import { getCampaignName } from '../utils/campaignMeta';
import type { CampaignSummary } from '../hooks/useCampaign';

interface AccountCampaignCardProps {
  campaign: CampaignSummary;
  showActions?: boolean;
  onAction?: () => void;
}

export const AccountCampaignCard = ({ campaign, showActions = false, onAction }: AccountCampaignCardProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const tokenInfo = tokenService.getTokenInfo(campaign.token);
  const displaySymbol = tokenInfo?.symbol || 'ETH';
  const statusText = getStatusText(campaign.status as CampaignStatus);
  const statusClass = getStatusClass(campaign.status as CampaignStatus);
  const campaignName = getCampaignName(campaign.campaignMeta);

  const progress = Number(campaign.raised) / Number(campaign.goal) * 100;
  const daysLeft = Math.max(0, Math.ceil((campaign.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));

  const handleAction = async () => {
    if (!onAction) return;
    
    setIsLoading(true);
    try {
      await onAction();
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="account-campaign-card">
      <div className="account-campaign-header">
        <h4>{campaignName}</h4>
        <span className={`status-badge ${statusClass}`}>{statusText}</span>
      </div>
      
      <div className="account-campaign-details">
        <div>ID: #{campaign.id.toString()}</div>
        <div>Currency: {displaySymbol}</div>
        <div>Goal: {formatEther(campaign.goal)} {displaySymbol}</div>
        <div>Raised: {formatEther(campaign.raised)} {displaySymbol}</div>
        <div>Progress: {progress.toFixed(1)}%</div>
        <div>Time left: {daysLeft} days</div>
      </div>

      {showActions && (
        <div className="account-campaign-actions">
          <button 
            className="btn btn-primary"
            onClick={handleAction}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Manage'}
          </button>
        </div>
      )}
    </div>
  );
};