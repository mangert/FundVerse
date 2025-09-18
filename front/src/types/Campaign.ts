// Типы статусов кампаний и их отображение на компонентах
export type CampaignStatus = 
  | 0 // Live - идет сбор
  | 1 // Stopped - временно приостановлена  
  | 2 // Cancelled - отменена фаундером (возврат средств)
  | 3 // Failed - не собрала нужное → неуспешна
  | 4; // Successful - достигла цели и финализирована

// Функция для получения текста статуса
export const getStatusText = (status: CampaignStatus): string => {
  switch (status) {
    case 0: return 'Live 🔵';
    case 1: return 'Stopped ⏸️';
    case 2: return 'Cancelled ❌';
    case 3: return 'Failed 💀';
    case 4: return 'Successful 💎';
    default: return `Unknown (${status})`;
  }
};

// Функция для получения класса статуса
export const getStatusClass = (status: CampaignStatus): string => {
  switch (status) {
    case 0: return 'status-live';
    case 1: return 'status-stopped';
    case 2: return 'status-cancelled';
    case 3: return 'status-failed';
    case 4: return 'status-successful';
    default: return 'status-unknown';
  }
};