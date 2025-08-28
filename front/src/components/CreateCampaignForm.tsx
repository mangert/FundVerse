// components/CreateCampaignForm.tsx
import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';
import { parseEther, zeroAddress } from 'viem';
import { tokenService } from '../services/TokenService';
import { errorService } from '../services/ErrorService';
import { useNotifications } from '../contexts/NotificationContext';
import type { NotificationType } from '../contexts/NotificationContext';

export const CreateCampaignForm = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { addNotification } = useNotifications();
  
  const [formData, setFormData] = useState({
    goal: '',
    deadline: '',
    campaignMeta: '',
    token: zeroAddress
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [minDuration, setMinDuration] = useState(1);
  const [minDurationLoading, setMinDurationLoading] = useState(true);

  // Загружаем минимальную длительность из контракта
  useEffect(() => {
    const fetchMinDuration = async () => {
      if (!publicClient) return;
      
      try {
        const minLifespan = await publicClient.readContract({
          address: PLATFORM_ADDRESS,
          abi: PlatformABI,
          functionName: 'getMinLifespan',
          args: []
        }) as bigint;
        
        const minDays = Math.ceil(Number(minLifespan) / (24 * 60 * 60));
        setMinDuration(minDays);
      } catch (error) {
        console.warn('Failed to fetch min duration, using default:', error);
        setMinDuration(1);
      } finally {
        setMinDurationLoading(false);
      }
    };

    if (isConnected) {
      fetchMinDuration();
    }
  }, [publicClient, isConnected]);

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

    const durationDays = Number(formData.deadline);
    if (durationDays < minDuration) {
      addNotification({
        type: 'error',
        message: `Campaign duration must be at least ${minDuration} days`,
        isGlobal: false
      });
      return;
    }

    if (formData.campaignMeta) {
      try {
        JSON.parse(formData.campaignMeta);
      } catch (err) {
        addNotification({
          type: 'error',
          message: 'Campaign description must be valid JSON',
          isGlobal: false
        });
        return;
      }
    }

    setIsLoading(true);
    
    try {
      const goal = parseEther(formData.goal);
      const deadline = Math.floor(Date.now() / 1000) + (durationDays * 24 * 60 * 60);

      console.log('Sending transaction with params:', {
        goal: goal.toString(),
        deadline,
        campaignMeta: formData.campaignMeta,
        token: formData.token,
        value: parseEther('0.1').toString()
      });

      // Убираем симуляцию и сразу отправляем транзакцию
      const hash = await walletClient.writeContract({
        address: PLATFORM_ADDRESS,
        abi: PlatformABI,
        functionName: 'createCampaign',
        args: [goal, deadline, formData.campaignMeta, formData.token],
        value: parseEther('0.1')
      });

      console.log('Transaction hash:', hash);

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
          campaignMeta: '',
          token: zeroAddress
        });
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
        persistent: decodedError.type === 'error'
      });
      
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const activeTokens = tokenService.getActiveTokens();
  const nativeToken = tokenService.getNativeToken();
  const isFormDisabled = !isConnected || isLoading;
  const erc20Tokens = activeTokens.filter(token => token.address !== zeroAddress);

  return (
    <div className="create-campaign-form">
      <h2>Create New Campaign</h2>

      {!isConnected && (
        <div className="warning-message">
          <p>⚠️ Wallet disconnected. Connect your wallet to submit the form.</p>
        </div>
      )}      
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="goal">Funding Goal:</label>
          <input
            type="number"
            id="goal"
            name="goal"
            value={formData.goal}
            onChange={handleChange}
            placeholder="Enter funding goal"
            required
            min="0"
            step="0.001"
            disabled={isLoading}
          />
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
          <label htmlFor="campaignMeta">Campaign Description (JSON):</label>
          <textarea
            id="campaignMeta"
            name="campaignMeta"
            value={formData.campaignMeta}
            onChange={handleChange}
            placeholder='{"name": "My Campaign", "desc": "Description..."}'
            rows={4}
            required
            disabled={isLoading}
          />
        </div>

        <button 
          type="submit" 
          disabled={isFormDisabled}
          className="btn btn-primary"
          title={!isConnected ? "Connect your wallet to create a campaign" : ""}
        >
          {isLoading ? 'Creating...' : 'Create Campaign'}
        </button>
        
        {isFormDisabled && !isLoading && (
          <div className="form-help">
            <p>Please connect your wallet to enable campaign creation</p>
          </div>
        )}
      </form>
    </div>
  );
};