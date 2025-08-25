import { useEffect, useState } from 'react';

interface NotificationProps {
  message: string;
  duration?: number;
  onClose: () => void;
}

export const Notification = ({ message, duration = 5000, onClose }: NotificationProps) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300); // Ждем завершения анимации
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`notification ${isExiting ? 'exiting' : ''}`}>
      {message}
    </div>
  );
};