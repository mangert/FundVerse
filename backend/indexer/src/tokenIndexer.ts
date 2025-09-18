// индексер для отслеживания списка действующих токенов
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { saveState, loadState } from "./storage";

dotenv.config();

const PROVIDER_URL = process.env.PROVIDER_URL!;
const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS!;
const START_BLOCK = process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : undefined;
const CHUNK = 10n; //алхимия разрешает 10 блоков за запрос
const POLL_INTERVAL = 30_000;

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const platformIf = new ethers.Interface([
  "event FVNewTokenAdded(address token)",
  "event FVTokenRemoved(address token)"
]);

//интерфейс для собираемых данных
interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  status: boolean;
  addedAtBlock?: number;
  removedAtBlock?: number;
}

let tokens: Record<string, TokenInfo> = {};
let lastProcessedBlock: bigint = START_BLOCK ?? 0n;
let isRunning = false;

export async function initTokenIndexer() {
  if (isRunning) return;
  isRunning = true;

  const persisted = loadState();
  if (persisted?.tokens?.lastProcessedBlock) {
    lastProcessedBlock = BigInt(persisted.tokens.lastProcessedBlock);
    tokens = persisted.tokens.tokens || {};
    console.log("Loaded persisted token state. lastProcessedBlock=", lastProcessedBlock.toString());
  } else {
    const current = BigInt(await provider.getBlockNumber());
    lastProcessedBlock = START_BLOCK ?? (current > 2000n ? current - 2000n : 0n);
    console.log("Starting token index from block", lastProcessedBlock.toString());
  }

  await processRangeToLatest();

  setInterval(async () => {
    try {
      await processRangeToLatest();
    } catch (e) {
      console.error(e);
    }
  }, POLL_INTERVAL);
}

async function processRangeToLatest() {
  const current = BigInt(await provider.getBlockNumber());
  if (current <= lastProcessedBlock) return;

  let from = lastProcessedBlock + 1n;
  while (from <= current) {
    let to = from + CHUNK - 1n;
    if (to > current) to = current;

    console.log(`Fetching token logs ${from}..${to}`);

    const addEvent = platformIf.getEvent("FVNewTokenAdded");
    if (!addEvent) throw new Error("Event FVNewTokenAdded not found in ABI");
    const addTopic = addEvent.topicHash;

    const removeEvent = platformIf.getEvent("FVTokenRemoved");
    if (!removeEvent) throw new Error("Event FVTokenRemoved not found in ABI");
    const removeTopic = removeEvent.topicHash;

    try {
      const logs = await provider.getLogs({
        address: PLATFORM_ADDRESS,
        fromBlock: Number(from),
        toBlock: Number(to),
        topics: [[addTopic, removeTopic]]
      });

      for (const log of logs) {
        const parsed = platformIf.parseLog(log);
        if (!parsed) continue;

        if (parsed.name === "FVNewTokenAdded") {
          const token = parsed.args.token as string;
          try {
            const erc20 = new ethers.Contract(
              token,
              [
                "function symbol() view returns (string)",
                "function decimals() view returns (uint8)",
                "function name() view returns (string)"
              ],
              provider
            );

            const [symbol, decimals, name] = await Promise.all([
              erc20.symbol().catch(() => "UNKNOWN"),
              erc20.decimals().catch(() => 18),
              erc20.name().catch(() => "Unknown Token")
            ]);

            tokens[token.toLowerCase()] = {
              address: token,
              symbol,
              decimals: Number(decimals),
              name,
              status: true,
              addedAtBlock: log.blockNumber
            };

            console.log(`Token added: ${symbol} (${token})`);
          } catch (e) {
            console.error("Failed to fetch token info for", token, e);
            tokens[token.toLowerCase()] = {
              address: token,
              symbol: "UNKNOWN",
              decimals: 18,
              name: "Unknown",
              status: true,
              addedAtBlock: log.blockNumber
            };
          }
        } else if (parsed.name === "FVTokenRemoved") {
          const token = parsed.args.token as string;
          if (tokens[token.toLowerCase()]) {
            tokens[token.toLowerCase()].removedAtBlock = log.blockNumber;
            tokens[token.toLowerCase()].status = false;
          }
          console.log("Token removed:", token);
        }
      }
    } catch (e: any) {
      console.error("Error fetching token logs chunk", e.message || e);
      await new Promise((r) => setTimeout(r, 2000));
    }

    from = to + 1n;
    lastProcessedBlock = to;
    saveState({
      tokens: {
        lastProcessedBlock: lastProcessedBlock.toString(),
        tokens
      }
    });
  }
}

//функции для API
//функция возвращает данные о токенах
export function getTokens() {
  return Object.values(tokens);
}
//функция возвращает статус работы сервиса
export function getStatus() {
  return { lastProcessedBlock: lastProcessedBlock.toString(), count: Object.keys(tokens).length };
}
