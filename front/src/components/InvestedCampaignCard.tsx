import { useState } from 'react';
import { formatEther } from 'viem';
import { tokenService } from '../services/TokenService';
import { getStatusText, getStatusClass, type CampaignStatus } from '../types/Campaign';
import { getCampaignName } from '../utils/campaignMeta';
import type { InvestedCampaign } from '../hooks/useInvestedCampaigns';

interface InvestedCampaignCardProps {
  investedCampaign: InvestedCampaign;
  onAction?: () => void;
}

export const InvestedCampaignCard = ({ investedCampaign, onAction }: InvestedCampaignCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { campaign, contribution } = investedCampaign;

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

  const canClaimRefund = campaign.status === 2 || campaign.status === 3; // Cancelled or Failed
  const canContribute = campaign.status === 0; // Live

  return (
    <div className="invested-campaign-card">
      <div className="invested-campaign-header">
        <h4>{campaignName}</h4>
        <span className={`status-badge ${statusClass}`}>{statusText}</span>
      </div>
      
      <div className="invested-campaign-details">
        <div>ID: #{campaign.id.toString()}</div>
        <div>Currency: {displaySymbol}</div>
        <div>Your contribution: {formatEther(contribution)} {displaySymbol}</div>
        <div>Goal: {formatEther(campaign.goal)} {displaySymbol}</div>
        <div>Raised: {formatEther(campaign.raised)} {displaySymbol}</div>
        <div>Progress: {progress.toFixed(1)}%</div>
        <div>Time left: {daysLeft} days</div>
      </div>

      <div className="invested-campaign-actions">
        {canClaimRefund && (
          <button 
            className="btn btn-primary"
            onClick={handleAction}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Claim Refund'}
          </button>
        )}
        
        {canContribute && (
          <button 
            className="btn btn-secondary"
            onClick={handleAction}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : 'Contribute More'}
          </button>
        )}
      </div>
    </div>
  );
};