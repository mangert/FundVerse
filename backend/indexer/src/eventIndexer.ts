import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { saveState, loadState } from "./storage";
import CampaignABI from "./abi/ICampaign.json";

dotenv.config();

const PROVIDER_URL = process.env.PROVIDER_URL!;
const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS!;
const START_BLOCK = process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : undefined;
const CHUNK = 10n; 
const DELAY_MS = 300; 
const POLL_INTERVAL = 30_000;

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const platformIf = new ethers.Interface([
  "event FVCampaignCreated(address indexed NewCampaignAddress, address indexed founder, address indexed token, uint256 goal)"
]);

let campaigns: any[] = [];
let lastProcessedBlock: bigint = START_BLOCK ?? 0n;
let isRunning = false;

export async function initEventIndexer() {
  if (isRunning) return;
  isRunning = true;

  const persisted = loadState();
  if (persisted?.events?.lastProcessedBlock) {
    lastProcessedBlock = BigInt(persisted.events.lastProcessedBlock);
    campaigns = persisted.events.campaigns || [];
    console.log("Loaded persisted event state. lastProcessedBlock=", lastProcessedBlock.toString());
  } else {
    const current = BigInt(await provider.getBlockNumber());
    lastProcessedBlock = START_BLOCK ?? (current > 2000n ? current - 2000n : 0n);
    console.log("Starting event index from block", lastProcessedBlock.toString());
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

export function getCampaigns() {
  return campaigns.slice().reverse(); 
}

export function getStatus() {
  return { lastProcessedBlock: lastProcessedBlock.toString(), count: campaigns.length };
}
