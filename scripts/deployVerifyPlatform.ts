import fs from "fs";
import path from "path";
import { ethers, run, upgrades } from "hardhat";
import {
  readJsonSafe,
  writeJsonPretty,
  deriveNetworkName,
  updateEnv,
} from "./utils";

// --- Основной скрипт ---
async function main() {
  const logPath = path.join(__dirname, "logs", "deploy-log.txt");
  const contractName = "Platform";
  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying contracts with account:", deployer.address);

  // ======================================================
  // 1️⃣ Деплой фабрики
  // ======================================================
  console.log("\n🏗️  Factory DEPLOYING...");
  const factory_Factory = await ethers.getContractFactory("FactoryCore");
  const factory = await factory_Factory.deploy({});
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("✅ Factory deployed at:", factoryAddr);

  const txFactory = factory.deploymentTransaction();
  if (txFactory) {
    console.log("⏳ Waiting for Factory confirmations...");
    await txFactory.wait(5);
  }

  // --- Получаем адреса имплементаций из фабрики ---
  const implNative = await factory.implementationNative();
  const implToken = await factory.implementationToken();

  console.log("\n🔍 Implementations created by Factory:");
  console.log("   • CampaignNative:", implNative);
  console.log("   • CampaignToken :", implToken);

  // ======================================================
  // 2️⃣ Деплой платформы через прокси
  // ======================================================
  console.log("\n🏗️  Platform DEPLOYING...");
  const platform_Fabric = await ethers.getContractFactory("Platform");
  const platform = await upgrades.deployProxy(platform_Fabric, [factoryAddr], {
    kind: "uups",
  });
  await platform.waitForDeployment();
  const platformAddr = await platform.getAddress();
  console.log("✅ Platform proxy deployed at:", platformAddr);

  const txPlatform = platform.deploymentTransaction();
  if (txPlatform) {
    console.log("⏳ Waiting for Platform confirmations...");
    await txPlatform.wait(5);
  }

  // ======================================================
  // 3️⃣ Логирование
  // ======================================================
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(
    logPath,
    `[${new Date().toISOString()}] Factory deployed at ${factoryAddr} by ${deployer.address}\n`
  );
  fs.appendFileSync(
    logPath,
    `[${new Date().toISOString()}] ${contractName} proxy deployed at ${platformAddr} by ${deployer.address}\n`
  );

  // ======================================================
  // 4️⃣ Запись адресов во фронт и .env
  // ======================================================
  const network = await ethers.provider.getNetwork();
  const networkName = deriveNetworkName(network.chainId, network.name);

  const addressesDir = path.join(__dirname, "../front/src/contracts");
  const outputPath = path.join(addressesDir, `addresses.${networkName}.json`);

  const frontAddresses = readJsonSafe<any>(outputPath, {});
  const mergedAddresses = {
    ...frontAddresses,
    deployer: deployer.address,
    factory: factoryAddr,
    platform: platformAddr,
    campaignNative: implNative,
    campaignToken: implToken,
  };

  writeJsonPretty(outputPath, mergedAddresses);

  const backendEnvPath = path.join(__dirname, "../backend/.env");
  updateEnv(backendEnvPath, "PLATFORM_ADDRESS", platformAddr);
  updateEnv(backendEnvPath, "FACTORY_ADDRESS", factoryAddr);

  // ======================================================
  // 5️⃣ Верификация фабрики и её имплементаций
  // ======================================================
  for (const [name, address] of [
    ["CampaignNative", implNative],
    ["CampaignToken", implToken],
  ]) {
    try {
      console.log(`\n🔍 Verifying ${name} at ${address}...`);
      await run("verify:verify", { address });
      console.log(`✅ ${name} verified!`);
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes("already verified")) {
        console.log(`ℹ️  ${name} already verified.`);
      } else {
        console.warn(`⚠️  ${name} verification failed:`, err.message || err);
      }
    }
  }

  try {
    console.log("\n🔍 Verifying FactoryCore...");
    await run("verify:verify", { address: factoryAddr });
    console.log("✅ Factory verified!");
  } catch (e: any) {
    if (e?.message?.toLowerCase?.().includes("already verified")) {
      console.log("ℹ️  Factory already verified.");
    } else {
      console.error("❌ Factory verification failed:", e);
    }
  }

  // ======================================================
  // 6️⃣ Верификация Platform (implementation + proxy)
  // ======================================================
  try {
    const implAddr = await upgrades.erc1967.getImplementationAddress(platformAddr);
    console.log("\n🔍 Platform implementation address:", implAddr);

    try {
      console.log("Verifying Platform implementation...");
      await run("verify:verify", { address: implAddr });
      console.log("✅ Platform implementation verified!");
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes("already verified")) {
        console.log("ℹ️  Implementation already verified.");
      } else {
        console.error("❌ Implementation verification failed:", err);
      }
    }

    try {
      console.log("Verifying Platform proxy (ERC1967Proxy)...");
      await run("verify:verify", {
        address: platformAddr,
        contract:
          "contracts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
        constructorArguments: [implAddr, "0x"],
      });
      console.log("✅ Proxy verified/linked!");
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes("already verified")) {
        console.log("ℹ️  Proxy already verified.");
      } else {
        console.warn("⚠️  Proxy verification failed:", err.message || err);
      }
    }
  } catch (errAny: any) {
    console.error("❌ Error while verifying implementation/proxy:", errAny);
  }

  console.log("\n🎉 Deployment and verification completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
