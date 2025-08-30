import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { parseEther, formatEther, zeroAddress } from 'viem';
import { tokenService } from '../services/TokenService';
import { errorService } from '../services/ErrorService';
import { useNotifications } from '../contexts/NotificationContext';
import type { NotificationType } from '../contexts/NotificationContext';
import type { CampaignMeta } from '../utils/campaignMeta';

interface CreateCampaignFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export const CreateCampaignForm = ({ onSuccess, onClose }: CreateCampaignFormProps) => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { addNotification } = useNotifications();
  
  const [formData, setFormData] = useState({
    goal: '',
    deadline: '',
    token: zeroAddress,
    campaignName: '',
    campaignDesc: '',
    campaignInfo: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [minDuration, setMinDuration] = useState(1);
  const [minDurationLoading, setMinDurationLoading] = useState(true);
  const [requiredDeposit, setRequiredDeposit] = useState<bigint>(parseEther('0.1'));
  const [depositLoading, setDepositLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [userTimelock, setUserTimelock] = useState<number>(0);
  const [timelockLoading, setTimelockLoading] = useState(true);

  // Загружаем минимальную длительность, требуемый депозит и таймлок пользователя
  useEffect(() => {
    const fetchPlatformSettings = async () => {
      if (!publicClient) return;
      
      try {
        // Загружаем минимальную длительность
        const minLifespan = await publicClient.readContract({
          address: PLATFORM_ADDRESS,
          abi: PlatformABI,
          functionName: 'getMinLifespan',
          args: []
        }) as bigint;
        
        const minDays = Math.ceil(Number(minLifespan) / (24 * 60 * 60));
        setMinDuration(minDays);

        // Загружаем требуемый депозит
        const deposit = await publicClient.readContract({
          address: PLATFORM_ADDRESS,
          abi: PlatformABI,
          functionName: 'getRequiredDeposit',
          args: []
        }) as bigint;
        
        setRequiredDeposit(deposit);

        // Загружаем таймлок пользователя, если кошелек подключен
        if (address) {
          const timelock = await publicClient.readContract({
            address: PLATFORM_ADDRESS,
            abi: PlatformABI,
            functionName: 'getFounderTimelock',
            args: [address]
          }) as bigint;
          
          setUserTimelock(Number(timelock));
        }
      } catch (error) {
        console.warn('Failed to fetch platform settings, using defaults:', error);
        setMinDuration(1);
        setRequiredDeposit(parseEther('0.1'));
        setUserTimelock(0);
      } finally {
        setMinDurationLoading(false);
        setDepositLoading(false);
        setTimelockLoading(false);
      }
    };

    if (isConnected) {
      fetchPlatformSettings();
    } else {
      setMinDurationLoading(false);
      setDepositLoading(false);
      setTimelockLoading(false);
    }
  }, [publicClient, isConnected, address]);

  // Проверяем, активен ли таймлок
  const isTimelockActive = () => {
    if (userTimelock === 0) return false;
    const currentTime = Math.floor(Date.now() / 1000);
    return userTimelock > currentTime;
  };

  // Форматируем оставшееся время таймлока
  const formatTimelockRemaining = () => {
    if (!isTimelockActive()) return '';
    
    const now = Math.floor(Date.now() / 1000);
    const remaining = userTimelock - now;
    
    if (remaining <= 0) return '';
    
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    
    return `${seconds}s`;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Проверка цели финансирования
    if (!formData.goal || parseFloat(formData.goal) <= 0) {
      newErrors.goal = 'Funding goal must be greater than zero';
    }

    // Проверка длительности
    const durationDays = Number(formData.deadline);
    if (!formData.deadline || durationDays < minDuration) {
      newErrors.deadline = `Campaign duration must be at least ${minDuration} days`;
    }

    // Проверка названия кампании
    if (!formData.campaignName.trim()) {
      newErrors.campaignName = 'Campaign name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !address || !walletClient) {
      addNotification({
        type: 'error',
        message: 'Please connect your wallet to create a campaign',
        isGlobal: false
      });
      return;
    }

    // Проверяем таймлок
    if (isTimelockActive()) {
      addNotification({
        type: 'error',
        message: 'You cannot create a campaign during the cooldown period',
        isGlobal: false
      });
      return;
    }

    // Валидация формы
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      const goal = parseEther(formData.goal);
      // Добавляем 60 секунд (1 минуту) к дедлайну для безопасности
      const deadline = Math.floor(Date.now() / 1000) + (Number(formData.deadline) * 24 * 60 * 60) + 60;

      // Создаем объект метаданных
      const campaignMeta: CampaignMeta = {
        name: formData.campaignName,
        desc: formData.campaignDesc,
        info: formData.campaignInfo
      };

      // Конвертируем в JSON строку
      const campaignMetaString = JSON.stringify(campaignMeta);

      const hash = await walletClient.writeContract({
        address: PLATFORM_ADDRESS,
        abi: PlatformABI,
        functionName: 'createCampaign',
        args: [goal, deadline, campaignMetaString, formData.token],
        value: requiredDeposit
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
          message: 'Campaign created successfully!',
          isGlobal: false,
          transactionHash: hash
        });
        setFormData({
          goal: '',
          deadline: '',
          token: zeroAddress,
          campaignName: '',
          campaignDesc: '',
          campaignInfo: ''
        });
        
        // Вызываем колбэк при успешном создании
        if (onSuccess) {
          onSuccess();
        }
      } else {
        addNotification({
          type: 'error',
          message: 'Transaction failed',
          isGlobal: false,
          transactionHash: hash
        });
      }

    } catch (err) {
      console.error('Full error in handleSubmit:', err);
      
      // Используем наш сервис для обработки ошибок
      const decodedError = errorService.decodeContractError(err);
      console.error('Decoded error:', decodedError);
      
      addNotification({
        type: decodedError.type as NotificationType,
        message: decodedError.message,
        isGlobal: false,
        persistent: decodedError.type === 'error',
        ...(decodedError.details && { details: decodedError.details })
      });
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Очищаем ошибку при изменении поля
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const activeTokens = tokenService.getActiveTokens();
  const nativeToken = tokenService.getNativeToken();
  const isFormDisabled = !isConnected || isLoading || depositLoading || timelockLoading || isTimelockActive();
  const erc20Tokens = activeTokens.filter(token => token.address !== zeroAddress);

  // Если таймлок активен, показываем сообщение вместо формы
  if (isTimelockActive()) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Create New Campaign</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            <div className="timelock-message">
              <h3>⏰ Campaign Creation Cooldown</h3>
              <p>
                You recently created a campaign. Please wait before creating another one.
                This helps prevent spam and ensures campaign quality.
              </p>
              <p>
                <strong>Time remaining: {formatTimelockRemaining()}</strong>
              </p>
              <p>
                You'll be able to create a new campaign after {new Date(userTimelock * 1000).toLocaleString()}.
              </p>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={onClose}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Обычная форма создания кампании
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Campaign</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {!isConnected && (
            <div className="warning-message">
              <p>⚠️ Wallet disconnected. Connect your wallet to submit the form.</p>
            </div>
          )}      
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="goal">Funding Goal ({nativeToken.symbol}):</label>
              <input
                type="number"
                id="goal"
                name="goal"
                value={formData.goal}
                onChange={handleChange}
                placeholder={`Enter funding goal in ${nativeToken.symbol}`}
                required
                min="0.001"
                step="0.001"
                disabled={isLoading}
              />
              {errors.goal && <div className="error-message">{errors.goal}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="deadline">Duration (days):</label>
              <input
                type="number"
                id="deadline"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                placeholder={`Campaign duration in days (min ${minDuration})`}
                required
                min={minDuration}
                max="365"
                disabled={isLoading || minDurationLoading}
              />
              {minDurationLoading ? (
                <div className="form-hint">Loading minimum duration...</div>
              ) : (
                <div className="form-hint">Minimum campaign duration: {minDuration} days</div>
              )}
              {errors.deadline && <div className="error-message">{errors.deadline}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="token">Currency:</label>
              <select
                id="token"
                name="token"
                value={formData.token}
                onChange={handleChange}
                required
                disabled={isLoading}
              >
                <option value={zeroAddress}>
                  {nativeToken.symbol} (Native)
                </option>
                {erc20Tokens.map(token => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} - {token.address.slice(0, 6)}...{token.address.slice(-4)}
                  </option>
                ))}
              </select>
              <div className="form-hint">
                {formData.token === zeroAddress ? (
                  <span>Campaign will accept {nativeToken.symbol} (native currency)</span>
                ) : (
                  <span>Campaign will accept ERC20 tokens at {formData.token}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="campaignName">Campaign Name:</label>
              <input
                type="text"
                id="campaignName"
                name="campaignName"
                value={formData.campaignName}
                onChange={handleChange}
                placeholder="Enter campaign name"
                required
                disabled={isLoading}
              />
              {errors.campaignName && <div className="error-message">{errors.campaignName}</div>}
            </div>

            <div className="form-group">
              <label htmlFor="campaignDesc">Campaign Description:</label>
              <textarea
                id="campaignDesc"
                name="campaignDesc"
                value={formData.campaignDesc}
                onChange={handleChange}
                placeholder="Describe your campaign"
                rows={3}
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="campaignInfo">Additional Information URL:</label>
              <input
                type="url"
                id="campaignInfo"
                name="campaignInfo"
                value={formData.campaignInfo}
                onChange={handleChange}
                placeholder="https://example.com/campaign-details"
                disabled={isLoading}
              />
              <div className="form-hint">
                Link to additional documentation (website, whitepaper, etc.). 
                The validity of this link is the responsibility of the campaign creator.
              </div>
            </div>

            <div className="form-deposit-info">
              <p>Required deposit: {depositLoading ? 'Loading...' : `${formatEther(requiredDeposit)} ${nativeToken.symbol}`}</p>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={isFormDisabled}
                className="btn btn-primary"
                title={!isConnected ? "Connect your wallet to create a campaign" : ""}
              >
                {isLoading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
            
            {isFormDisabled && !isLoading && (
              <div className="form-help">
                <p>Please connect your wallet to enable campaign creation</p>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};