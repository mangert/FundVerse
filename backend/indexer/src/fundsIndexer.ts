//индексер ловит вывод собранных средств
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { saveState, loadState } from "./storage";
import CampaignABI from "./abi/ICampaign.json";

dotenv.config();

const PROVIDER_URL = process.env.PROVIDER_URL!; //ключ Alchemy
const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS!; // адрес платформы
const START_BLOCK = process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : undefined;

const CHUNK = 10n; // Alchemy: максимум ~10 блоков в одном запросе — оставляем 10
const BATCH_ADDRESSES = 20; // сколько адресов кампаний отправлять в одном getLogs
const DELAY_BETWEEN_BATCHES_MS = 200; // пауза между батчами (throttling)
const POLL_INTERVAL = 30_000;
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 700;

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

const campaignIf = new ethers.Interface([
  "event CampaignFundsClaimed(address indexed recipient, uint256 amount)"
]);

type Campaign = {
  campaignAddress: string;
};

type FundsEvent = {
  campaignAddress: string;
  recipient: string;
  amount: string;
  txHash: string;
  blockNumber: string;
};

let campaigns: Campaign[] = [];
let fundsEvents: FundsEvent[] = [];
let lastProcessedBlock: bigint = START_BLOCK ?? 0n;
let processedCampaigns: Set<string> = new Set();
let isRunning = false;

export async function initFundsIndexer(existingCampaigns: Campaign[] = [], getCampaignsFn?: () => Campaign[]) {
  if (isRunning) return;
  isRunning = true;

  const persisted = loadState();
  if (persisted?.funds) {
    lastProcessedBlock = BigInt(persisted.funds.lastProcessedBlock || 0);
    fundsEvents = persisted.funds.events || [];
    processedCampaigns = new Set(persisted.funds.processedCampaigns || []);
    console.log(`[FundsIndexer] Loaded persisted state. lastProcessedBlock=${lastProcessedBlock.toString()}, processed=${processedCampaigns.size}`);
  } else {
    const current = BigInt(await provider.getBlockNumber());
    lastProcessedBlock = START_BLOCK ?? (current > 2000n ? current - 2000n : 0n);
    console.log(`[FundsIndexer] Starting indexer from block ${lastProcessedBlock.toString()}`);
  }

  // инициализация campaigns: приоритет — переданный snapshot, иначе пусто
  if (existingCampaigns && existingCampaigns.length > 0) {
    campaigns = existingCampaigns.slice();
    console.log(`[FundsIndexer] Initialized with ${campaigns.length} campaigns (snapshot)`);
  } else {
    campaigns = [];
  }

  // первый проход
  await processRangeToLatest(getCampaignsFn);

  // периодический рaн
  setInterval(async () => {
    try {
      await processRangeToLatest(getCampaignsFn);
    } catch (e) {
      console.error('[FundsIndexer] periodic error', e);
    }
  }, POLL_INTERVAL);
}

function chunkArray<T>(arr: T[], size: number) {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

async function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

function isAlchemyThroughputError(err: any) {
  const m = String(err?.message || '').toLowerCase();
  return m.includes('compute units') || m.includes('throughput') || err?.status === 429 || err?.code === 429;
}

async function fetchLogsWithRetries(filter: any) {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const logs = await provider.getLogs(filter);
      return logs;
    } catch (err: any) {
      // если это throughput/429 — ретраим с бэкoff, иначе пробиваем ошибку вверх
      if (isAlchemyThroughputError(err)) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        console.warn(`[FundsIndexer] throttled by provider (attempt ${attempt + 1}/${MAX_RETRIES}). Backoff ${delay}ms. msg=${err.message || err}`);
        await sleep(delay);
        continue;
      } else {
        // иные ошибки — пробрасываем (или логируем и ретраим по общей причине)
        console.error('[FundsIndexer] provider.getLogs error (non-throughput):', err);
        throw err;
      }
    }
  }
  // если все ретраи не помогли — бросаем ошибку
  throw new Error('Max retries exceeded for provider.getLogs');
}

