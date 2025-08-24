import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from './config/wagmi';

// Импортируем стили RainbowKit
import '@rainbow-me/rainbowkit/styles.css';

//импортируем стили компонентов
import './styles/variables.css';
import './styles/globals.css';
import './styles/components.css';

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider 
          theme={darkTheme({
            accentColor: '#7928CA',
            accentColorForeground: 'white',
            borderRadius: 'small',
          })}
        >
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);
