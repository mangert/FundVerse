// CampaignsService.ts

// 1️⃣ "Сырой" формат — строго то, что приходит из Graph
interface CampaignRawData {
  id: string;
  campaignId: string;
  creator: string;
  goal: string;
  raised: string;
  deadline: string;
  token: string;
  campaignMeta: string;
  status: number;
  isFundsWithdrawn: boolean;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
}

// 2️⃣ "Нормализованный" формат — то, с чем работает UI
export interface CampaignData {
  address: string;              // alias для id
  campaignId: bigint;
  creator: string;
  goal: bigint;
  raised: bigint;
  deadline: bigint;
  token: string;
  campaignMeta: string;
  status: number;
  isFundsWithdrawn: boolean;
  blockNumber: bigint;
  blockTimestamp: bigint;
  transactionHash: string;
}

// 3️⃣ Преобразователь: Raw → нормализованный
function normalizeCampaign(raw: CampaignRawData): CampaignData {
  return {
    address: raw.id, // id в Graph — это адрес кампании
    campaignId: BigInt(raw.campaignId),
    creator: raw.creator,
    goal: BigInt(raw.goal),
    raised: BigInt(raw.raised),
    deadline: BigInt(raw.deadline),
    token: raw.token,
    campaignMeta: raw.campaignMeta,
    status: Number(raw.status),
    isFundsWithdrawn: Boolean(raw.isFundsWithdrawn),
    blockNumber: BigInt(raw.blockNumber),
    blockTimestamp: BigInt(raw.blockTimestamp),
    transactionHash: raw.transactionHash,
  };
}

// 4️⃣ Основная функция: fetch + нормализация
export async function fetchCampaigns(): Promise<CampaignData[]> {  
  const GRAPH_URL = import.meta.env.VITE_GRAPHQL_API_URL ||
      "https://api.studio.thegraph.com/query/121375/fund-verse/v0.0.1";
  
  
  const query = `
    {
      campaignDatas(orderBy: blockTimestamp, orderDirection: desc) {
        id
        campaignId
        creator
        goal
        raised
        deadline
        token
        campaignMeta
        status
        isFundsWithdrawn
        blockNumber
        blockTimestamp
        transactionHash
      }
    }
  `;

  const res = await fetch(GRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const { data, errors } = await res.json();
  if (errors) throw new Error(JSON.stringify(errors));

  // data.campaignDatas — массив "сырых" объектов
  return (data.campaignDatas as CampaignRawData[]).map(normalizeCampaign);
}