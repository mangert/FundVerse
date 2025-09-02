import { useCreatedCampaigns } from '../hooks/useCreatedCampaigns';
import { useInvestedCampaigns } from '../hooks/useInvestedCampaigns';
import { AccountCampaignCard } from '../components/AccountCampaignCard';
import { InvestedCampaignCard } from '../components/InvestedCampaignCard';
import { useState } from 'react';
import { useAccount } from 'wagmi';

export const Account = () => {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'created' | 'invested'>('created');
  
  const { createdCampaigns, isLoading: isLoadingCreated, refetch: refetchCreated } = useCreatedCampaigns();
  const { investedCampaigns, isLoading: isLoadingInvested, refetch: refetchInvested } = useInvestedCampaigns();

  const handleRefetch = () => {
    if (activeTab === 'created') {
      refetchCreated();
    } else {
      refetchInvested();
    }
  };

  if (!isConnected) {
    return (
      <div className="page-container">
        <h1>My Account</h1>
        <p>Please connect your wallet to view your account.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Account</h1>
        <p>Connected wallet: {address?.slice(0, 8)}...{address?.slice(-6)}</p>
        <button className="btn btn-secondary" onClick={handleRefetch}>
          Refresh
        </button>
      </div>

      <div className="account-tabs">
        <button 
          className={`tab ${activeTab === 'created' ? 'active' : ''}`}
          onClick={() => setActiveTab('created')}
        >
          My Campaigns ({createdCampaigns.length})
        </button>
        <button 
          className={`tab ${activeTab === 'invested' ? 'active' : ''}`}
          onClick={() => setActiveTab('invested')}
        >
          My Investments ({investedCampaigns.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'created' && (
          <div>
            <h2>Created Campaigns</h2>
            {isLoadingCreated ? (
              <p>Loading your campaigns...</p>
            ) : createdCampaigns.length === 0 ? (
              <p>You haven't created any campaigns yet.</p>
            ) : (
              <div className="account-campaigns-grid">
                {createdCampaigns.map(({ summary, address }) => (
                  <AccountCampaignCard
                    key={`created-${address}`}
                    campaign={summary}
                    campaignAddress={address}
                    onUpdate={refetchCreated}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'invested' && (
          <div>
            <h2>Invested Campaigns</h2>
            {isLoadingInvested ? (
              <p>Loading your investments...</p>
            ) : investedCampaigns.length === 0 ? (
              <p>You haven't invested in any campaigns yet.</p>
            ) : (
              <div className="invested-campaigns-grid">
                {investedCampaigns.map((investedCampaign) => (
                  <InvestedCampaignCard
                    key={`invested-${investedCampaign.campaign.creator}-${investedCampaign.campaign.id}`}
                    investedCampaign={investedCampaign}
                    onAction={() => {
                      // TODO: Implement investment actions
                      console.log('Investment action:', investedCampaign);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Блок лояльности - будет добавлен позже */}
      <div className="loyalty-section">
        <h2>Loyalty Program</h2>
        <p>This section will be implemented soon.</p>
      </div>
    </div>
  );
};