import fs from "fs";
import path from "path";
import hre, { ethers, run, upgrades } from "hardhat";

//скрипт для деплоя и верификации платформы
//деплоит платформу через прокси, верифицирует контракты
async function main() {
    
    const addressesPath = path.join(__dirname, "logs", "addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
    const logPath = path.join(__dirname, "logs", "deploy-log.txt");
    
    const contractName = "Platform";
    const [deployer, owner] = await ethers.getSigners();    
    
    console.log('Deploying contracts with account:', deployer.address);

    //депплоим фабрику
    console.log("Factory DEPLOYING...");
    const factory_Factory = await ethers.getContractFactory("FactoryCore");
    const factory = await factory_Factory.deploy();
    factory.waitForDeployment();
    const factoryAddr = await factory.getAddress();        
    console.log("Factory deployed at ", factoryAddr);
    factory.waitForDeployment();
    const txFactory = factory.deploymentTransaction();


    //деплоим платформу через прокси    
    console.log("Platform DEPLOYING...");
    const platform_Fabric = await ethers.getContractFactory("Platform");        
    const platform = await upgrades.deployProxy(platform_Fabric, [factoryAddr], {kind: "uups", });
    await platform.waitForDeployment();
    const platformAddr = await platform.getAddress();        
    console.log("Platform deployed at ", platformAddr);
    const txPlatform = platform.deploymentTransaction();

    //логируем в файл
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] Factory deployed at ${factoryAddr} by ${deployer.address}\n`
    );            
    fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] ${contractName} deployed at ${platformAddr} by ${deployer.address}\n`
    );            
    
    
    //ждем подтверждений, чтобы верификация не отвалилась
    if(txFactory) {
        await txFactory.wait(5);
    }

    if(txPlatform) {
        await txPlatform.wait(5);
    }
    
    
    // Верификация фабрики
    try {
        await run("verify:verify", {
            address: factory,
        });
    console.log("Factory verified!");
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
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
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Platform implementation verified.");
        } else {
            console.error("Platform implementation:", e);
        }
    }    

    
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error); 
        process.exit(1);
    });