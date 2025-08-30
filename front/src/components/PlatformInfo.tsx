import { formatEther } from 'viem';
import { useState, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { getPlatformParams, type PlatformParams } from '../services/platformInfoService';
import { tokenService } from '../services/TokenService';

export const PlatformInfo = () => {
  
  const publicClient = usePublicClient();
  const [params, setParams] = useState<PlatformParams | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadParams = async () => {
      if (!publicClient) return;
      
      try {
        setIsLoading(true);
        const platformParams = await getPlatformParams(publicClient);
        setParams(platformParams);
      } catch (err) {
        setError('Failed to load platform parameters');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadParams();
  }, [publicClient]);

  if (isLoading) return <div className="loading">Loading platform info...</div>;
  if (error) return <div className="error">{error}</div>;
  
  if (!params) return null;

  // Преобразования в компоненте
  const platformFeePercent = Number(params.platformFee) / 10; // 100 промилле = 10%
  const depositAmountETH = formatEther(params.depositAmount);
  const minTimelockDays = Number(params.minTimelock) / (24 * 60 * 60); // секунды → дни
  const nativeToken = tokenService.getNativeToken();

  // Умное форматирование
  const displayFee = platformFeePercent % 1 === 0 
  ? platformFeePercent.toString() 
  : platformFeePercent.toFixed(1);

  const displayDeposit = parseFloat(depositAmountETH) % 1 === 0
  ? depositAmountETH
  : parseFloat(depositAmountETH).toFixed(4);
  
  return (
    <div className="platform-info">
      <h3>Platform Parameters</h3>
      <div className="params-grid">
        <div className="param-item">
          <span className="param-label">Platform Fee: </span>
          <span className="param-value">{displayFee}%</span>
        </div>
        <div className="param-item">
          <span className="param-label">Required Deposit: </span>
          <span className="param-value">{displayDeposit} {nativeToken.symbol}</span>
        </div>
        <div className="param-item">
          <span className="param-label">Min Timelock: </span>
          <span className="param-value">{minTimelockDays} days</span>
        </div>
      </div>
    </div>
  );
};