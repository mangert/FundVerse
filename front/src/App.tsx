import { useAccount, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Dashboard } from './pages/Dashboard';
import { Account } from './pages/Account'; 
import { StatusBar } from './components/StatusBar';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { Toast } from './components/Toast';
import { useEffect, useState } from 'react';
import { initEventService, stopEventService } from './services/eventService';
import { tokenService } from './services/TokenService';

const AppContent = () => {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { state, dispatch, addNotification } = useNotifications();
  const [currentPage, setCurrentPage] = useState('dashboard'); // Состояние для текущей страницы

  // Инициализируем сервис токенов
  useEffect(() => {
    if (publicClient) {
      tokenService.init(publicClient);
    }
  }, [publicClient]);
  
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

  // Функция для переключения страниц
  const navigateTo = (page: string) => {
    setCurrentPage(page);
  };

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="header-left">
          <h1 className="app-title">FundVerse</h1>
          <nav className="app-navigation">
            <button 
              className={`nav-link ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => navigateTo('dashboard')}
            >
              Dashboard
            </button>
            {isConnected && (
              <button 
                className={`nav-link ${currentPage === 'account' ? 'active' : ''}`}
                onClick={() => navigateTo('account')}
              >
                My Account
              </button>
            )}
          </nav>
        </div>
        <ConnectButton />
      </div>
      
      {/* Отображаем текущую страницу */}
      {currentPage === 'dashboard' && <Dashboard />}
      {currentPage === 'account' && (
        isConnected ? <Account /> : <div className="page-container">Please connect your wallet to access your account</div>
      )}
      
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