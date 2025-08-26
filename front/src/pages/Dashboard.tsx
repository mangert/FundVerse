import { useCampaigns } from '../hooks/useCampaigns';
import { CampaignCard } from '../components/CampaignCard';
import { usePlatformEvents } from '../hooks/usePlatformEvents';
import { useState, useCallback, useEffect, useRef } from 'react';

export const Dashboard = () => {
  const { campaignAddresses, isLoading, refetch } = useCampaigns();
  const [isRefetching, setIsRefetching] = useState(false);
  const lastProcessedEvent = useRef<string>('');

  // Обработчик создания кампании - ТОЛЬКО обновление данных
  const handleCampaignCreated = useCallback((event: any) => {
    const eventKey = `${event.NewCampaignAddress}-${event.founder}`;
    
    // Проверяем, не обрабатывали ли уже это событие
    if (lastProcessedEvent.current === eventKey) {
      console.log('Skipping duplicate event:', eventKey);
      return;
    }

    console.log('New campaign detected, refetching data...', event);
    lastProcessedEvent.current = eventKey;
    
    // Устанавливаем флаг обновления
    setIsRefetching(true);
    
    // Обновляем данные с задержкой
    setTimeout(() => {
      refetch()
        .then(() => {
          console.log('Data refetched after new campaign');
        })
        .catch(console.error)
        .finally(() => {
          setIsRefetching(false);
        });
    }, 1000);
  }, [refetch]);

  // Подписываемся на события
  usePlatformEvents(handleCampaignCreated);

  if (isLoading) {
    return (
      <div className="page-container">
        <h1>Loading campaigns...</h1>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Active Campaigns {isRefetching ? '(Updating...)' : ''}</h1>
        <button className="btn btn-primary">
          Create Campaign
        </button>
      </div>

      <div className="campaigns-grid">
        {campaignAddresses.map((address) => (
          <CampaignCard 
            key={address}
            address={address} 
          />
        ))}
        
        {campaignAddresses.length === 0 && (
          <div className="empty-state">
            <h2>No campaigns yet</h2>
            <p>Be the first to create a campaign!</p>
          </div>
        )}
      </div>
    </div>
  );
};