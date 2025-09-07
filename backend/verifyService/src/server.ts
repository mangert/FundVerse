import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";
import CampaignETH from "../contracts-data/CampaignNative.abi.json";
import CampaignERC20 from "../contracts-data/CampaignToken.abi.json";
import platformAbi from "../contracts-data/Platform.abi.json";
import { getCompilerInput } from "./hardhat-reader";
import { log } from "./logger";

dotenv.config();

const PROVIDER_URL = process.env.PROVIDER_URL!;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY!;
const PLATFORM_ADDRESS = process.env.PLATFORM_ADDRESS!;
const COMPILER_VERSION = "v0.8.30+commit.73712a01";

// Подключение к провайдеру
const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const platform = new ethers.Contract(PLATFORM_ADDRESS, platformAbi, provider);

// Функция задержки
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Безопасный JSON.stringify (BigInt → string)
function safeStringify(obj: any) {
  return JSON.stringify(obj, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

// Получаем список типов конструктора из ABI
function getConstructorTypes(abi: any[]): string[] {
  const constructorAbi = abi.find((item: any) => item.type === "constructor");
  if (!constructorAbi) return [];
  return constructorAbi.inputs.map((input: any) => input.type);
}

// Кодируем аргументы конструктора
function encodeConstructorArgs(types: string[], values: any[]): string {
  return ethers.AbiCoder.defaultAbiCoder().encode(
    types,
    values.map(v =>
      typeof v === "bigint" ? v.toString() : v
    )
  );
}

// Функция верификации
async function verifyContract(
  address: string,
  contractName: string,
  inputJson: any,
  constructorArgs: any[],
  abi: any[]
) {
  try {
    log(`📡 Верификация контракта: ${address} (${contractName})`);

    const constructorTypes = getConstructorTypes(abi);
    const encodedArgs = encodeConstructorArgs(constructorTypes, constructorArgs);

    const payload = {
      apikey: ETHERSCAN_API_KEY,
      module: "contract",
      action: "verifysourcecode",
      contractaddress: address,
      sourceCode: safeStringify(inputJson),
      codeformat: "solidity-standard-json-input",
      contractname: contractName,
      compilerversion: COMPILER_VERSION,
      optimizationUsed: 1,
      runs: 200,
      constructorArguements: encodedArgs.replace(/^0x/, ""),
    };

    // Используем FormData вместо query-параметров для избежания ошибки 414
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      formData.append(key, value as string);
    }

    const response = await axios.post("https://api.etherscan.io/api", formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000, // Увеличиваем таймаут
    });

    log(`✅ Ответ от Etherscan: ${safeStringify(response.data)}`);
    
    // Проверяем статус ответа от Etherscan
    if (response.data.status === "0") {
      log(`❌ Etherscan вернул ошибку: ${response.data.result}`);
    } else {
      log(`✅ Верификация отправлена успешно. GUID: ${response.data.result}`);
    }
  } catch (err: any) {
    log(`❌ Ошибка верификации ${address}: ${err.message}`);
    if (err.response) {
      log(`❌ Детали ошибки: ${JSON.stringify(err.response.data)}`);
    }
  }
}

// Обработчик события
platform.on(
  "FVCampaignCreated",
  async (
    newCampaign: string,
    founder: string,
    token: string,
    goal: bigint
  ) => {
    log(`🎉 Новая кампания: ${newCampaign} (token=${token})`);

    const isEth = token === ethers.ZeroAddress;
    const abi = isEth ? CampaignETH : CampaignERC20;
    const contractName = isEth ? "CampaignNative" : "CampaignToken";

    const campaign = new ethers.Contract(newCampaign, abi, provider);
    const summary = await campaign.getSummary();
    const fee = await campaign.platformFee();

    log(`ℹ️ Summary: ${safeStringify(summary)}`);

    // Формируем аргументы конструктора в зависимости от типа кампании
    const constructorArgs = isEth
      ? [
          PLATFORM_ADDRESS,
          summary._creator,
          summary._id,
          summary._goal,
          summary._deadline,
          summary._campaignMeta,
          fee,
        ]
      : [
          PLATFORM_ADDRESS,
          summary._creator,
          summary._id,
          summary._goal,
          summary._deadline,
          summary._campaignMeta,
          fee,
          summary._token,
        ];

    const inputJson = getCompilerInput(contractName);

    // Добавляем задержку в 60 секунд перед верификацией
    log(`⏳ Ожидаем 60 секунд перед верификацией...`);
    await delay(60000);

    await verifyContract(newCampaign, contractName, inputJson, constructorArgs, abi);
  }
);

log("🚀 Verification server started. Listening for FVCampaignCreated...");