import fs from "fs";
import path from "path";
import { ethers, run } from "hardhat";
import { readJsonSafe, writeJsonPretty, deriveNetworkName } from "./utils";

// Скрипт для деплоя и верификации программы лояльности
async function main() {
  const logPath = path.join(__dirname, "logs", "deploy-log.txt");
  
  const [deployer] = await ethers.getSigners();
    
  console.log("Dispatcher DEPLOYING...");
  const dispatcher_Factory = await ethers.getContractFactory("StatusDispatcher", deployer);
  const dispatcher = await dispatcher_Factory.deploy();
  await dispatcher.waitForDeployment();
  const dispatcherAddr = await dispatcher.getAddress();
  const txDispatcher = dispatcher.deploymentTransaction();
  console.log("dispatcher deployed at", dispatcherAddr);

  // Логируем в файл
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(
    logPath,
    `[${new Date().toISOString()}] dispatcher deployed at ${dispatcherAddr} by ${deployer.address}\n`
  );

  // Запись адреса во фронт
  const network = await ethers.provider.getNetwork();
  const networkName = deriveNetworkName(network.chainId, network.name);

  const addressesDir = path.join(__dirname, "../front/src/contracts");
  const outputPath = path.join(addressesDir, `addresses.${networkName}.json`);

  const frontAddresses = readJsonSafe<any>(outputPath, {});
  const mergedAddresses = {
    ...frontAddresses,
    dispatcher: dispatcherAddr,
    deployer: deployer.address,
  };

  writeJsonPretty(outputPath, mergedAddresses);

  // Ждём подтверждений
  if (txDispatcher) await txDispatcher.wait(5);
  
  // Верификация
  try {
    await run("verify:verify", {
      address: dispatcherAddr,
      constructorArguments: [],
    });
    console.log("dispatcher verified!");
  } catch (e: any) {
    if (e?.message?.toLowerCase?.().includes("already verified")) {
      console.log("dispatcher already verified.");
    } else {
      console.error("dispatcher verification failed:", e);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
