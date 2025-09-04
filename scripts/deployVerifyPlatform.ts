import fs from "fs";
import path from "path";
import { ethers, run, upgrades } from "hardhat";
import { readJsonSafe, writeJsonPretty, deriveNetworkName, updateEnv } from "./utils";

// Скрипт для деплоя и верификации платформы
async function main() {
  const logPath = path.join(__dirname, "logs", "deploy-log.txt");

  const contractName = "Platform";
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);

  // Деплоим фабрику
  console.log("Factory DEPLOYING...");
  const factory_Factory = await ethers.getContractFactory("FactoryCore");
  const factory = await factory_Factory.deploy();
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("Factory deployed at", factoryAddr);
  const txFactory = factory.deploymentTransaction();

  // Деплоим платформу через прокси
  console.log("Platform DEPLOYING...");
  const platform_Fabric = await ethers.getContractFactory("Platform");
  const platform = await upgrades.deployProxy(platform_Fabric, [factoryAddr], {
    kind: "uups",
  });
  await platform.waitForDeployment();
  const platformAddr = await platform.getAddress();
  console.log("Platform deployed at", platformAddr);
  const txPlatform = platform.deploymentTransaction();

  // Логируем в файл
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(
    logPath,
    `[${new Date().toISOString()}] Factory deployed at ${factoryAddr} by ${deployer.address}\n`
  );
  fs.appendFileSync(
    logPath,
    `[${new Date().toISOString()}] ${contractName} deployed at ${platformAddr} by ${deployer.address}\n`
  );

  // Запись адресов во фронт
  const network = await ethers.provider.getNetwork();
  const networkName = deriveNetworkName(network.chainId, network.name);

  const addressesDir = path.join(__dirname, "../front/src/contracts");
  const outputPath = path.join(addressesDir, `addresses.${networkName}.json`);

  const frontAddresses = readJsonSafe<any>(outputPath, {});
  const mergedAddresses = {
    ...frontAddresses,
    platform: platformAddr,
    deployer: deployer.address,
    // factory: factoryAddr, // если нужно фронту
  };

  writeJsonPretty(outputPath, mergedAddresses);

  // Запись в .env бэка
  const backendEnvPath = path.join(__dirname, "../backend/.env");
  updateEnv(backendEnvPath, "PLATFORM_ADDRESS", platformAddr);
  // updateEnv(backendEnvPath, "FACTORY_ADDRESS", factoryAddr); // если нужно

  // Ждём подтверждений
  if (txFactory) await txFactory.wait(5);
  if (txPlatform) await txPlatform.wait(5);

  // Верификация фабрики
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

  // Верификация платформы
  try {
    await run("verify:verify", {
      address: platformAddr,
      constructorArguments: [factoryAddr],
    });
    console.log("Platform implementation verified!");
  } catch (e: any) {
    if (e?.message?.toLowerCase?.().includes("already verified")) {
      console.log("Platform implementation already verified.");
    } else {
      console.error("Platform verification failed:", e);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

