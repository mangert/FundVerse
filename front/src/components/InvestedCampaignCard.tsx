import { useState } from 'react';
import { formatEther } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { tokenService } from '../services/TokenService';
import { getStatusText, getStatusClass, type CampaignStatus } from '../types/Campaign';
import { getCampaignName } from '../utils/campaignMeta';
import type { InvestedCampaign } from '../hooks/useInvestedCampaigns';
import { CampaignABI } from '../utils/abi';
import { errorService } from '../services/ErrorService';
import { useNotifications } from '../contexts/NotificationContext';

interface InvestedCampaignCardProps {
  investedCampaign: InvestedCampaign;
  onUpdate?: () => void;
}

export const InvestedCampaignCard = ({ investedCampaign, onUpdate }: InvestedCampaignCardProps) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { addNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [isRefundClaimed, setIsRefundClaimed] = useState(false);

  const { campaign, contribution, address: campaignAddress } = investedCampaign;

  const tokenInfo = tokenService.getTokenInfo(campaign.token);
  const displaySymbol = tokenInfo?.symbol || 'ETH';
  const statusText = getStatusText(campaign.status as CampaignStatus);
  const statusClass = getStatusClass(campaign.status as CampaignStatus);
  const campaignName = getCampaignName(campaign.campaignMeta);

  const progress = Number(campaign.raised) / Number(campaign.goal) * 100;
  const daysLeft = Math.max(0, Math.ceil((campaign.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
  const isDeadlineExpired = Date.now() > campaign.deadline * 1000;
  const isGoalReached = Number(campaign.raised) >= Number(campaign.goal);

  const canClaimRefund = (campaign.status === 2 || campaign.status === 3) && !isRefundClaimed; // Cancelled or Failed
  const canContribute = campaign.status === 0; // Live

  const handleClaimRefund = async () => {
    if (!address || !walletClient) {
      addNotification({
        type: 'error',
        message: 'Please connect your wallet to claim refund',
        isGlobal: false
      });
      return;
    }

    setIsLoading(true);
    setCurrentAction('claiming-refund');
    
    try {
      const hash = await walletClient.writeContract({
        address: campaignAddress as `0x${string}`,
        abi: CampaignABI,
        functionName: 'claimContribution',
        args: []
      });

      addNotification({
        type: 'info',
        message: 'Refund transaction sent! Waiting for confirmation...',
        isGlobal: false,
        transactionHash: hash
      });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      
      if (receipt?.status === 'success') {
        addNotification({
          type: 'success',
          message: 'Refund claimed successfully!',
          isGlobal: false
        });
        
        // Помечаем, что возврат был выполнен
        setIsRefundClaimed(true);
        
        // Ждем немного, чтобы блокчейн успел обновиться
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Принудительно обновляем данные
        if (onUpdate) {
          await onUpdate();
        }
      } else {
        addNotification({
          type: 'error',
          message: 'Refund transaction failed',
          isGlobal: false
        });
      }
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      addNotification({
        type: decodedError.type as any,
        message: decodedError.message,
        isGlobal: false
      });
    } finally {
      setIsLoading(false);
      setCurrentAction(null);
    }
  };

  const handleContributeMore = () => {
    // TODO: Implement contribute more functionality
    addNotification({
      type: 'info',
      message: 'Contribute more functionality will be implemented soon',
      isGlobal: false
    });
  };

  return (
    <div className="invested-campaign-card">
      <div className="invested-campaign-header">
        <h4>{campaignName}</h4>
        <span className={`status-badge ${statusClass}`}>{statusText}</span>
      </div>
      
      <div className="invested-campaign-details">
        <div>ID: #{campaign.id.toString()}</div>
        <div>Address: {campaignAddress.slice(0, 8)}...{campaignAddress.slice(-6)}</div>
        <div>Currency: {displaySymbol}</div>
        <div>Your contribution: {formatEther(contribution)} {displaySymbol}</div>
        <div>Goal: {formatEther(campaign.goal)} {displaySymbol}</div>
        <div>Raised: {formatEther(campaign.raised)} {displaySymbol}</div>
        <div>Progress: {progress.toFixed(1)}%</div>
        <div>Time left: {daysLeft} days</div>
        <div>Deadline: {new Date(campaign.deadline * 1000).toLocaleDateString()}</div>
      </div>

      {isLoading ? (
        <div className="invested-campaign-loading">
          <div className="loading-spinner"></div>
          <p>Processing {currentAction}...</p>
        </div>
      ) : isRefundClaimed ? (
        <div className="refund-success-message">
          <p>✅ Refund successfully claimed!</p>
          <p>Your contribution of {formatEther(contribution)} {displaySymbol} has been returned to your wallet.</p>
        </div>
      ) : (
        <div className="invested-campaign-actions">
          {canClaimRefund && (
            <button 
              className="btn btn-primary"
              onClick={handleClaimRefund}
              disabled={isLoading}
            >
              Claim Refund
            </button>
          )}
          
          {canContribute && (
            <button 
              className="btn btn-secondary"
              onClick={handleContributeMore}
              disabled={isLoading}
            >
              Contribute More
            </button>
          )}
        </div>
      )}
    </div>
  );
};