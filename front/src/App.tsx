import { useAccount, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Dashboard } from './pages/Dashboard';
import { StatusBar } from './components/StatusBar';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { Toast } from './components/Toast';
import { useEffect } from 'react';
import { initEventService, stopEventService } from './services/eventService';

const AppContent = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { state, dispatch, addNotification } = useNotifications();

  // Инициализируем сервис событий
  useEffect(() => {
    if (publicClient) {
      initEventService(publicClient, addNotification);
    }

    // Очищаем при размонтировании компонента
    return () => {
      stopEventService();
    };
  }, [publicClient, addNotification]);

  // Очистка уведомлений при загрузке
  useEffect(() => {
    console.log('Cleaning up notifications');
    dispatch({ type: 'CLEAR_NOTIFICATIONS' });
  }, [dispatch]);

  // Показываем toast только для персональных уведомлений
  const personalToasts = state.notifications.filter(
    n => !n.isGlobal && n.account === address?.toLowerCase() && !n.persistent
  );

  return (
    <div className="app-container">
      <div className="app-header">
        <h1 className="app-title">FundVerse Front</h1>
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