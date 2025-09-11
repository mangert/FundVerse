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
import { fundsService } from '../services/fudnsService';

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

  // CHG: теперь эти флаги вычисляем глобально (по цепочке), а не по текущему кошельку
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

  // formatting helper (unchanged)
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

  // ---------------------------------------------------------------------
  // CHG: Проверяем вывод средств глобально — читаем через сервис  // 
  // ---------------------------------------------------------------------
  useEffect(() => {
  const checkFundsWithdrawal = async (): Promise<void> => {
    if (!isSuccessful) {
      // если кампания не успешна — нет смысла проверять
      return;
    }

    try {
      const address = campaignAddress as `0x${string}`;
      const withdrawn = await fundsService.isFundsWithdrawn(address);
      setIsFundsWithdrawn(withdrawn);

      // fallback на локальное хранилище, если нужно
      if (!withdrawn && userAddress) {
        const localStorageKey = `withdrawn-${campaignAddress}-${userAddress}`;
        const locallyWithdrawn = localStorage.getItem(localStorageKey) === 'true';
        if (locallyWithdrawn) setIsFundsWithdrawn(true);
      }
      console.log('Funds withdrawn for', campaignAddress, ':', withdrawn); //отладочный - удалить
    } catch (error) {
      console.error('Error checking funds withdrawal via service:', error);
      if (userAddress) {
        const localStorageKey = `withdrawn-${campaignAddress}-${userAddress}`;
        const locallyWithdrawn = localStorage.getItem(localStorageKey) === 'true';
        setIsFundsWithdrawn(locallyWithdrawn);
      }
    }
  };
  
  checkFundsWithdrawal();
}, [campaignAddress, isSuccessful, userAddress]); // publicClient убран, так как больше не используется


  // ---------------------------------------------------------------------
  // CHG: Проверяем статус депозита глобально — НЕ зависит от userAddress
  // - читаем getCampaignDeposit (если есть)
  // - если deposit === 0, ищем FVDepositReturned для данной кампании (по campaign поле)
  // ---------------------------------------------------------------------
  useEffect(() => {
    const checkDepositStatus = async () => {
      if (!publicClient) {
        setIsCheckingDeposit(false);
        return;
      }

      try {
        setDebugInfo(`Calling getCampaignDeposit for ${campaignAddress} on platform ${PLATFORM_ADDRESS}`);

        // проверим наличие функции в ABI
        const hasDepositFunction = PlatformABI.some(
          (item: any) => item.type === 'function' && item.name === 'getCampaignDeposit'
        );

        let deposit = 0n;
        if (hasDepositFunction) {
          try {
            deposit = await publicClient.readContract({
              address: PLATFORM_ADDRESS,
              abi: PlatformABI,
              functionName: 'getCampaignDeposit',
              args: [campaignAddress as `0x${string}`]
            }) as bigint;
          } catch (err) {
            console.warn('readContract getCampaignDeposit failed:', err);
            deposit = 0n;
          }
        } else {
          // если геттера нет — считаем deposit = 0 (и будем полагаться на события)
          deposit = 0n;
        }

        setDepositAmount(deposit);
        setDebugInfo(`Deposit result: ${deposit.toString()}`);

        if (deposit === 0n) {
          setDebugInfo('Deposit is zero — checking FVDepositReturned events for this campaign');

          try {
            const currentBlock = await publicClient.getBlockNumber();
            const _fromBlock = currentBlock > 20000n ? currentBlock - 20000n : 0n;

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

            // CHG: ищем событие по campaign (глобально), не фильтруя по текущему пользователю
            const hasDepositReturned = depositEvents.some(event =>
              !!event.args?.campaign && (String(event.args.campaign).toLowerCase() === campaignAddress.toLowerCase())
            );

            setIsDepositReturned(hasDepositReturned);

            if (!hasDepositReturned) {
              setDebugInfo('No FVDepositReturned event found for this campaign');
            } else {
              setDebugInfo('Deposit returned (found FVDepositReturned event)');
            }
          } catch (err) {
            console.warn('Failed to fetch FVDepositReturned events:', err);
            setDebugInfo('Error while checking FVDepositReturned events');
            setIsDepositReturned(false);
          }
        } else {
          // deposit > 0 => очевидно не возвращён
          setIsDepositReturned(false);
          setDebugInfo(`Deposit available: ${formatUnits(deposit, 18)} ETH`);
        }
      } catch (error) {
        console.error('Error checking deposit status:', error);
        setDebugInfo('Error while checking deposit status');

        // fallback по локальному хранилищу — если нужно
        if (userAddress) {
          const localStorageKey = `deposit-returned-${campaignAddress}-${userAddress}`;
          const locallyReturned = localStorage.getItem(localStorageKey) === 'true';
          setIsDepositReturned(locallyReturned);
        }
      } finally {
        setIsCheckingDeposit(false);
      }
    };

    checkDepositStatus();
  }, [publicClient, campaignAddress]); // CHG: убрали зависимость от userAddress, делаем глобально

  // ---------------------------------------------------------------------
  // Управление статусами — восстановлена логика Stop/Cancel/Resume как была
  // CHG: убрал некорректный блок для Status.Failed (Mark as Failed) — это делается через checkDeadlineStatus
  // ---------------------------------------------------------------------
  const getAvailableActions = () => {
    const actions: { label: string; status: number; action: string }[] = [];
    const currentStatus = campaign.status as CampaignStatus;

    if (currentStatus === 0) { // Live
      if (!isDeadlineExpired && !isGoalReached) {
        actions.push({ label: 'Stop', status: 1, action: 'stopping' }); // Stopped
        actions.push({ label: 'Cancel', status: 2, action: 'cancelling' }); // Cancelled
      }
    } else if (currentStatus === 1) { // Stopped
      if (!isDeadlineExpired && !isGoalReached) {
        actions.push({ label: 'Resume', status: 0, action: 'resuming' }); // Live
      }
    }
    // CHG: больше не добавляем Mark as Failed здесь

    return actions;
  };

  // ------------------ Handlers (write) ------------------
  const handleStatusChange = async (newStatus: CampaignStatus, actionName: string) => {
    if (!userAddress || !walletClient) {
      addNotification({ type: 'error', message: 'Please connect your wallet to manage campaigns', isGlobal: false });
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

      addNotification({ type: 'info', message: 'Transaction sent! Waiting for confirmation...', isGlobal: false, transactionHash: hash });

      // FIX: приводим тип hash к `0x${string}` для viem/wagmi wait
      const receipt = await publicClient?.waitForTransactionReceipt({ hash: hash as `0x${string}` });
      
      if (receipt?.status === 'success') {
        addNotification({ type: 'success', message: 'Campaign status updated successfully!', isGlobal: false });

        // Ждём, чтобы индексы/логи успели обновиться
        await new Promise(resolve => setTimeout(resolve, 2000));

        if (onUpdate) await onUpdate();
      } else {
        addNotification({ type: 'error', message: 'Transaction failed', isGlobal: false });
      }
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      addNotification({ type: decodedError.type as any, message: decodedError.message, isGlobal: false });
    } finally {
      setIsLoading(false);
      setCurrentAction(null);
    }
  };

  const handleWithdrawFunds = async () => {
    if (!userAddress || !walletClient) {
      addNotification({ type: 'error', message: 'Please connect your wallet to withdraw funds', isGlobal: false });
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

      addNotification({ type: 'info', message: 'Withdrawal transaction sent! Waiting for confirmation...', isGlobal: false, transactionHash: hash });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      if (receipt?.status === 'success') {
        addNotification({ type: 'success', message: 'Funds withdrawn successfully! Wallet balance will update shortly.', isGlobal: false });

        // CHG: обновляем глобальный флаг — funds withdrawn (по creator)
        setIsFundsWithdrawn(true);

        // сохраняем локально на всякий случай (fallback)
        if (userAddress) {
          const localStorageKey = `withdrawn-${campaignAddress}-${userAddress}`;
          localStorage.setItem(localStorageKey, 'true');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        if (onUpdate) await onUpdate();
      } else {
        addNotification({ type: 'error', message: 'Withdrawal transaction failed', isGlobal: false });
      }
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      // Если контракт говорит, что уже выведено — пометим так
      if (decodedError.message.includes('already withdrawn') || decodedError.message.includes('CampaignTwiceWithdraw')) {
        setIsFundsWithdrawn(true);
        if (userAddress) {
          const localStorageKey = `withdrawn-${campaignAddress}-${userAddress}`;
          localStorage.setItem(localStorageKey, 'true');
        }
      }
      addNotification({ type: decodedError.type as any, message: decodedError.message, isGlobal: false });
    } finally {
      setIsLoading(false);
      setCurrentAction(null);
    }
  };

  const handleReturnDeposit = async () => {
    if (!userAddress || !walletClient) {
      addNotification({ type: 'error', message: 'Please connect your wallet to return deposit', isGlobal: false });
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

      addNotification({ type: 'info', message: 'Deposit return transaction sent! Waiting for confirmation...', isGlobal: false, transactionHash: hash });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      if (receipt?.status === 'success') {
        addNotification({ type: 'success', message: 'Deposit returned successfully!', isGlobal: false });

        // CHG: обновляем global flag
        setIsDepositReturned(true);
        if (userAddress) {
          const localStorageKey = `deposit-returned-${campaignAddress}-${userAddress}`;
          localStorage.setItem(localStorageKey, 'true');
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
        if (onUpdate) await onUpdate();
      } else {
        addNotification({ type: 'error', message: 'Deposit return transaction failed', isGlobal: false });
      }
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      if (decodedError.message.includes('already returned') || decodedError.message.includes('FVZeroWithdrawnAmount')) {
        setIsDepositReturned(true);
        if (userAddress) {
          const localStorageKey = `deposit-returned-${campaignAddress}-${userAddress}`;
          localStorage.setItem(localStorageKey, 'true');
        }
      }
      addNotification({ type: decodedError.type as any, message: decodedError.message, isGlobal: false });
    } finally {
      setIsLoading(false);
      setCurrentAction(null);
    }
  };

  // CHG: Новая отдельная кнопка для дедлайна — вызывает checkDeadlineStatus()
  const handleCheckDeadlineStatus = async () => {
    if (!userAddress || !walletClient) {
      addNotification({ type: 'error', message: 'Please connect your wallet to perform this action', isGlobal: false });
      return;
    }

    setIsLoading(true);
    setCurrentAction('checking-deadline');

    try {
      const hash = await walletClient.writeContract({
        address: campaignAddress as `0x${string}`,
        abi: CampaignABI,
        functionName: 'checkDeadlineStatus',
        args: []
      });

      addNotification({ type: 'info', message: 'Checking deadline status on-chain...', isGlobal: false, transactionHash: hash });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      if (receipt?.status === 'success') {
        addNotification({ type: 'success', message: 'Deadline check executed', isGlobal: false });
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (onUpdate) await onUpdate();
      } else {
        addNotification({ type: 'error', message: 'Deadline check transaction failed', isGlobal: false });
      }
    } catch (err) {
      const decodedError = errorService.decodeContractError(err);
      addNotification({ type: decodedError.type as any, message: decodedError.message, isGlobal: false });
    } finally {
      setIsLoading(false);
      setCurrentAction(null);
    }
  };

  const availableActions = getAvailableActions();

  // CHG: Условие для возврата депозита — показываем только если депозит есть, он не возвращён и кампания finished
  const canReturnDeposit = !isDepositReturned && depositAmount > 0n && (isCancelled || isFailed || isSuccessful);

  // CHG: Withdraw доступен только создателю и если ещё не выведены фонды
  const isCreator = !!(campaign.creator && userAddress && campaign.creator.toLowerCase() === userAddress.toLowerCase());
  const canWithdrawFunds = isSuccessful && !isFundsWithdrawn && isCreator;

  return (
    <div className="account-campaign-card">
      <div className="account-campaign-header">
        <h4>{campaignName}</h4>
        <span className={`status-badge ${statusClass}`}>
          {statusText}
          {/* CHG: если Live и дедлайн прошёл, добавляем пометку */}
          {campaign.status === 0 && isDeadlineExpired && (
            <span className="deadline-warning">(deadline passed)</span>
          )}
        </span>
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
      ) : ( (campaign.status === 0 || campaign.status === 1) && isDeadlineExpired ) ? (
        // CHG: для Live/Stopped с прошедшим дедлайном показываем кнопку проверки дедлайна
        <div className="account-campaign-actions">
          <button className="btn btn-warning" onClick={handleCheckDeadlineStatus}>
            Check Deadline Status
          </button>
        </div>
      ) : (!isFundsWithdrawn && canWithdrawFunds) ? (
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