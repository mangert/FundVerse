export interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  status: boolean;
  addedAtBlock?: number;
}

export interface NetworkTokensConfig {
  native: {
    symbol: string;
    decimals: number;
    name: string;
  };
  tokens: TokenConfig[];
  contractDeploymentBlock: number; // Блок развертывания контракта
}

export const BASE_TOKENS: Record<number, NetworkTokensConfig> = {
  1: { //mainnet
    native: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    tokens: [
      {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        decimals: 6,
        name: 'USD Coin',
        status: true,
        addedAtBlock: 12345678 // Пример
      }
    ],
    contractDeploymentBlock: 12345678
  },
  11155111: { //Sepolia
    native: { symbol: 'ETH', decimals: 18, name: 'Sepolia ETH' },
    tokens: [],
    contractDeploymentBlock: 0
  },
  31337: { //hardhat
    native: { symbol: 'HETH', decimals: 18, name: 'Hardhat ETH' },
    tokens: [],
    contractDeploymentBlock: 0
  }
};