import fs from "fs";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const ETHERSCAN_BASE_URL = process.env.ETHERSCAN_BASE_URL || "https://api.etherscan.io/v2/api";
//ETHERSCAN_BASE_URL=https://api.etherscan.io/v2/api?chainid=11155111
const CHAIN_ID = process.env.CHAIN_ID || "11155111"; // Sepolia по умолчанию

// Адрес деплойнутого контракта
const CONTRACT_ADDRESS = 0xcEcE852915bdF37eA780058861B621465469e3D6;

// Имя и путь к контракту внутри build-info
const CONTRACT_FILE = "contracts/modules/campaigns/CampaignNative.sol";
const CONTRACT_NAME = "CampaignNative";

async function main() {
  if (!ETHERSCAN_API_KEY) throw new Error("ETHERSCAN_API_KEY не задан");
  if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS не задан");

  // Находим последний build-info файл
  const buildInfoDir = path.join(__dirname, "../artifacts/build-info");
  const files = fs.readdirSync(buildInfoDir);
  if (files.length === 0) throw new Error("Нет build-info файлов");
  const buildInfoPath = path.join(buildInfoDir, files[files.length - 1]);

  const buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, "utf8"));
  const input = buildInfo.input;

  // Кодируем в строку (без форматирования!)
  const sourceCode = JSON.stringify(input);

  console.log("📤 Отправляем в Etherscan...");

  const params = {
    apikey: ETHERSCAN_API_KEY,
    module: "contract",
    action: "verifysourcecode",
    contractaddress: CONTRACT_ADDRESS,
    sourceCode,
    codeformat: "solidity-standard-json-input",
    contractname: `${CONTRACT_FILE}:${CONTRACT_NAME}`,
    compilerversion: `v${buildInfo.solcLongVersion}`, // например, v0.8.30+commit.73712a01
    optimizationUsed: buildInfo.input.settings.optimizer.enabled ? 1 : 0,
    runs: buildInfo.input.settings.optimizer.runs || 200,
  };

  const url = `${ETHERSCAN_BASE_URL}?chainid=${CHAIN_ID}`;

  const response = await axios.post(url, null, { params });

  console.log("🔎 Ответ от Etherscan:", response.data);
}

main().catch((err) => {
  console.error("❌ Ошибка:", err.message);
});
