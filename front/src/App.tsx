import { useBlockNumber, useChainId } from "wagmi";

export default function App() {
  const chainId = useChainId();
  const { data: blockNumber, isLoading, isError } = useBlockNumber({
    chainId,
    watch: true, // обновляться в реальном времени
  });

  return (
    <div style={{ fontFamily: "ui-sans-serif, system-ui", padding: 24 }}>
      <h1>Sepolia RPC check</h1>
      <div>chainId: {chainId}</div>
      {isLoading && <div>Loading block…</div>}
      {isError && <div style={{ color: "crimson" }}>RPC error</div>}
      {blockNumber !== undefined && <div>Latest block: {blockNumber.toString()}</div>}
    </div>
  );
}
/*
import { useAccount, useConnect, useDisconnect } from 'wagmi'

export default function App() {
  const { address, isConnected } = useAccount()
  const { connectors, connect, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <div style={{ padding: 24 }}>
        <div>Connected: {address}</div>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>Connect a wallet</h2>
      {connectors.map((c) => (
        <button
          key={c.uid}
          onClick={() => connect({ connector: c })}
          disabled={isPending}
          style={{ display: 'block', marginBottom: 8 }}
        >
          {c.name}
        </button>
      ))}
      {error && <div style={{ color: 'red' }}>{error.message}</div>}
    </div>
  )
}*/


/*
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App*/
