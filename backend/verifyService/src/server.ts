//обновленная версия
import { ethers } from "ethers";
import axios from "axios";
import * as dotenv from "dotenv";
import fs from "fs";
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

// Функция верификации
async function verifyContract(
  address: string,
  contractName: string,
  inputJson: any,
  constructorArgs: any[]
) {
  try {
    log(`📡 Верификация контракта: ${address} (${contractName})`);

    const payload = {
      apikey: ETHERSCAN_API_KEY,
      module: "contract",
      action: "verifysourcecode",
      contractaddress: address,
      sourceCode: JSON.stringify(inputJson),
      codeformat: "solidity-standard-json-input",
      contractname: contractName,
      compilerversion: COMPILER_VERSION,
      optimizationUsed: 1,
      runs: 200,
      constructorArguements: constructorArgs
        .map((a) => ethers.AbiCoder.defaultAbiCoder().encode([typeof a], [a]))
        .join(""),
    };

    const response = await axios.post("https://api.etherscan.io/api", null, {
      params: payload,
    });

    log(`✅ Ответ от Etherscan: ${JSON.stringify(response.data)}`);
  } catch (err: any) {
    log(`❌ Ошибка верификации ${address}: ${err.message}`);
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
    log(`ℹ️ Summary: ${JSON.stringify(summary)}`);

    const constructorArgs = [
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

    await verifyContract(newCampaign, contractName, inputJson, constructorArgs);
  }
);

log("🚀 Verification server started. Listening for FVCampaignCreated...");