async function processRangeToLatest(getCampaignsFn?: () => Campaign[]) {
  // обновляем список кампаний динамически
  if (getCampaignsFn) {
    try {
      const fresh = getCampaignsFn();
      if (Array.isArray(fresh) && fresh.length > 0) {
        // merge: не перезаписываем processedCampaigns
        campaigns = fresh.slice();
      }
    } catch (e) {
      console.warn('[FundsIndexer] getCampaignsFn failed, keeping previous campaigns list', e);
    }
  }

  const current = BigInt(await provider.getBlockNumber());
  if (current <= lastProcessedBlock) {
    // ничего нового
    return;
  }

  console.log(`[FundsIndexer] scanning blocks ${lastProcessedBlock + 1n} .. ${current} (current), campaigns=${campaigns.length}`);

  let from = lastProcessedBlock + 1n;
  while (from <= current) {
    let to = from + CHUNK - 1n;
    if (to > current) to = current;

    // список кампаний, для которых ещё не поймано событие
    const pendingCampaigns = campaigns
      .map(c => c.campaignAddress)
      .filter(addr => addr && !processedCampaigns.has(addr));

    if (pendingCampaigns.length === 0) {
      // если нет кампаний для отслеживания — просто продвинем lastProcessedBlock и выйдем
      console.log('[FundsIndexer] no pending campaigns to check; advancing block cursor');
      lastProcessedBlock = to;
      saveState({ funds: { lastProcessedBlock: lastProcessedBlock.toString(), events: fundsEvents, processedCampaigns: Array.from(processedCampaigns) } });
      from = to + 1n;
      continue;
    }

    // батчим адреса в группы (один вызов getLogs на группу адресов)
    const addressBatches = chunkArray(pendingCampaigns, BATCH_ADDRESSES);

    const eventFragment = campaignIf.getEvent("CampaignFundsClaimed");
    if (!eventFragment) {
      throw new Error("Event CampaignFundsClaimed not found in ABI");
    }
    const topicHash = eventFragment.topicHash;

    for (const batch of addressBatches) {
      const filter = {
        address: batch, // массив адресов
        fromBlock: Number(from),
        toBlock: Number(to),
        topics: [topicHash]
      };

      try {
        // центральный вызов с ретраем
        const logs = await fetchLogsWithRetries(filter);

        if (logs && logs.length > 0) {
          for (const log of logs) {
            // parseLog может кидать, поэтому оборачиваем
            let parsed;
            try {
              parsed = campaignIf.parseLog(log);
            } catch (e) {
              console.warn('[FundsIndexer] failed to parse log', e);
              continue;
            }
            if (!parsed) continue;

            const recipient = (parsed.args?.recipient as string) ?? '';
            const amount = (parsed.args?.amount?.toString?.() ?? '0');
            const txHash = log.transactionHash ?? '';
            const blockNumber = (log.blockNumber !== undefined && log.blockNumber !== null) ? BigInt(log.blockNumber).toString() : '';

            const campaignAddress = (log.address ?? batch[0]) as string;
            // guard
            if (!campaignAddress) continue;

            // если уже отмечен processed — пропускаем (защита от дубликатов)
            if (processedCampaigns.has(campaignAddress)) continue;

            fundsEvents.push({ campaignAddress, recipient, amount, txHash, blockNumber });
            processedCampaigns.add(campaignAddress);

            console.log(`[FundsIndexer] CampaignFundsClaimed captured: campaign=${campaignAddress} recipient=${recipient} amount=${amount} tx=${txHash}`);
          }
        }
      } catch (err: any) {
        console.error('[FundsIndexer] Error fetching funds logs chunk', err?.message ?? err);
        // при ошибке уже была логика в fetchLogsWithRetries; просто продолжаем (следующие батчи/чанки)
      }

      // throttling между батчами
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    } // end batches

    // закончились батчи для этого чанка
    from = to + 1n;
    lastProcessedBlock = to;

    // persist state
    saveState({
      funds: {
        lastProcessedBlock: lastProcessedBlock.toString(),
        events: fundsEvents,
        processedCampaigns: Array.from(processedCampaigns)
      }
    });

    // небольшая пауза между чанками
    await sleep(120);
  } // end while
}
//функции для API
//функция возращает данные о событиях вывода фондов
export function getFundsEvents() {
  return fundsEvents.slice().reverse();
}
//функция возвращает статус работы сервиса
export function getStatus() {
  return { lastProcessedBlock: lastProcessedBlock.toString(), count: fundsEvents.length, tracked: processedCampaigns.size };
}
