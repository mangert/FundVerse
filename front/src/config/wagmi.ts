import { createConfig, http } from 'wagmi'
import { hardhat, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { getDefaultConfig } from '@rainbow-me/rainbowkit';

export const chains = [/*hardhat, */sepolia] as const
export const defaultChain = sepolia

const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export const config = getDefaultConfig({
  appName: 'FundVerse',
  projectId: walletConnectProjectId,
  chains: [/*hardhat,*/ sepolia],
  transports: {
    //[hardhat.id]: http('http://127.0.0.1:8545'), //убрала, потому что кидает ошибки на сервере
    [sepolia.id]: http(import.meta.env.VITE_ALCHEMY_API_KEY as string),
  },  
});