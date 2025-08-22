// src/lib/wagmi.ts
import { createConfig, http } from 'wagmi'
import { hardhat, localhost, sepolia } from 'wagmi/chains'
import { injected /*, walletConnect, coinbaseWallet*/ } from 'wagmi/connectors'

// Базовые цепочки: локалка (Hardhat) и одна тестовая.
// Добавляй/меняй по мере надобности.
export const config = createConfig({
  chains: [localhost, hardhat, sepolia],
  connectors: [
    injected(),
    // --- опционально позже ---
    // walletConnect({ projectId: import.meta.env.VITE_WC_PROJECT_ID }),
    // coinbaseWallet({ appName: 'FundVerse' }),
  ],
  transports: {
    [localhost.id]: http('http://127.0.0.1:8545'),
    [hardhat.id]:   http('http://127.0.0.1:8545'),
    [sepolia.id]:   http(), // публичный RPC по умолчанию viem; при необходимости задай свой
  },
})
