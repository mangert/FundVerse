import { useCampaign } from '../hooks/useCampaign';
import { formatEther } from 'viem';

interface CampaignCardProps {
  address: string;
}
//компонет сводной карточки кампании
export const CampaignCard = ({ address }: CampaignCardProps) => {
  //получаем данные кампании по адресу
  const { data: summary, isLoading } = useCampaign(address);

  //пока данные не загрузились
  if (isLoading) {
    return (
      <div className="card">
        <div>Loading campaign...</div>
      </div>
    );
  }

  //если нифига не получили
  if (!summary) {
    return (
      <div className="card">
        <div>Failed to load campaign</div>
      </div>
    );
  }

  //считаем прогресс и остаток времени
  const progress = Number(summary.raised) / Number(summary.goal) * 100;
  const daysLeft = Math.max(0, Math.ceil((summary.deadline * 1000 - Date.now()) / (1000 * 60 * 60 * 24)));
  //TODO разобраться с валютой

  return (
    <div className="card">
      <h3>Campaign #{summary.id}</h3>
      <p>By: {summary.creator.slice(0, 8)}...</p>
      
      <div className="progress-bar">
        <div style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>      
      
      <div className="campaign-stats">
        <div><strong>Raised:</strong> {formatEther(summary.raised)} ETH</div>
        <div><strong>Goal:</strong> {formatEther(summary.goal)} ETH</div>
        <div><strong>Progress:</strong> {progress.toFixed(1)}%</div>
        <div><strong>Time left:</strong> {daysLeft} days</div>
      </div>

      <button className="btn btn-primary">
        View Campaign
      </button>
    </div>
  );
};