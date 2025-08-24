import { useChainId } from 'wagmi';
import addressesHardhat from '../contracts/addresses.hardhat.json';
// позже добавить другие сети:
// import addressesSepolia from './addresses.sepolia.json';

export interface ContractAddresses {
  platform: string;
  loyaltyNFT: string;
  deployer: string;
}

// Функция для получения адресов based on chainId
export const useContractAddresses = (): ContractAddresses => {
  const chainId = useChainId();
  
  switch (chainId) {
    case 31337: // Hardhat
      return addressesHardhat;
    case 11155111: // Sepolia
      // return addressesSepolia;
      return addressesHardhat; // временно fallback
    default:
      // Fallback на hardhat для разработки
      console.warn(`Unknown chainId ${chainId}, using hardhat addresses`);
      return addressesHardhat;
  }
};

// Для использования outside React components (в хуках и т.д.)
export const getContractAddresses = (chainId: number): ContractAddresses => {
  switch (chainId) {
    case 31337:
      return addressesHardhat;
    case 11155111:
      // return addressesSepolia;
      return addressesHardhat;
    default:
      return addressesHardhat;
  }
};

// Экспортируем адреса по умолчанию для простых случаев
export const PLATFORM_ADDRESS = addressesHardhat.platform as `0x${string}`;
export const LOYALTY_NFT_ADDRESS = addressesHardhat.loyaltyNFT as `0x${string}`;