import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
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

// Читаем flat-контракт из файла
function readFlatContract(contractName: string): string {
  try {
    const flatContractsDir = path.join(__dirname, "../contracts/flattened");
    const contractPath = path.join(flatContractsDir, `${contractName}.sol`);
    
    // Проверяем существование файла
    if (!fs.existsSync(contractPath)) {
      throw new Error(`Flat contract file not found: ${contractPath}`);
    }

    // Читаем и возвращаем содержимое
    return fs.readFileSync(contractPath, "utf8");
  } catch (error : any) {
    log(`❌ Error reading flat contract: ${error.message}`);
    throw error;
  }
}

// Проверяем, доступен ли контракт на Etherscan
async function isContractVerifiedOnEtherscan(address: string): Promise<boolean> {
  try {
    const response = await axios.get("https://api.etherscan.io/v2/api?chainid=11155111", {
      params: {
        apikey: ETHERSCAN_API_KEY,
        module: "contract",
        action: "getsourcecode",
        address: address,
      },
      timeout: 10000,
    });
    
    return response.data.status === "1" && 
           response.data.result[0]?.SourceCode !== "" &&
           response.data.result[0]?.SourceCode !== undefined;
  } catch (error : any) {
    log(`❌ Ошибка при проверке статуса верификации: ${error.message}`);
    return false;
  }
}

// Функция верификации с использованием flat-контракта
async function verifyContract(
  address: string,
  contractName: string,
  constructorArgs: any[],
  abi: any[]
) {
  try {
    log(`📡 Верификация контракта: ${address} (${contractName})`);

    // Читаем flat-версию контракта из файла
    const flattenedCode = readFlatContract(contractName);
    
    const constructorTypes = getConstructorTypes(abi);
    const encodedArgs = encodeConstructorArgs(constructorTypes, constructorArgs);

    const payload = {
      apikey: ETHERSCAN_API_KEY,
      module: "contract",
      action: "verifysourcecode",
      contractaddress: address,
      sourceCode: flattenedCode,
      codeformat: "solidity-flattened-source-code", // Правильный формат для flatten-контрактов
      contractname: path.basename(contractName, ".sol"), // Только имя без расширения
      compilerversion: COMPILER_VERSION,
      optimizationUsed: 1,
      runs: 200,
      constructorArguements: encodedArgs.replace(/^0x/, ""),
    };

    // Используем FormData вместо query-параметров
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      formData.append(key, value as string);
    }

    const response = await axios.post("https://api.etherscan.io/api", formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    });

    log(`✅ Ответ от Etherscan: ${safeStringify(response.data)}`);
    
    if (response.data.status === "1") {
      log(`✅ Верификация отправлена успешно. GUID: ${response.data.result}`);
      
      // Проверяем статус верификации через некоторое время
      await delay(60000); // 30 секунд
      const isVerified = await isContractVerifiedOnEtherscan(address);
      
      if (isVerified) {
        log(`✅ Контракт успешно верифицирован на Etherscan`);
      } else {
        log(`⚠️ Верификация отправлена, но контракт еще не верифицирован`);
      }
    } else {
      log(`❌ Etherscan вернул ошибку: ${response.data.result}`);
      
      // Детальный анализ ошибки
      if (response.data.result.includes("Already Verified")) {
        log(`ℹ️ Контракт уже верифицирован`);
      } else if (response.data.result.includes("Max rate limit reached")) {
        log(`⚠️ Превышен лимит запросов к Etherscan API`);
      }
    }
  } catch (err: any) {
    log(`❌ Ошибка верификации ${address}: ${err.message}`);
    if (err.response) {
      log(`❌ Детали ошибки: ${JSON.stringify(err.response.data)}`);
    }
  }
}

// Функция верификации с повторными попытками
async function verifyContractWithRetry(
  address: string,
  contractName: string,
  constructorArgs: any[],
  abi: any[],
  maxAttempts = 5,
  initialDelay = 60000 // 30 секунд
) {
  let attempt = 1;
  let delayMs = initialDelay;

  // Сначала проверяем, не верифицирован ли уже контракт
  const isVerified = await isContractVerifiedOnEtherscan(address);
  if (isVerified) {
    log(`✅ Контракт ${address} уже верифицирован`);
    return;
  }

  while (attempt <= maxAttempts) {
    try {
      log(`⏳ Попытка ${attempt}/${maxAttempts} верификации контракта ${address}`);
      
      await verifyContract(address, contractName, constructorArgs, abi);
      
      // Проверяем успешность верификации
      const isVerifiedNow = await isContractVerifiedOnEtherscan(address);
      if (isVerifiedNow) {
        log(`✅ Контракт успешно верифицирован после попытки ${attempt}`);
        return;
      }
      
      // Увеличиваем задержку для следующей попытки
      delayMs *= 2;
      attempt++;
      
      if (attempt <= maxAttempts) {
        log(`⏳ Ожидаем ${delayMs/1000} секунд перед следующей попыткой...`);
        await delay(delayMs);
      }
    } catch (err: any) {
      log(`❌ Ошибка верификации ${address} (попытка ${attempt}): ${err.message}`);
      
      // Увеличиваем задержку для следующей попытки
      delayMs *= 2;
      attempt++;
      
      if (attempt <= maxAttempts) {
        log(`⏳ Ожидаем ${delayMs/1000} секунд перед следующей попыткой...`);
        await delay(delayMs);
      }
    }
  }
  
  log(`❌ Все ${maxAttempts} попытки верификации не удались для контракта ${address}`);
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

    try {
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

      // Запускаем верификацию с повторными попытками
      await verifyContractWithRetry(newCampaign, contractName, constructorArgs, abi);
    } catch (error: any) {
      log(`❌ Ошибка при обработке контракта ${newCampaign}: ${error.message}`);
    }
  }
);

log("🚀 Verification server started. Listening for FVCampaignCreated...");