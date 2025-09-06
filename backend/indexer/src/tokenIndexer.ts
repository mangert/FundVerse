import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { saveState, loadState } from "./storage";

dotenv.config();

const PROVIDER_URL = process.env.PROVIDER_URL!;
const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS!;
const START_BLOCK = process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : undefined;
const CHUNK = 10n;
const POLL_INTERVAL = 30_000;

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const platformIf = new ethers.Interface([
  "event FVNewTokenAdded(address token)",
  "event FVTokenRemoved(address token)"
]);

let tokens: Record<string, any> = {};
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
    try { await processRangeToLatest(); } catch (e) { console.error(e); }
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
        topics: [[addTopic, removeTopic]], // любое из событий
      });

      for (const log of logs) {
        const parsed = platformIf.parseLog(log);
        if (!parsed) continue;

        if (parsed.name === "FVNewTokenAdded") {
          const token = parsed.args[0] as string;
          tokens[token.toLowerCase()] = { address: token, addedAtBlock: log.blockNumber };
          console.log("Token added:", token);
        } else if (parsed.name === "FVTokenRemoved") {
          const token = parsed.args[0] as string;
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
    saveState({ tokens: { lastProcessedBlock: lastProcessedBlock.toString(), tokens } });
  }
}

export function getTokens() {
  return Object.values(tokens);
}

export function getStatus() {
  return { lastProcessedBlock: lastProcessedBlock.toString(), count: Object.keys(tokens).length };
}
