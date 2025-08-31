import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { useCampaign } from '../hooks/useCampaign';
import { formatEther, parseEther, zeroAddress } from 'viem';
import { tokenService } from '../services/TokenService';
import { errorService } from '../services/ErrorService';
import { useNotifications } from '../contexts/NotificationContext';
import { getStatusText, getStatusClass, type CampaignStatus } from '../types/Campaign';
import { getCampaignName, getCampaignDescription, parseCampaignMeta } from '../utils/campaignMeta';
import { CampaignABI } from '../utils/abi';

interface CampaignDetailsProps {
  address: string;
  onClose: () => void;
  onUpdate?: () => void; // Добавляем новый пропс для обновления данных
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

  // Загрузка дополнительных данных
  useEffect(() => {
    const loadAdditionalData = async () => {
      if (!summary || !userAddress || !publicClient) return;

      try {
        // Загрузка взноса пользователя
        const contribution = await publicClient.readContract({
          address: address as `0x${string}`,
          abi: CampaignABI,
          functionName: 'getContribution',
          args: [userAddress as `0x${string}`]
        }) as bigint;
        
        setUserContribution(contribution);

        // Загрузка баланса пользователя
        if (summary.token === zeroAddress) {
          // Нативная валюта
          const balance = await publicClient.getBalance({ 
            address: userAddress as `0x${string}` 
          });
          setUserBalance(balance);
        } else {
          // ERC20 токен
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
    
    const amount = parseEther(contributionAmount);
    if (amount <= 0n) {
      addNotification({
        type: 'error',
        message: 'Please enter a valid amount',
        isGlobal: false
      });
      return;
    }

    setIsContributing(true);
    
    try {
      const campaignAddress = address as `0x${string}`;
      
      if (summary.token === zeroAddress) {
        // Взнос нативной валютой
        const hash = await walletClient.writeContract({
            address: campaignAddress,
            abi: CampaignABI,
            functionName: 'contribute',
            value: amount,
            args: []
        });
        
        addNotification({
          type: 'info',
          message: 'Contribution sent! Waiting for confirmation...',
          isGlobal: false,
          transactionHash: hash
        });
        
        await publicClient?.waitForTransactionReceipt({ hash });
      } else {
        // Взнос ERC20 токеном
        const tokenAddress = summary.token as `0x${string}`;
        
        // Сначала проверяем allowance
        if (tokenAllowance < amount) {
          // Нужно approve
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
        
        // Теперь вносим средства
        const contributeHash = await walletClient.writeContract({
          address: campaignAddress,
          abi: CampaignABI,
          functionName: 'contribute',
          args: [amount]
        });
        
        addNotification({
          type: 'info',
          message: 'Contribution sent! Waiting for confirmation...',
          isGlobal: false,
          transactionHash: contributeHash
        });
        
        await publicClient?.waitForTransactionReceipt({ hash: contributeHash });
      }
      
      // Обновляем данные кампании
      await refetchCampaign();
      
      // Показываем уведомление об успехе
      addNotification({
        type: 'success',
        message: `Successfully contributed ${contributionAmount} ${tokenService.getTokenInfo(summary.token)?.symbol || 'ETH'}`,
        isGlobal: false
      });
      
      setContributionAmount('');
      
      // Обновляем родительский компонент
      if (onUpdate) {
        onUpdate();
      }
      
      // Закрываем модальное окно
      onClose();
      
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      addNotification({
        type: decodedError.type as any,
        message: decodedError.message,
        isGlobal: false
      });
    } finally {
      setIsContributing(false);
    }
  };

  const handleMaxContribution = () => {
    if (!summary) return;
    
    const remainingGoal = Number(summary.goal) - Number(summary.raised);
    const maxFromGoal = remainingGoal > 0 ? remainingGoal : 0;
    const maxFromBalance = Number(userBalance);
    
    const maxAmount = Math.min(maxFromGoal, maxFromBalance);
    setContributionAmount(formatEther(BigInt(maxAmount)));
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

  const tokenInfo = tokenService.getTokenInfo(summary.token);
  const displaySymbol = tokenInfo?.symbol || 'ETH';
  const statusText = getStatusText(summary.status as CampaignStatus);
  const statusClass = getStatusClass(summary.status as CampaignStatus);
  const campaignName = getCampaignName(summary.campaignMeta);
  const campaignDesc = getCampaignDescription(summary.campaignMeta);
  const campaignMetaData = parseCampaignMeta(summary.campaignMeta);

  const progress = Number(summary.raised) / Number(summary.goal) * 100;
  const daysLeft = Math.max(0, Math.ceil((summary.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
  const isLive = summary.status === 0; // Status.Live
  const isFailed = summary.status === 3; // Status.Failed
  const isCancelled = summary.status === 2; // Status.Cancelled
  const canContribute = isLive && isConnected;
  const canClaimRefund = (isFailed || isCancelled) && userContribution > 0n;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content campaign-details" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{campaignName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="campaign-status">
            <span className={`status-badge ${statusClass}`}>{statusText}</span>
            {daysLeft > 0 && <span className="days-left">{daysLeft} days left</span>}
          </div>

          {campaignDesc && (
            <div className="campaign-description">
              <p>{campaignDesc}</p>
            </div>
          )}

          <div className="campaign-info-grid">
            <div className="info-item">
              <label>Creator</label>
              <span>{summary.creator.slice(0, 8)}...{summary.creator.slice(-6)}</span>
            </div>
            <div className="info-item">
              <label>Currency</label>
              <span>{displaySymbol}</span>
            </div>
            <div className="info-item">
              <label>Goal</label>
              <span>{formatEther(summary.goal)} {displaySymbol}</span>
            </div>
            <div className="info-item">
              <label>Raised</label>
              <span>{formatEther(summary.raised)} {displaySymbol}</span>
            </div>
            <div className="info-item">
              <label>Progress</label>
              <span>{progress.toFixed(1)}%</span>
            </div>
            <div className="info-item">
              <label>Deadline</label>
              <span>{new Date(summary.deadline * 1000).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="progress-bar">
            <div style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>

          {/* Блок взноса для Live кампаний */}
          {canContribute && (
            <div className="contribution-section">
              <h3>Make a Contribution</h3>
              <div className="contribution-form">
                <div className="form-group">
                  <label htmlFor="contributionAmount">Amount ({displaySymbol})</label>
                  <div className="input-with-button">
                    <input
                      type="number"
                      id="contributionAmount"
                      value={contributionAmount}
                      onChange={(e) => setContributionAmount(e.target.value)}
                      placeholder={`Enter amount in ${displaySymbol}`}
                      min="0"
                      step="0.001"
                      disabled={isContributing}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleMaxContribution}
                      disabled={isContributing}
                    >
                      Max
                    </button>
                  </div>
                  <div className="balance-info">
                    Your balance: {formatEther(userBalance)} {displaySymbol}
                    {summary.token !== zeroAddress && tokenAllowance > 0n && (
                      <span> • Allowance: {formatEther(tokenAllowance)} {displaySymbol}</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleContribute}
                  disabled={isContributing || !contributionAmount || parseFloat(contributionAmount) <= 0}
                >
                  {isContributing ? 'Contributing...' : 'Contribute'}
                </button>
              </div>
            </div>
          )}

          {/* Блок возврата средств для Failed/Cancelled кампаний */}
          {canClaimRefund && (
            <div className="refund-section">
              <h3>Your Contribution</h3>
              <p>You contributed: {formatEther(userContribution)} {displaySymbol}</p>
              <button
                type="button"
                className="btn btn-primary"
                // TODO: Implement claim refund functionality
                onClick={() => {}}
              >
                Claim Refund
              </button>
            </div>
          )}

          {/* Дополнительная информация */}
          {campaignMetaData.info && (
            <div className="additional-info">
              <h3>Additional Information</h3>
              <a
                href={campaignMetaData.info}
                target="_blank"
                rel="noopener noreferrer"
                className="external-link"
              >
                View campaign documentation
              </a>
            </div>
          )}

          {/* Для создателя кампании - управляющие кнопки */}
          {userAddress === summary.creator && (
            <div className="creator-actions">
              <h3>Creator Actions</h3>
              <div className="action-buttons">
                {/* TODO: Implement creator actions */}
                <button className="btn btn-secondary">Withdraw Funds</button>
                <button className="btn btn-secondary">Change Status</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};