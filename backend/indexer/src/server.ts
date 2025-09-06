import express from "express";
import cors from "cors";
import * as dotenv from "dotenv";
import { initEventIndexer, getCampaigns, getStatus as getEventStatus } from "./eventIndexer";
import { initTokenIndexer, getTokens, getStatus as getTokenStatus } from "./tokenIndexer";

dotenv.config();

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Инициализация индексеров (они стартуют обработку истории при инициализации)
  await initEventIndexer();
  await initTokenIndexer();

  // API
  app.get("/api/campaigns", (req, res) => {
    res.json(getCampaigns());
  });

  app.get("/api/tokens", (req, res) => {
    res.json(getTokens());
  });

  app.get("/api/status", (req, res) => {
    res.json({
      events: getEventStatus(),
      tokens: getTokenStatus()
    });
  });

  app.listen(PORT, () => {
    console.log(`Indexer listening on http://localhost:${PORT}`);
  });
}

main().catch((e) => {
  console.error("Indexer failed:", e);
  process.exit(1);
});
