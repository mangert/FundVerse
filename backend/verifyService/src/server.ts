//в разработке - не доделано!
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import platformArtifact from "../artifacts/contracts/core/Platform.sol/Platform.json";
import CampaignETH from "../artifacts/contracts/modules/campaigns/CampaignNative.sol/CampaignNative.json";
import CampaignERC20 from "../artifacts/contracts/modules/campaigns/CampaignToken.sol/CampaignToken.json";
import { CONTRACTS, PLATFORM_ADDRESS, PROVIDER_URL } from "./utils/setup";
import { runVerify } from "./utils/verify-util";
import { log } from "./logger";

dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
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
