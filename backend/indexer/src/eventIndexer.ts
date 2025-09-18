//индексер ловит события создания кампаний
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { saveState, loadState } from "./storage";
import CampaignABI from "./abi/ICampaign.json";

dotenv.config();

const PROVIDER_URL = process.env.PROVIDER_URL!; // ключ Alchemy
const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS!; // адрес платформы
const START_BLOCK = process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : undefined; //берем блок деплоя контракта платформы
const CHUNK = 10n; // алхимия разрешает 10 блоков за запрос
const DELAY_MS = 300;  // задержка между запросами
const POLL_INTERVAL = 30_000; //интервал опроса

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const platformIf = new ethers.Interface([
  "event FVCampaignCreated(address indexed NewCampaignAddress, address indexed founder, address indexed token, uint256 goal)"
]);

let campaigns: any[] = []; //список кампаний
let lastProcessedBlock: bigint = START_BLOCK ?? 0n;
let isRunning = false;

//функция инициализации
export async function initEventIndexer() {
  if (isRunning) return;
  isRunning = true;

  const persisted = loadState(); //считываем данные из хранилища
  if (persisted?.events?.lastProcessedBlock) {
    lastProcessedBlock = BigInt(persisted.events.lastProcessedBlock);
    campaigns = persisted.events.campaigns || []; // забираем список кампаний
    console.log("Loaded persisted event state. lastProcessedBlock=", lastProcessedBlock.toString());
  } else {
    const current = BigInt(await provider.getBlockNumber());
    lastProcessedBlock = START_BLOCK ?? (current > 2000n ? current - 2000n : 0n); // запоминаем последний обработанный блок
    console.log("Starting event index from block", lastProcessedBlock.toString());
  }

  await processRangeToLatest(); //первый проход

  setInterval(async () => { //периодическая обработка
    try { await processRangeToLatest(); } catch (e) { console.error(e); }
  }, POLL_INTERVAL);
}

//функция обработки данных
async function processRangeToLatest() {
  const current = BigInt(await provider.getBlockNumber());
  if (current <= lastProcessedBlock) return;

  //формируем интервал обрабатываемых блоков
  let from = lastProcessedBlock + 1n;
  while (from <= current) {
    let to = from + CHUNK - 1n;
    if (to > current) to = current;
    console.log(`Fetching logs ${from}..${to}`);

    const event = platformIf.getEvent("FVCampaignCreated");
    if (!event) throw new Error("Event FVCampaignCreated not found in ABI");
    const topic = event.topicHash; 

    const filter = {
      address: PLATFORM_ADDRESS,
      fromBlock: Number(from),
      toBlock: Number(to),
      topics: [topic]
    };

    //считываем логи и забираем данные
    try {
      const logs = await provider.getLogs(filter);
      for (const log of logs) {
        const parsed = platformIf.parseLog(log);
        if (!parsed) continue; 

        const newCampaign = parsed.args[0] as string;
        const founder = parsed.args[1] as string;
        const token = parsed.args[2] as string;
        const goal = parsed.args[3].toString();
        const txHash = log.transactionHash;
        const blockNumber = BigInt(log.blockNumber);
        console.log("Found campaign:", newCampaign);

        //считываем данные из пойманной кампании
        let summary = null;
        try {
          const campaignContract = new ethers.Contract(newCampaign, CampaignABI, provider);
          const s = await campaignContract.getSummary();
          summary = {
            creator: s[0],
            id: Number(s[1]),
            token: s[2],
            goal: s[3].toString(),
            raised: s[4].toString(),
            deadline: Number(s[5]),
            campaignMeta: s[6],
            status: Number(s[7]),
          };
        } catch (e) {
          console.warn("Failed to read getSummary for", newCampaign, e);
        }

        //записываем кампанию в список
        campaigns.push({
          campaignAddress: newCampaign,
          founder,
          token,
          goal,
          txHash,
          blockNumber: blockNumber.toString(),
          summary
        });
      }

      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (e: any) {
      console.error("Error fetching logs chunk", e.message || e);
      await new Promise(r => setTimeout(r, 2000));
    }

    from = to + 1n;
    lastProcessedBlock = to;
    saveState({ events: { lastProcessedBlock: lastProcessedBlock.toString(), campaigns } });
  }
}

//функции для API
//функция возвращает кампании
export function getCampaigns() {
  return campaigns.slice().reverse(); 
}

//функция возвращает статус работы сервиса
export function getStatus() {
  return { lastProcessedBlock: lastProcessedBlock.toString(), count: campaigns.length };
}
