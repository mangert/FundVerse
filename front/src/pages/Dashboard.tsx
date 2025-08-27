import { useCampaigns } from '../hooks/useCampaigns';
import { CampaignCard } from '../components/CampaignCard';
import { PlatformInfo } from '../components/PlatformInfo';
import { useState, useEffect } from 'react';

export const Dashboard = () => {
  const { campaignAddresses, isLoading, refetch } = useCampaigns();
  const [isRefetching, setIsRefetching] = useState(false);

  // Периодическое обновление данных
  useEffect(() => {
    const interval = setInterval(() => {
      refetch().catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, [refetch]);

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
        <h1>Active Campaigns</h1>
        <button className="btn btn-primary">
          Create Campaign
        </button>
      </div>
      
      {/* Добавляем информацию о платформе */}
      <PlatformInfo />

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