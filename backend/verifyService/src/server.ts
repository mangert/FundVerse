//в разработке
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

// Проверяем, доступен ли контракт на Etherscan
async function isContractVerifiedOnEtherscan(address: string): Promise<boolean> {
  try {
    const response = await axios.get("https://api.etherscan.io/api", {
      params: {
        apikey: ETHERSCAN_API_KEY,
        module: "contract",
        action: "getsourcecode",
        address: address,
      },
      timeout: 10000,
    });
    
    return response.data.status === "1" && response.data.result[0].SourceCode !== "";
  } catch (error : any) {
    log(`❌ Ошибка при проверке статуса верификации: ${error.message}`);
    return false;
  }
}

// Функция верификации с повторными попытками
async function verifyContractWithRetry(
  address: string,
  contractName: string,
  inputJson: any,
  constructorArgs: any[],
  abi: any[],
  maxAttempts = 5,
  initialDelay = 300000 // 5 минут
) {
  let attempt = 1;
  let delayMs = initialDelay;

  while (attempt <= maxAttempts) {
    try {
      log(`⏳ Попытка ${attempt}/${maxAttempts}. Ожидаем ${delayMs/1000} секунд...`);
      await delay(delayMs);

      // Проверяем, доступен ли контракт на Etherscan
      const isVerified = await isContractVerifiedOnEtherscan(address);
      if (isVerified) {
        log(`✅ Контракт уже верифицирован на Etherscan`);
        return;
      }

      log(`📡 Пытаемся верифицировать контракт: ${address} (${contractName})`);

      const constructorTypes = getConstructorTypes(abi);
      const encodedArgs = encodeConstructorArgs(constructorTypes, constructorArgs);

      // Форматируем имя контракта для Etherscan (filename.sol:contractname)
      const etherscanContractName = `${contractName}.sol:${contractName}`;

      const payload = {
        apikey: ETHERSCAN_API_KEY,
        module: "contract",
        action: "verifysourcecode",
        contractaddress: address,
        sourceCode: safeStringify(inputJson),
        codeformat: "solidity-standard-json-input",
        contractname: etherscanContractName,
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
        return;
      } else {
        log(`❌ Etherscan вернул ошибку: ${response.data.result}`);
        
        // Если это ошибка "Contract source code already verified", выходим
        if (response.data.result.includes("already verified")) {
          log(`✅ Контракт уже верифицирован`);
          return;
        }
      }
    } catch (err: any) {
      log(`❌ Ошибка верификации ${address} (попытка ${attempt}): ${err.message}`);
      if (err.response) {
        log(`❌ Детали ошибки: ${JSON.stringify(err.response.data)}`);
      }
    }
    
    // Увеличиваем задержку для следующей попытки (экспоненциальная backoff-стратегия)
    delayMs *= 2;
    attempt++;
  }
  
  log(`❌ Все попытки верификации не удались для контракта ${address}`);
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

    // Запускаем верификацию с повторными попытками
    await verifyContractWithRetry(newCampaign, contractName, inputJson, constructorArgs, abi);
  }
);

log("🚀 Verification server started. Listening for FVCampaignCreated...");