//проверочный
//скрипт для проверки соответствия флэт-контракта задеплоенному
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import solc from "solc";

dotenv.config();

const PROVIDER_URL = process.env.ALCHEMY_API_URL!;
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);

// === НАСТРОЙ ===
const CONTRACT_NAME = "CampaignNative"; // Имя контракта (без .sol)
const CONTRACT_FILE = "CampaignNative.sol"; // Имя файла во flattend/
const COMPILER_VERSION = "0.8.30"; // версия без commit
const ADDRESS = "0xcEcE852915bdF37eA780058861B621465469e3D6"; // адрес деплойнутого контракта
// ==============

// Читаем flatten-исходник
function readSource(): string {
  const filePath = path.join(__dirname, "../backend/verifyService/contracts/flattened", CONTRACT_FILE);  
  if (!fs.existsSync(filePath)) throw new Error(`Нет файла: ${filePath}`);
  return fs.readFileSync(filePath, "utf8");
}

// Сборка исходника solc
function compile(source: string): any {
  const input = {
    language: "Solidity",
    sources: {
      [CONTRACT_FILE]: { content: source },
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": {
          "*": ["evm.bytecode", "evm.deployedBytecode"],
        },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    for (const e of output.errors) {
      console.error(e.formattedMessage);
    }
  }

  return output.contracts[CONTRACT_FILE][CONTRACT_NAME];
}

async function main() {
  const source = readSource();
  const compiled = compile(source);

  const localBytecode = compiled.evm.deployedBytecode.object.toLowerCase();
  console.log("🔎 Local compiled bytecode length:", localBytecode.length);

  const onchainBytecode = (await provider.getCode(ADDRESS)).toLowerCase();
  console.log("🔎 Onchain deployed bytecode length:", onchainBytecode.length);

  if (localBytecode === onchainBytecode) {
    console.log("✅ Байткод совпадает!");
  } else if (onchainBytecode.startsWith(localBytecode)) {
    console.log("⚠️ Почти совпадает (разница только в metadata hash).");
  } else {
    console.log("❌ Несовпадение байткода.");
    console.log("Local (first 100 chars):", localBytecode.slice(0, 100));
    console.log("Onchain(first 100 chars):", onchainBytecode.slice(0, 100));
  }
}

main().catch(console.error);
