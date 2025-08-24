import { useCampaigns } from '../hooks/useCampaigns';
import { CampaignCard } from '../components/CampaignCard';
import { PLATFORM_ADDRESS } from '../utils/addresses'; //отладочный - удалить!

export const Dashboard = () => {
  const { campaigns, isLoading } = useCampaigns();

  //отладочный код - убрать
  console.log('Dashboard loaded - campaigns:', campaigns);
  console.log('Loading state:', isLoading);
  console.log('Platform address in component:', PLATFORM_ADDRESS);
  //конец

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

      <div className="campaigns-grid">
        {campaigns.map(campaign => (
          <CampaignCard 
            key={campaign.address} 
            address={campaign.address} 
          />
        ))}
        
        {campaigns.length === 0 && (
          <div className="empty-state">
            <h2>No campaigns yet</h2>
            <p>Be the first to create a campaign!</p>
          </div>
        )}
      </div>
    </div>
  );
};