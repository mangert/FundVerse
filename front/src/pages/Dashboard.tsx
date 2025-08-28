import { useCampaigns } from '../hooks/useCampaigns';
import { CampaignCard } from '../components/CampaignCard';
import { PlatformInfo } from '../components/PlatformInfo';
import { useState, useEffect } from 'react';
import { CreateCampaignForm } from '../components/CreateCampaignForm';
import { useAccount } from 'wagmi';

export const Dashboard = () => {
  const { address, isConnected } = useAccount();
  const { campaignAddresses, isLoading, refetch } = useCampaigns();
  const [isRefetching, setIsRefetching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Периодическое обновление данных
  useEffect(() => {
    const interval = setInterval(() => {
      refetch().catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, [refetch]);

  // Закрываем форму при отключении кошелька (если она была открыта)
  useEffect(() => {
    if (!isConnected && showCreateForm) {
      setShowCreateForm(false);
    }
  }, [isConnected, showCreateForm]);

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
        {/* Показываем кнопку только если кошелек подключен */}
        {isConnected ? (
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateForm(true)}
          >
            Create Campaign
          </button>
        ) : (
          <div className="connect-wallet-prompt">
            <p>Connect your wallet to create a campaign</p>
          </div>
        )}
      </div>
      
      {/* Изменил условие: форма показывается если showCreateForm true, независимо от подключения */}
      {showCreateForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <CreateCampaignForm />
            <button 
              className="btn btn-secondary"
              onClick={() => setShowCreateForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      
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