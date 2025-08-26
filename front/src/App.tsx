import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Dashboard } from './pages/Dashboard';
import { StatusBar } from './components/StatusBar';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { usePlatformEvents } from './hooks/usePlatformEvents';
import { Toast } from './components/Toast';

// Компонент-обертка для обработки событий
const AppContent = () => {
  const { address } = useAccount();
  const { state, dispatch } = useNotifications();
  
  usePlatformEvents();

  // Показываем toast только для персональных уведомлений текущего пользователя
  const personalToasts = state.notifications.filter(
    n => !n.isGlobal && n.account === address?.toLowerCase() && !n.persistent
  );

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
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
      
      <Dashboard/>
      
      {/* Toast уведомления */}
      {personalToasts.slice(0, 3).map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => dispatch({ type: 'REMOVE_NOTIFICATION', payload: toast.id })}
        />
      ))}
      
      <StatusBar />
    </div>
  );
};

function App() {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
}

export default App;