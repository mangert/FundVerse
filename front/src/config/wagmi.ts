import { createConfig, http } from 'wagmi'
import { hardhat, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const chains = [hardhat, sepolia] as const
export const defaultChain = hardhat

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export const config = getDefaultConfig({
  appName: 'FundVerse',
  projectId: walletConnectProjectId,
  chains: [hardhat, sepolia],
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(import.meta.env.VITE_ALCHEMY_API_KEY as string),
  },  
});

/*export const config = createConfig({
  chains,
  transports: {
    [hardhat.id]: http('http://127.0.0.1:8545', {
      // Добавляем таймауты для Hardhat
      timeout: 5000,
      retryCount: 2,
    }),
    [sepolia.id]: http(import.meta.env.VITE_ALCHEMY_API_KEY as string),
  },
  connectors: [injected()],
})*/