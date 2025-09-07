import { useState, useEffect } from 'react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { tokenService } from '../services/TokenService';
import { getStatusText, getStatusClass, type CampaignStatus } from '../types/Campaign';
import { getCampaignName } from '../utils/campaignMeta';
import type { CampaignSummary } from '../hooks/useCampaign';
import { CampaignABI, PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { errorService } from '../services/ErrorService';
import { useNotifications } from '../contexts/NotificationContext';

interface AccountCampaignCardProps {
  campaign: CampaignSummary;
  campaignAddress: string;
  onUpdate?: () => void;
}

export const AccountCampaignCard = ({ campaign, campaignAddress, onUpdate }: AccountCampaignCardProps) => {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { addNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [isFundsWithdrawn, setIsFundsWithdrawn] = useState(false);
  const [isDepositReturned, setIsDepositReturned] = useState(false);
  const [depositAmount, setDepositAmount] = useState<bigint>(0n);
  const [isCheckingDeposit, setIsCheckingDeposit] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const tokenInfo = tokenService.getTokenInfo(campaign.token);
  const displaySymbol = tokenInfo?.symbol || 'ETH';
  const decimals = tokenInfo?.decimals || 18;
  const statusText = getStatusText(campaign.status as CampaignStatus);
  const statusClass = getStatusClass(campaign.status as CampaignStatus);
  const campaignName = getCampaignName(campaign.campaignMeta);

  // Функция для форматирования суммы с учетом decimals
  const formatTokenAmount = (value: bigint, maxDecimals: number = 4): string => {
    const amount = Number(formatUnits(value, decimals));
    if (amount >= 1000) {
      return amount.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
    }
    return amount.toFixed(maxDecimals);
  };

  const progress = Number(campaign.raised) / Number(campaign.goal) * 100;
  const daysLeft = Math.max(0, Math.ceil((campaign.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
  const isDeadlineExpired = Date.now() > campaign.deadline * 1000;
  const isGoalReached = Number(campaign.raised) >= Number(campaign.goal);
  const isSuccessful = campaign.status === 4; // Status.Successful
  const isCancelled = campaign.status === 2; // Status.Cancelled
  const isFailed = campaign.status === 3; // Status.Failed
  const isFinished = isSuccessful || isCancelled || isFailed;

  // Проверяем, были ли уже выведены средства через события
  useEffect(() => {
    const checkFundsWithdrawal = async () => {
      if (!publicClient || !isSuccessful || !userAddress) return;

      try {
        const currentBlock = await publicClient.getBlockNumber();
        const _fromBlock = currentBlock - 10000n;
        // Ищем события вывода средств для этой кампании и этого создателя
        const withdrawalEvents = await publicClient.getLogs({
          address: campaignAddress as `0x${string}`,
          event: {
            type: 'event',
            name: 'CampaignFundsClaimed',
            inputs: [
              { type: 'address', indexed: true, name: 'recipient' },
              { type: 'uint256', indexed: false, name: 'amount' }
            ]
          },
          fromBlock: _fromBlock,
          toBlock: 'latest'
        });

        // Проверяем, есть ли события для текущего создателя
        const hasWithdrawn = withdrawalEvents.some(event => 
          event.args.recipient?.toLowerCase() === userAddress.toLowerCase()
        );

        setIsFundsWithdrawn(hasWithdrawn);
      } catch (error) {
        console.error('Error checking funds withdrawal events:', error);
        
        // Fallback: проверяем через локальное хранилище
        const localStorageKey = `withdrawn-${campaignAddress}-${userAddress}`;
        const locallyWithdrawn = localStorage.getItem(localStorageKey) === 'true';
        setIsFundsWithdrawn(locallyWithdrawn);
      }
    };

    checkFundsWithdrawal();
  }, [publicClient, campaignAddress, isSuccessful, userAddress]);

  // Проверяем статус депозита
  useEffect(() => {
    const checkDepositStatus = async () => {
      if (!publicClient || !userAddress) {
        setIsCheckingDeposit(false);
        return;
      }

      try {
        // Добавим отладочную информацию о вызове
        setDebugInfo(`Calling getCampaignDeposit for ${campaignAddress} on platform ${PLATFORM_ADDRESS}`);
        
        // Проверим, что ABI содержит нужную функцию
        const hasDepositFunction = PlatformABI.some(
          (item: any) => item.type === 'function' && item.name === 'getCampaignDeposit'
        );
        
        if (!hasDepositFunction) {
          setDebugInfo('ERROR: getCampaignDeposit function not found in ABI');
          return;
        }
        
        // Проверяем текущий депозит через геттер
        const deposit = await publicClient.readContract({
          address: PLATFORM_ADDRESS,
          abi: PlatformABI,
          functionName: 'getCampaignDeposit',
          args: [campaignAddress as `0x${string}`]
        }) as bigint;

        setDepositAmount(deposit);
        setDebugInfo(`Deposit result: ${deposit.toString()}`);
        
        // Если депозит нулевой, проверяем события возврата
        if (deposit === 0n) {
          setDebugInfo('Checking deposit return events...');
          
          const currentBlock = await publicClient.getBlockNumber();
          const _fromBlock = currentBlock - 10000n;
          const depositEvents = await publicClient.getLogs({
            address: PLATFORM_ADDRESS,
            event: {
              type: 'event',
              name: 'FVDepositReturned',
              inputs: [
                { type: 'address', indexed: true, name: 'founder' },
                { type: 'uint256', indexed: false, name: 'amount' },
                { type: 'address', indexed: false, name: 'campaign' }
              ]
            },
            fromBlock: _fromBlock,
            toBlock: 'latest'
          });

          const hasDepositReturned = depositEvents.some(event => 
            event.args.founder?.toLowerCase() === userAddress.toLowerCase() &&
            event.args.campaign?.toLowerCase() === campaignAddress.toLowerCase()
          );

          if (hasDepositReturned) {
            setIsDepositReturned(true);
            setDebugInfo('Deposit returned (from events)');
          } else {
            setDebugInfo('Deposit is 0 but no return events found');
          }
        } else {
          setDebugInfo(`Deposit available: ${formatUnits(deposit, 18)} ETH`);
        }
      } catch (error) {
        console.error('Error checking deposit status:', error);
        
        // Безопасная обработка ошибки
        let errorMessage = 'Unknown error occurred';
        
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          // Пытаемся извлечь сообщение из объекта ошибки
          if ('message' in error) {
            errorMessage = String(error.message);
          } else if ('reason' in error) {
            errorMessage = String(error.reason);
          } else {
            errorMessage = JSON.stringify(error);
          }
        }
        
        setDebugInfo(`Error: ${errorMessage}`);
        
        // Fallback: проверяем через локальное хранилище
        const localStorageKey = `deposit-returned-${campaignAddress}-${userAddress}`;
        const locallyReturned = localStorage.getItem(localStorageKey) === 'true';
        setIsDepositReturned(locallyReturned);
      } finally {
        setIsCheckingDeposit(false);
      }
    };

    checkDepositStatus();
  }, [publicClient, campaignAddress, userAddress]);

  // Определяем доступные действия в зависимости от статуса кампании
  const getAvailableActions = () => {
    const actions = [];
    const currentStatus = campaign.status as CampaignStatus;

    // Live кампании можно остановить или отменить
    if (currentStatus === 0) { // Status.Live
      if (!isDeadlineExpired && !isGoalReached) {
        actions.push({ label: 'Stop', status: 1, action: 'stopping' }); // Status.Stopped
        actions.push({ label: 'Cancel', status: 2, action: 'cancelling' }); // Status.Cancelled
      }
    }
    // Stopped кампании можно возобновить
    else if (currentStatus === 1) { // Status.Stopped
      if (!isDeadlineExpired && !isGoalReached) {
        actions.push({ label: 'Resume', status: 0, action: 'resuming' }); // Status.Live
      }
    }
    // Failed кампании можно отметить как проваленные (если срок истек и цель не достигнута)
    else if (currentStatus === 3) { // Status.Failed
      if (isDeadlineExpired && !isGoalReached) {
        actions.push({ label: 'Mark as Failed', status: 3, action: 'marking-failed' }); // Status.Failed
      }
    }

    return actions;
  };

  const handleStatusChange = async (newStatus: CampaignStatus, actionName: string) => {
    if (!userAddress || !walletClient) {
      addNotification({
        type: 'error',
        message: 'Please connect your wallet to manage campaigns',
        isGlobal: false
      });
      return;
    }

    setIsLoading(true);
    setCurrentAction(actionName);
    
    try {
      const hash = await walletClient.writeContract({
        address: campaignAddress as `0x${string}`,
        abi: CampaignABI,
        functionName: 'setCampaignStatus',
        args: [newStatus]
      });

      addNotification({
        type: 'info',
        message: 'Transaction sent! Waiting for confirmation...',
        isGlobal: false,
        transactionHash: hash
      });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      
      if (receipt?.status === 'success') {
        addNotification({
          type: 'success',
          message: 'Campaign status updated successfully!',
          isGlobal: false
        });
        
        // Ждем немного, чтобы блокчейн успел обновиться
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Принудительно обновляем данные
        if (onUpdate) {
          await onUpdate();
        }
      } else {
        addNotification({
          type: 'error',
          message: 'Transaction failed',
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

  const handleWithdrawFunds = async () => {
    if (!userAddress || !walletClient) {
      addNotification({
        type: 'error',
        message: 'Please connect your wallet to withdraw funds',
        isGlobal: false
      });
      return;
    }

    setIsLoading(true);
    setCurrentAction('withdrawing');
    
    try {
      const hash = await walletClient.writeContract({
        address: campaignAddress as `0x${string}`,
        abi: CampaignABI,
        functionName: 'withdrawFunds',
        args: []
      });

      addNotification({
        type: 'info',
        message: 'Withdrawal transaction sent! Waiting for confirmation...',
        isGlobal: false,
        transactionHash: hash
      });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      
      if (receipt?.status === 'success') {
        addNotification({
          type: 'success',
          message: 'Funds withdrawn successfully! Wallet balance will update shortly.',
          isGlobal: false
        });
        
        // Обновляем статус вывода средств
        setIsFundsWithdrawn(true);
        
        // Сохраняем в локальное хранилище на случай, если запрос событий не сработает
        const localStorageKey = `withdrawn-${campaignAddress}-${userAddress}`;
        localStorage.setItem(localStorageKey, 'true');
        
        // Ждем немного, чтобы блокчейн успел обновиться
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Принудительно обновляем данные
        if (onUpdate) {
          await onUpdate();
        }
      } else {
        addNotification({
          type: 'error',
          message: 'Withdrawal transaction failed',
          isGlobal: false
        });
      }
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      
      // Если ошибка связана с повторным выводом средств, помечаем как уже выведенные
      if (decodedError.message.includes('already withdrawn') || 
          decodedError.message.includes('CampaignTwiceWithdraw')) {
        setIsFundsWithdrawn(true);
        const localStorageKey = `withdrawn-${campaignAddress}-${userAddress}`;
        localStorage.setItem(localStorageKey, 'true');
      }
      
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

  const handleReturnDeposit = async () => {
    if (!userAddress || !walletClient) {
      addNotification({
        type: 'error',
        message: 'Please connect your wallet to return deposit',
        isGlobal: false
      });
      return;
    }

    setIsLoading(true);
    setCurrentAction('returning-deposit');
    
    try {
      const hash = await walletClient.writeContract({
        address: PLATFORM_ADDRESS,
        abi: PlatformABI,
        functionName: 'returnDeposit',
        args: [campaignAddress as `0x${string}`]
      });

      addNotification({
        type: 'info',
        message: 'Deposit return transaction sent! Waiting for confirmation...',
        isGlobal: false,
        transactionHash: hash
      });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      
      if (receipt?.status === 'success') {
        addNotification({
          type: 'success',
          message: 'Deposit returned successfully!',
          isGlobal: false
        });
        
        // Обновляем статус возврата депозита
        setIsDepositReturned(true);
        
        // Сохраняем в локальное хранилище
        const localStorageKey = `deposit-returned-${campaignAddress}-${userAddress}`;
        localStorage.setItem(localStorageKey, 'true');
        
        // Ждем немного, чтобы блокчейн успел обновиться
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Принудительно обновляем данные
        if (onUpdate) {
          await onUpdate();
        }
      } else {
        addNotification({
          type: 'error',
          message: 'Deposit return transaction failed',
          isGlobal: false
        });
      }
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      
      // Если ошибка связана с повторным возвратом депозита, помечаем как уже возвращенный
      if (decodedError.message.includes('already returned') || 
          decodedError.message.includes('FVZeroWithdrawnAmount')) {
        setIsDepositReturned(true);
        const localStorageKey = `deposit-returned-${campaignAddress}-${userAddress}`;
        localStorage.setItem(localStorageKey, 'true');
      }
      
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

  const availableActions = getAvailableActions();
  
  // Упрощенное условие для возврата депозита
  const canReturnDeposit = !isDepositReturned && depositAmount > 0n && 
                          (isCancelled || isFailed || isSuccessful);

  return (
    <div className="account-campaign-card">
      <div className="account-campaign-header">
        <h4>{campaignName}</h4>
        <span className={`status-badge ${statusClass}`}>{statusText}</span>
      </div>
      
      <div className="account-campaign-details">
        <div>ID: #{campaign.id.toString()}</div>
        <div>Address: {campaignAddress.slice(0, 8)}...{campaignAddress.slice(-6)}</div>
        <div>Currency: {displaySymbol}</div>
        <div>Goal: {formatTokenAmount(campaign.goal)} {displaySymbol}</div>
        <div>Raised: {formatTokenAmount(campaign.raised)} {displaySymbol}</div>
        <div>Progress: {progress.toFixed(1)}%</div>
        <div>Time left: {daysLeft} days</div>
        <div>Deadline: {new Date(campaign.deadline * 1000).toLocaleDateString()}</div>
        {depositAmount > 0n && (
          <div>Deposit: {formatUnits(depositAmount, 18)} ETH</div>
        )}       
        
      </div>

      {isCheckingDeposit ? (
        <div className="account-campaign-loading">
          <div className="loading-spinner"></div>
          <p>Checking deposit status...</p>
        </div>
      ) : isLoading ? (
        <div className="account-campaign-loading">
          <div className="loading-spinner"></div>
          <p>Processing {currentAction}...</p>
        </div>
      ) : availableActions.length > 0 ? (
        <div className="account-campaign-actions">
          <h5>Manage Campaign:</h5>
          {availableActions.map((action) => (
            <button
              key={action.status}
              className="btn btn-primary"
              onClick={() => handleStatusChange(action.status as CampaignStatus, action.action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : isSuccessful && !isFundsWithdrawn ? (
        <div className="account-campaign-actions">
          <h5>Campaign Successful!</h5>
          <button
            className="btn btn-success"
            onClick={handleWithdrawFunds}
          >
            Withdraw Funds
          </button>
          <p className="withdraw-info">
            You can now withdraw the raised funds. Platform fee will be deducted automatically.
          </p>
        </div>
      ) : canReturnDeposit ? (
        <div className="account-campaign-actions">
          <h5>Campaign Finished</h5>
          <button
            className="btn btn-warning"
            onClick={handleReturnDeposit}
          >
            Return Deposit ({formatUnits(depositAmount, 18)} ETH)
          </button>
          <p className="deposit-info">
            You can now return your deposit of {formatUnits(depositAmount, 18)} ETH.
          </p>
        </div>
      ) : isFundsWithdrawn || isDepositReturned ? (
        <div className="no-actions-message">
          <p>All operations completed for this campaign.</p>
          {isFundsWithdrawn && <p>Funds have been successfully withdrawn.</p>}
          {isDepositReturned && <p>Deposit has been successfully returned.</p>}
        </div>
      ) : (
        <div className="no-actions-message">
          <p>No management actions available for this campaign status.</p>
        </div>
      )}
    </div>
  );
};