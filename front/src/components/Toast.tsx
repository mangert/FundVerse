import { useEffect, useState } from 'react';
import { type NotificationType } from '../contexts/NotificationContext';

interface ToastProps {
  message: string;
  type: NotificationType;
  duration?: number;
  onClose: () => void;
}

export const Toast = ({ message, type, duration = 5000, onClose }: ToastProps) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getBackgroundColor = (type: NotificationType) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'error': return '#f44336';
      case 'warning': return '#ff9800';
      case 'info': return '#2196F3';
      default: return '#666';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        background: getBackgroundColor(type),
        color: 'white',
        padding: '12px 16px',
        borderRadius: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        opacity: isExiting ? 0 : 1,
        transform: isExiting ? 'translateX(100%)' : 'translateX(0)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        zIndex: 1001,
        minWidth: '200px'
      }}
    >
      {message}
    </div>
  );
};