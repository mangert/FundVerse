import fs from "fs";
import path from "path";
import { ethers, run, upgrades } from "hardhat";
import {
  readJsonSafe,
  writeJsonPretty,
  deriveNetworkName,
  updateEnv,
} from "./utils";

// Скрипт для деплоя и верификации платформы
async function main() {
  const logPath = path.join(__dirname, "logs", "deploy-log.txt");

  const contractName = "Platform";
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  // --- Деплой фабрики ---
  console.log("Factory DEPLOYING...");
  const factory_Factory = await ethers.getContractFactory("FactoryCore");
  const factory = await factory_Factory.deploy({});
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("Factory deployed at", factoryAddr);
  const txFactory = factory.deploymentTransaction();
  if (txFactory) {
    console.log("⏳ Waiting for Factory confirmations...");
    await txFactory.wait(5);
  }

  // --- Деплой платформы через прокси ---
  console.log("Platform DEPLOYING...");
  const platform_Fabric = await ethers.getContractFactory("Platform");
  const platform = await upgrades.deployProxy(platform_Fabric, [factoryAddr], {
    kind: "uups",    
  });
  await platform.waitForDeployment();
  const platformAddr = await platform.getAddress();
  console.log("Platform proxy deployed at", platformAddr);
  const txPlatform = platform.deploymentTransaction();
  if (txPlatform) {
    console.log("⏳ Waiting for Platform confirmations...");
    await txPlatform.wait(5);
  }

  // --- Логируем ---
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(
    logPath,
    `[${new Date().toISOString()}] Factory deployed at ${factoryAddr} by ${deployer.address}\n`
  );
  fs.appendFileSync(
    logPath,
    `[${new Date().toISOString()}] ${contractName} proxy deployed at ${platformAddr} by ${deployer.address}\n`
  );

  // --- Записываем адреса во фронт ---
  const network = await ethers.provider.getNetwork();
  const networkName = deriveNetworkName(network.chainId, network.name);

  const addressesDir = path.join(__dirname, "../front/src/contracts");
  const outputPath = path.join(addressesDir, `addresses.${networkName}.json`);

  const frontAddresses = readJsonSafe<any>(outputPath, {});
  const mergedAddresses = {
    ...frontAddresses,
    platform: platformAddr,
    deployer: deployer.address,
    factory: factoryAddr,
  };

  writeJsonPretty(outputPath, mergedAddresses);

  // --- Запись в .env бэка ---
  const backendEnvPath = path.join(__dirname, "../backend/.env");
  updateEnv(backendEnvPath, "PLATFORM_ADDRESS", platformAddr);
  updateEnv(backendEnvPath, "FACTORY_ADDRESS", factoryAddr);

  // --- Верификация фабрики ---
  try {
    await run("verify:verify", { address: factoryAddr });
    console.log("Factory verified!");
  } catch (e: any) {
    if (e?.message?.toLowerCase?.().includes("already verified")) {
      console.log("Factory already verified.");
    } else {
      console.error("Factory verification failed:", e);
    }
  }

  // --- Верификация implementation ---
  try {
    const implAddr = await upgrades.erc1967.getImplementationAddress(
      platformAddr
    );
    console.log("Implementation address:", implAddr);

    try {
      console.log("Verifying implementation...");
      await run("verify:verify", {
        address: implAddr,
      });
      console.log("Implementation verified!");
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes("already verified")) {
        console.log("Implementation already verified.");
      } else {
        console.error("Implementation verification failed:", err);
      }
    }

    // --- Верификация proxy (опционально) ---
    try {
      console.log("Verifying proxy (ERC1967Proxy)...");
      await run("verify:verify", {
        address: platformAddr,
        contract:
          "contracts/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy",
        constructorArguments: [implAddr, "0x"], // init data = "0x" (initialize вызывался через deployProxy)
      });
      console.log("Proxy verified/linked!");
    } catch (err: any) {
      if (err?.message?.toLowerCase?.().includes("already verified")) {
        console.log("Proxy already verified.");
      } else {
        console.warn(
          "Proxy verification failed (можно сделать руками в Etherscan):",
          err.message || err
        );
      }
    }
  } catch (errAny: any) {
    console.error("Error while verifying implementation/proxy:", errAny);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
