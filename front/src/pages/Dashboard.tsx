import { useCampaigns } from '../hooks/useCampaigns';
import { CampaignCard } from '../components/CampaignCard';
import { usePlatformEvents } from '../hooks/usePlatformEvents';
import { useState, useRef, useEffect } from 'react';

interface CampaignAddr {
  address: string;
}

export const Dashboard = () => {
  const { campaignAddresses, isLoading } = useCampaigns();
  const [newCampaigns, setNewCampaigns] = useState<string[]>([]);
  const timeoutRef = useRef<number>(0);  

  // Отладочный код
  console.log('Dashboard loaded - campaigns:', campaignAddresses);
  console.log('Loading state:', isLoading);  

  // Обработчик событий создания кампаний
  usePlatformEvents({
    onCampaignCreated: (event) => {
      console.log('🎉 New campaign event:', event);
      
      // НЕМЕДЛЕННО добавляем кампанию в список
      setNewCampaigns(prev => {
        if (!prev.includes(event.NewCampaignAddress)) {
          return [...prev, event.NewCampaignAddress];
        }
        return prev;
      });

      // Дебаунсим только уведомление (скрытие через 5 сек)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setNewCampaigns(prev => prev.filter(addr => addr !== event.NewCampaignAddress));
      }, 5000);
    },
    onError: (error) => {
      console.error('Error in platform events:', error);
    }
  });  

  // Чистим таймаут при размонтировании
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Объединяем кампании из контракта и новые кампании из событий
  const allCampaigns = [...campaignAddresses, ...newCampaigns];

  if (isLoading) {
    return (
      <div className="page-container">
        <h1>Loading campaigns...</h1>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* Уведомления о новых кампаниях */}
      {newCampaigns.map((address, index) => (
        <div 
          key={`notification-${address}`}
          style={{
            position: 'fixed',
            top: `${20 + index * 60}px`,
            right: '20px',
            background: '#4CAF50',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        >
          🎉 New campaign created!
        </div>
      ))}

      <div className="page-header">
        <h1>Active Campaigns</h1>
        <button className="btn btn-primary">
          Create Campaign
        </button>
      </div>

      <div className="campaigns-grid">
        {allCampaigns.map((campaign) => (
          <CampaignCard 
            key={campaign}
            address={campaign} 
          />
        ))}
        
        {allCampaigns.length === 0 && (
          <div className="empty-state">
            <h2>No campaigns yet</h2>
            <p>Be the first to create a campaign!</p>
          </div>
        )}
      </div>
    </div>
  );
};