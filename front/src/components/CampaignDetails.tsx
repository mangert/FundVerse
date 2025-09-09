import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useCampaign } from '../hooks/useCampaign';
import { formatUnits, parseUnits, zeroAddress } from 'viem';
import { tokenService } from '../services/TokenService';
import { errorService } from '../services/ErrorService';
import { useNotifications } from '../contexts/NotificationContext';
import { getStatusText, getStatusClass, type CampaignStatus } from '../types/Campaign';
import { getCampaignName, getCampaignDescription, parseCampaignMeta } from '../utils/campaignMeta';
import { CampaignABI } from '../utils/abi';

interface CampaignDetailsProps {
  address: string;
  onClose: () => void;
  onUpdate?: () => void;
}

export const CampaignDetails = ({ address, onClose, onUpdate }: CampaignDetailsProps) => {
  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { addNotification } = useNotifications();
  
  const { data: summary, isLoading, refetch: refetchCampaign } = useCampaign(address);
  const [contributionAmount, setContributionAmount] = useState('');
  const [isContributing, setIsContributing] = useState(false);
  const [userContribution, setUserContribution] = useState<bigint>(0n);
  const [userBalance, setUserBalance] = useState<bigint>(0n);
  const [tokenAllowance, setTokenAllowance] = useState<bigint>(0n);
  const [copiedAddress, setCopiedAddress] = useState(false);

  const tokenInfo = summary ? tokenService.getTokenInfo(summary.token) : null;
  const displaySymbol = tokenInfo?.symbol || 'ETH';
  const decimals = tokenInfo?.decimals || 18;

  useEffect(() => {
    const loadAdditionalData = async () => {
      if (!summary || !userAddress || !publicClient) return;

      try {
        const contribution = await publicClient.readContract({
          address: address as `0x${string}`,
          abi: CampaignABI,
          functionName: 'getContribution',
          args: [userAddress as `0x${string}`]
        }) as bigint;
        
        setUserContribution(contribution);

        if (summary.token === zeroAddress) {
          const balance = await publicClient.getBalance({ address: userAddress as `0x${string}` });
          setUserBalance(balance);
        } else {
          const tokenAddress = summary.token as `0x${string}`;
          const [balance, allowance] = await Promise.all([
            publicClient.readContract({
              address: tokenAddress,
              abi: [{
                inputs: [{ name: 'account', type: 'address' }],
                name: 'balanceOf',
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
                type: 'function'
              }],
              functionName: 'balanceOf',
              args: [userAddress as `0x${string}`]
            }) as Promise<bigint>,
            
            publicClient.readContract({
              address: tokenAddress,
              abi: [{
                inputs: [
                  { name: 'owner', type: 'address' },
                  { name: 'spender', type: 'address' }
                ],
                name: 'allowance',
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
                type: 'function'
              }],
              functionName: 'allowance',
              args: [userAddress as `0x${string}`, address as `0x${string}`]
            }) as Promise<bigint>
          ]);
          
          setUserBalance(balance);
          setTokenAllowance(allowance);
        }
      } catch (error) {
        console.error('Failed to load additional data:', error);
      }
    };

    loadAdditionalData();
  }, [summary, userAddress, publicClient, address]);

  const handleContribute = async () => {
    if (!isConnected || !userAddress || !walletClient || !summary) return;
    
    const amount = parseUnits(contributionAmount, decimals);
    if (amount <= 0n) {
      addNotification({ type: 'error', message: 'Please enter a valid amount', isGlobal: false });
      return;
    }

    setIsContributing(true);
    
    try {
      const campaignAddress = address as `0x${string}`;
      
      if (summary.token === zeroAddress) {
        const hash = await walletClient.writeContract({
          address: campaignAddress,
          abi: CampaignABI,
          functionName: 'contribute',
          value: amount,
          args: []
        });
        
        addNotification({ type: 'info', message: 'Contribution sent! Waiting for confirmation...', isGlobal: false, transactionHash: hash });
        await publicClient?.waitForTransactionReceipt({ hash });
      } else {
        const tokenAddress = summary.token as `0x${string}`;
        
        if (tokenAllowance < amount) {
          const approveHash = await walletClient.writeContract({
            address: tokenAddress,
            abi: [{
              inputs: [
                { name: 'spender', type: 'address' },
                { name: 'amount', type: 'uint256' }
              ],
              name: 'approve',
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'nonpayable',
              type: 'function'
            }],
            functionName: 'approve',
            args: [campaignAddress, amount]
          });
          
          await publicClient?.waitForTransactionReceipt({ hash: approveHash });
          setTokenAllowance(amount);
        }
        
        const contributeHash = await walletClient.writeContract({
          address: campaignAddress,
          abi: CampaignABI,
          functionName: 'contribute',
          args: [amount]
        });
        
        addNotification({ type: 'info', message: 'Contribution sent! Waiting for confirmation...', isGlobal: false, transactionHash: contributeHash });
        await publicClient?.waitForTransactionReceipt({ hash: contributeHash });
      }
      
      await refetchCampaign();
      addNotification({ type: 'success', message: `Successfully contributed ${contributionAmount} ${displaySymbol}`, isGlobal: false });
      setContributionAmount('');
      if (onUpdate) onUpdate();
      onClose();
      
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      addNotification({ type: decodedError.type as any, message: decodedError.message, isGlobal: false });
    } finally {
      setIsContributing(false);
    }
  };

  const handleMaxContribution = () => {
    if (!summary) return;
    const remainingGoal = summary.goal - summary.raised;
    const maxFromGoal = remainingGoal > 0n ? remainingGoal : 0n;
    const maxFromBalance = userBalance;
    const maxAmount = maxFromGoal < maxFromBalance ? maxFromGoal : maxFromBalance;
    if (maxAmount <= 0n) {
      addNotification({ type: 'warning', message: 'Not enough funds to contribute', isGlobal: false });
      return;
    }
    setContributionAmount(formatUnits(maxAmount, decimals));
  };

  const copyAddressToClipboard = () => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
    addNotification({ type: 'info', message: 'Campaign address copied to clipboard', isGlobal: false });
  };

  const formatTokenAmount = (value: bigint, maxDecimals: number = 4): string => {
    const amount = Number(formatUnits(value, decimals));
    if (amount >= 1000) {
      return amount.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
    }
    return amount.toFixed(maxDecimals);
  };

  if (isLoading || !summary) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Campaign Details</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <div className="loading-message">
              <p>Loading campaign details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const statusText = getStatusText(summary.status as CampaignStatus);
  const statusClass = getStatusClass(summary.status as CampaignStatus);
  const campaignName = getCampaignName(summary.campaignMeta);
  const campaignDesc = getCampaignDescription(summary.campaignMeta);
  const campaignMetaData = parseCampaignMeta(summary.campaignMeta);

  const progress = Number(summary.raised) / Number(summary.goal) * 100;
  const daysLeft = Math.max(0, Math.ceil((summary.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
  const isLive = summary.status === 0;
  const isFailed = summary.status === 3;
  const isCancelled = summary.status === 2;
  const isDeadlinePassed = Date.now() >= summary.deadline * 1000;

  const canContribute = isLive && isConnected && !isDeadlinePassed;
  const canClaimRefund = (isFailed || isCancelled) && userContribution > 0n;
  const hasZeroBalance = userBalance === 0n;  

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content campaign-details" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="campaign-title-section">
            <h2>{campaignName}</h2>
            <div className="campaign-id">ID: #{summary.id.toString()}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="campaign-address-section">
            <div className="campaign-address-label">Campaign Address:</div>
            <div className="campaign-address-value">
              {address.slice(0, 8)}...{address.slice(-6)}
              <button className="copy-address-btn" onClick={copyAddressToClipboard} title="Copy campaign address">
                {copiedAddress ? '✓' : '📄'}
              </button>
            </div>
          </div>

          <div className="campaign-status-row">
            <span className={`status-badge large ${statusClass}`}>
              {statusText}
              {isDeadlinePassed && isLive && (
                <span className="deadline-warning"> (deadline passed)</span>
              )}
            </span>
            <div className="campaign-time-info">
              <div className="deadline-date">
                Deadline: {new Date(summary.deadline * 1000).toLocaleDateString()}
              </div>
              {daysLeft > 0 && (
                <div className="days-left">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</div>
              )}
            </div>
          </div>

          {campaignDesc && (
            <div className="campaign-description">
              <h3>Description</h3>
              <p>{campaignDesc}</p>
            </div>
          )}

          <div className="financial-section">
            <h3>Financial Information</h3>
            <div className="financial-grid">
              <div className="financial-item">
                <div className="financial-label">Currency</div>
                <div className="financial-value large">{displaySymbol}</div>
              </div>
              <div className="financial-item">
                <div className="financial-label">Funding Goal</div>
                <div className="financial-value large">
                  {formatTokenAmount(summary.goal)} {displaySymbol}
                </div>
              </div>
              <div className="financial-item">
                <div className="financial-label">Raised</div>
                <div className="financial-value large">
                  {formatTokenAmount(summary.raised)} {displaySymbol}
                </div>
              </div>
              <div className="financial-item">
                <div className="financial-label">Progress</div>
                <div className="financial-value large">{progress.toFixed(1)}%</div>
              </div>
            </div>

            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
              <div className="progress-labels">
                <span>0 {displaySymbol}</span>
                <span>{formatTokenAmount(summary.goal)} {displaySymbol}</span>
              </div>
            </div>
          </div>

          {/* Взносы только если Live и дедлайн не истёк */}
          {canContribute && (
            <div className="contribution-section compact">
              <div className="contribution-header">
                <h3>Make a Contribution</h3>
                <div className="balance-display">
                  Balance: {formatTokenAmount(userBalance)} {displaySymbol}
                </div>
              </div>
              
              {hasZeroBalance ? (
                <div className="zero-balance-message">
                  <p>You don't have any {displaySymbol} in your wallet to contribute.</p>
                </div>
              ) : (
                <div className="compact-contribution-form">
                  <div className="input-and-actions">
                    <div className="amount-input-group">
                      <input
                        type="number"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        placeholder={`Amount in ${displaySymbol}`}
                        min="0"
                        step="0.001"
                        disabled={isContributing}
                      />
                      <button
                        type="button"
                        className="max-btn compact"
                        onClick={handleMaxContribution}
                        disabled={isContributing}
                        title="Set maximum contribution amount"
                      >
                        Max
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary contribute-btn compact"
                      onClick={handleContribute}
                      disabled={isContributing || !contributionAmount || parseFloat(contributionAmount) <= 0}
                    >
                      {isContributing ? '...' : 'Contribute'}
                    </button>
                  </div>
                  {summary.token !== zeroAddress && tokenAllowance > 0n && (
                    <div className="allowance-info compact">
                      Allowance: {formatTokenAmount(tokenAllowance)} {displaySymbol}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Если Live, но дедлайн прошёл */}
          {isLive && isDeadlinePassed && (
            <div className="contribution-closed-message">
              <p>Contributions are closed. The campaign deadline has passed.</p>
            </div>
          )}
          
          {canClaimRefund && (
            <div className="refund-section">
              <h3>Your Contribution</h3>
              <p className="refund-amount">
                You contributed: {formatTokenAmount(userContribution)} {displaySymbol}
              </p>
              <div className="info-message">
                <p>To claim your refund, please visit your <strong>Account page</strong> → <strong>Invested Campaigns</strong> tab</p>
              </div>
            </div>
          )}
          
          {campaignMetaData.info && (
            <div className="additional-info">
              <h3>Additional Information</h3>
              <div className="external-link-container">
                <a href={campaignMetaData.info} target="_blank" rel="noopener noreferrer" className="external-link">
                  View campaign documentation ↗
                </a>
                <div className="external-link-disclaimer">
                  <small>
                    This is an external link. The platform is not responsible for its content.
                    Please verify the authenticity of the link before proceeding.
                  </small>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
