import fs from "fs";
import path from "path";
import { ethers, run } from "hardhat";
import { readJsonSafe, writeJsonPretty, deriveNetworkName } from "./utils";

// Скрипт для деплоя и верификации программы лояльности
async function main() {
  const logPath = path.join(__dirname, "logs", "deploy-log.txt");

  const platformAddr = ""; // ⚠️ сюда подставить адрес Platform
  const [deployer] = await ethers.getSigners();

  console.log("Loyalty DEPLOYING...");
  const loyalty_Factory = await ethers.getContractFactory("FundVerseLoyaltyv1");
  const loyalty = await loyalty_Factory.deploy(deployer.address, platformAddr);
  await loyalty.waitForDeployment();
  const loyaltyAddr = await loyalty.getAddress();
  const txLoyalty = loyalty.deploymentTransaction();
  console.log("Loyalty NFT deployed at", loyaltyAddr);

  // Логируем в файл
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(
    logPath,
    `[${new Date().toISOString()}] Loyalty deployed at ${loyaltyAddr} by ${deployer.address}\n`
  );

  // Запись адреса во фронт
  const network = await ethers.provider.getNetwork();
  const networkName = deriveNetworkName(network.chainId, network.name);

  const addressesDir = path.join(__dirname, "../front/src/contracts");
  const outputPath = path.join(addressesDir, `addresses.${networkName}.json`);

  const frontAddresses = readJsonSafe<any>(outputPath, {});
  const mergedAddresses = {
    ...frontAddresses,
    loyaltyNFT: loyaltyAddr,
    deployer: deployer.address,
  };

  writeJsonPretty(outputPath, mergedAddresses);

  // Ждём подтверждений
  if (txLoyalty) await txLoyalty.wait(5);

  // Верификация
  try {
    await run("verify:verify", {
      address: loyaltyAddr,
      constructorArguments: [deployer.address, platformAddr],
    });
    console.log("Loyalty verified!");
  } catch (e: any) {
    if (e?.message?.toLowerCase?.().includes("already verified")) {
      console.log("Loyalty already verified.");
    } else {
      console.error("Loyalty verification failed:", e);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
