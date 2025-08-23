import { useAccount, useChainId, useSwitchChain, useConnect, useBlockNumber } from 'wagmi'
import { chains, defaultChain } from './config/wagmi'
import { useState, useEffect } from 'react'
import { hardhat } from 'wagmi/chains'
import { ConnectButton } from '@rainbow-me/rainbowkit'

function App() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { connect, connectors } = useConnect()
  
  const [hardhatStatus, setHardhatStatus] = useState<'checking' | 'connected' | 'error'>('checking')
  
  const { 
    data: blockNumber, 
    isLoading: isBlockLoading, 
    error: blockError,
    refetch: refetchBlock 
  } = useBlockNumber()

  useEffect(() => {
    const checkHardhat = async () => {
      if (chainId === hardhat.id) {
        try {
          const response = await fetch('http://127.0.0.1:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_blockNumber',
              params: [],
              id: 1,
            }),
          })
          
          if (response.ok) {
            setHardhatStatus('connected')
          } else {
            setHardhatStatus('error')
          }
        } catch (error) {
          setHardhatStatus('error')
        }
      }
    }

    checkHardhat()
  }, [chainId])

  const currentChain = chains.find(chain => chain.id === chainId) || defaultChain

  return (    
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Header с кнопкой подключения */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px',
        borderBottom: '2px solid #f0f0f0',
        paddingBottom: '20px'
      }}>
        <h1 style={{ margin: 0 }}>FundVerse Front</h1>
        <ConnectButton />
      </div>
      
      {/* Основной контент */}
      <div>
        <p>
          🛰 Default chain: <b>{defaultChain.name}</b> ({defaultChain.id})
        </p>

        <p>
          📡 Current chain: <b>{currentChain.name}</b> ({chainId})
        </p>

        <p>
          🔢 Current block:{" "}
          <b>
            {isBlockLoading ? "Loading..." : blockError ? "Error!" : blockNumber?.toString()}
          </b>
          {blockError && (
            <button 
              onClick={() => refetchBlock()}
              style={{ marginLeft: '10px', padding: '2px 8px' }}
            >
              Retry
            </button>
          )}
        </p>

        {/* Статус Hardhat */}
        {chainId === hardhat.id && (
          <p>
            🛠 Hardhat status:{" "}
            <span style={{
              color: hardhatStatus === 'connected' ? 'green' : 
                     hardhatStatus === 'error' ? 'red' : 'orange'
            }}>
              {hardhatStatus === 'connected' ? 'Connected ✅' :
               hardhatStatus === 'error' ? 'Error - check if node is running ❌' :
               'Checking... 🔄'}
            </span>
          </p>
        )}

        {/* Кнопки переключения сетей */}
        <div style={{ margin: '20px 0' }}>
          <h3>Switch network:</h3>
          {chains.map(chain => (
            <button
              key={chain.id}
              onClick={() => switchChain({ chainId: chain.id })}
              style={{
                margin: '5px',
                padding: '8px 16px',
                backgroundColor: chain.id === chainId ? '#4CAF50' : '#f0f0f0',
                color: chain.id === chainId ? 'white' : 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {chain.name}
            </button>
          ))}
        </div>

        {isConnected ? (
          <div>
            <p>✅ Connected as {address}</p>
            {chainId !== defaultChain.id && (
              <button 
                onClick={() => switchChain({ chainId: defaultChain.id })}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Switch to {defaultChain.name}
              </button>
            )}
          </div>
        ) : (
          <div>
            <p>❌ Not connected</p>
            <button 
              onClick={() => connect({ connector: connectors[0] })}
              style={{
                padding: '8px 16px',
                backgroundColor: '#FF5722',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Connect Wallet
            </button>
          </div>
        )}

        {/* Инструкция по запуску Hardhat */}
        {hardhatStatus === 'error' && (
          <div style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '5px'
          }}>
            <h4>🚨 Hardhat Node Not Running</h4>
            <p>To use Hardhat network, run:</p>
            <code style={{ 
              display: 'block', 
              padding: '10px', 
              backgroundColor: '#f8f9fa',
              borderRadius: '3px',
              margin: '10px 0'
            }}>
              npx hardhat node
            </code>
            <p>in a separate terminal and refresh the page.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default App