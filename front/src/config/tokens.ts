export interface NetworkTokens {
  native: {
    symbol: string;
    decimals: number;
    name: string;
  };
  tokens: {
    address: string;
    symbol: string;
    decimals: number;
    name: string;
    status: boolean;
  }[];
}

// Простой объект без жестких типов
export const BASE_TOKENS = {
  1: { // Mainnet
    native: { symbol: 'ETH', decimals: 18, name: 'Ethereum' },
    tokens: [
      {
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        symbol: 'USDC',
        decimals: 6,
        name: 'USD Coin',
        status: true
      }
    ]
  },
  11155111: { // Sepolia
    native: { symbol: 'ETH', decimals: 18, name: 'Sepolia ETH' },
    tokens: []
  },
  31337: { // hardhat
    native: { symbol: 'ETH', decimals: 18, name: 'ETH' },
    tokens: []
  }
};

// Тип для индекса - number или string
export type BaseTokensKey = keyof typeof BASE_TOKENS;

