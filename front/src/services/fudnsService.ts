// сервис получения данных о выведенных из успешных кампаний сборов
// прокладка между бэкендом и компонентами
export interface FundEvent {
  campaignAddress: string;
  recipient: string;
  amount: string;
  txHash: string;
  blockNumber: string;
}

export interface FundsStatus {
  lastProcessedBlock: string;
  count: number;
}

class FundsService {
  // Для любого IP-адреса используем прямой доступ, для домена - прокси
  private readonly API_BASE = window.location.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)
    ? `http://${window.location.hostname}:3001/api`
    : '/api';

  async isFundsWithdrawn(campaignAddress: string): Promise<boolean> {
    const res = await fetch(`${this.API_BASE}/funds`);

    const data = await res.json(); // читаем один раз

    console.log(res.status, data); // можно отлаживать здесь

    if (!res.ok) throw new Error('Failed to fetch funds events');

    return data.some((e: any) => e.campaignAddress.toLowerCase() === campaignAddress.toLowerCase());
  }

 

  async getFunds(): Promise<FundEvent[]> {
    try {
      const res = await fetch(`${this.API_BASE}/funds`);
      if (!res.ok) {
        throw new Error(`Failed to fetch funds: ${res.status}`);
      }
      return res.json();
    } catch (e) {
      console.error('FundsService.getFunds error', e);
      return [];
    }
  }  


  async getStatus(): Promise<FundsStatus | null> {
    try {
      const res = await fetch(`${this.API_BASE}/status`);
      if (!res.ok) {
        throw new Error(`Failed to fetch funds status: ${res.status}`);
      }
      const data = await res.json();
      return data.funds as FundsStatus;
    } catch (e) {
      console.error('FundsService.getStatus error', e);
      return null;
    }
  }
}

export const fundsService = new FundsService();
