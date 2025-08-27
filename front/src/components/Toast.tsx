import { useEffect, useState } from 'react';
import type { NotificationType } from '../contexts/NotificationContext';

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

  const getToastTypeClass = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'toast-success';
      case 'error': return 'toast-error';
      case 'warning': return 'toast-warning';
      case 'info': return 'toast-info';
      default: return 'toast-info';
    }
  };

  return (
    <div className={`toast ${getToastTypeClass(type)} ${isExiting ? 'exiting' : ''}`}>
      {message}
    </div>
  );
};