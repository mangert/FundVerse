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

  const getTypeColor = (type: NotificationType) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'error': return '#f44336';
      case 'warning': return '#ff9800';
      case 'info': return '#2196F3';
      default: return '#666';
    }
  };

  if (filteredNotifications.length === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#f5f5f5',
      borderTop: '1px solid #ddd',
      padding: '8px 16px',
      fontFamily: 'monospace',
      fontSize: '12px',
      zIndex: 1000,
      maxHeight: isExpanded ? '200px' : '24px',
      overflow: 'auto',
      transition: 'max-height 0.3s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold' }}>
          Status: {filteredNotifications.length} notification(s)
        </span>
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          {isExpanded ? '▲' : '▼'}
        </button>
      </div>
      
      {isExpanded && (
        <div style={{ marginTop: '8px' }}>
          {filteredNotifications.slice().reverse().map((notification) => (
            <div
              key={notification.id}
              style={{
                padding: '4px 8px',
                margin: '2px 0',
                borderLeft: `3px solid ${getTypeColor(notification.type)}`,
                background: 'white'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{notification.message}</span>
                <span style={{ color: '#666', fontSize: '10px' }}>
                  {notification.timestamp.toLocaleTimeString()}
                </span>
              </div>
              {notification.transactionHash && (
                <div style={{ fontSize: '10px', color: '#666' }}>
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