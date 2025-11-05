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
    address: raw.id,
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

// 4️⃣ Базовый Graph URL
const GRAPH_URL =
  import.meta.env.VITE_GRAPHQL_API_URL ||
  "https://api.studio.thegraph.com/query/121375/fund-verse/v0.0.1";

// 5️⃣ Получить все кампании
export async function fetchCampaigns(): Promise<CampaignData[]> {
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

  return (data.campaignDatas as CampaignRawData[]).map(normalizeCampaign);
}

// 6️⃣ Получить кампанию по адресу
export async function fetchCampaignByAddress(address: string): Promise<CampaignData | null> {
  const query = `
    {
      campaignDatas(where: { id: "${address.toLowerCase()}" }) {
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

  const list = data?.campaignDatas as CampaignRawData[] | undefined;
  if (!list || list.length === 0) return null;

  return normalizeCampaign(list[0]);
}
