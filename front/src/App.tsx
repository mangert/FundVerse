import { useAccount, useChainId, useBlockNumber } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { chains, defaultChain } from './config/wagmi';
import { Dashboard } from './pages/Dashboard';

function App() {  
  const chainId = useChainId();    

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px',
        borderBottom: '2px solid #f0f0f0',
        paddingBottom: '20px'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>FundVerse Front</h1>
        <ConnectButton />
      </div>
      <Dashboard/>;
      
    </div>
  );
}

export default App;