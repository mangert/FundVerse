// компонент строки состояния
import { useAccount } from 'wagmi';
import { useNotifications, type NotificationType } from '../contexts/NotificationContext';
import { useState } from 'react';

export const StatusBar = () => {
  const { address } = useAccount();
  const { state } = useNotifications();
  const [isExpanded, setIsExpanded] = useState(false);

  // Фильтруем уведомления: глобальные + персональные для текущего аккаунта
  const filteredNotifications = state.notifications.filter(
    n => n.isGlobal || (address && n.account === address.toLowerCase())
  );

  const getNotificationTypeClass = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'notification-success';
      case 'error': return 'notification-error';
      case 'warning': return 'notification-warning';
      case 'info': return 'notification-info';
      default: return '';
    }
  };

  if (filteredNotifications.length === 0) {
    return null;
  }

  return (
    <div className={`status-bar ${isExpanded ? 'expanded' : ''}`}>
      <div className="status-bar-header">
        <span className="status-bar-title">
          Status: {filteredNotifications.length} notification(s)
        </span>
        <button 
          className="status-bar-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>
      
      {isExpanded && (
        <div className="status-bar-content">
          {filteredNotifications.slice().reverse().map((notification) => (
            <div
              key={notification.id}
              className={`notification-item ${getNotificationTypeClass(notification.type)}`}
            >
              <div className="notification-header">
                <span className="notification-message">{notification.message}</span>
                <span className="notification-time">
                  {notification.timestamp.toLocaleTimeString()}
                </span>
              </div>
              {notification.transactionHash && (
                <div className="notification-tx">
                  TX: {notification.transactionHash.slice(0, 8)}...{notification.transactionHash.slice(-6)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};