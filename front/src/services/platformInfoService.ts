import { type PublicClient } from 'viem';
import { PlatformABI } from '../utils/abi';
import { PLATFORM_ADDRESS } from '../utils/addresses';

export interface PlatformParams {
  platformFee: bigint; // комиссия в промилле (сырая)
  depositAmount: bigint; // залог в wei (сырой)
  minTimelock: bigint; // таймлок в секундах (сырой)
}

export const getPlatformParams = async (publicClient: PublicClient): Promise<PlatformParams> => {
  try {
    const [fee, deposit, timelock] = await Promise.all([
      publicClient.readContract({
        address: PLATFORM_ADDRESS,
        abi: PlatformABI,
        functionName: 'getBaseFee',
        args: []
      }) as Promise<bigint>,
      
      publicClient.readContract({
        address: PLATFORM_ADDRESS,
        abi: PlatformABI,
        functionName: 'getRequiredDeposit',
        args: []
      }) as Promise<bigint>,
      
      publicClient.readContract({
        address: PLATFORM_ADDRESS,
        abi: PlatformABI,
        functionName: 'getDelay',
        args: []
      }) as Promise<bigint>,
    ]);

    return {
      platformFee: fee,
      depositAmount: deposit,
      minTimelock: timelock,
    };
  } catch (error) {
    console.error('Failed to fetch platform params:', error);
    throw error;
  }
};