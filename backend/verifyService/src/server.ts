//работает через hardhat
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import dotenv from "dotenv";
import { CONTRACTS, PLATFORM_ADDRESS, PROVIDER_URL } from "./utils/setup";
import { runVerify } from "./utils/verify-util";
import { log } from "./logger";

dotenv.config();

// __dirname доступен в CommonJS — тут всё ок
const platformArtifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../artifacts/contracts/core/Platform.sol/Platform.json"), "utf8")
);
const CampaignETH = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../artifacts/contracts/modules/campaigns/CampaignNative.sol/CampaignNative.json"), "utf8")
);
const CampaignERC20 = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../artifacts/contracts/modules/campaigns/CampaignToken.sol/CampaignToken.json"), "utf8")
);

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const platform = new ethers.Contract(PLATFORM_ADDRESS, platformArtifact.abi, provider);

log("🚀 Verification server started. Listening for FVCampaignCreated...");

platform.on(
  "FVCampaignCreated",
  async (newCampaign: string, founder: string, token: string, goal: bigint) => {
    log(`🎉 Новая кампания: ${newCampaign} (token=${token})`);

    const isEth = token === "0x0000000000000000000000000000000000000000";
    const abi = isEth ? CampaignETH : CampaignERC20;
    const contractMeta = isEth ? CONTRACTS.native.name : CONTRACTS.token.name;

    try {
      const campaign = new ethers.Contract(newCampaign, abi.abi, provider);
      const summary = await campaign.getSummary();
      const fee = await campaign.platformFee();

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

      log(`⏳ Запуск верификации кампании ${newCampaign}`);
      await runVerify(newCampaign, constructorArgs, contractMeta);
    } catch (err: any) {
      log(`❌ Ошибка при обработке контракта ${newCampaign}: ${err.message}`);
    }
  }
);
