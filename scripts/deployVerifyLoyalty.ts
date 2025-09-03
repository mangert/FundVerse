import fs from "fs";
import path from "path";
import hre, { ethers, run, upgrades } from "hardhat";

//скрипт для деплоя и верификации программы лояльности
async function main() {
    
    const addressesPath = path.join(__dirname, "logs", "addresses.json");
    const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf-8"));
    const logPath = path.join(__dirname, "logs", "deploy-log.txt");
    const platformAddr = "";
    const [deployer, owner] = await ethers.getSigners(); 
    
    console.log("Loyalty DEPLOYING...");
    const loyalty_Factory = await ethers.getContractFactory("FundVerseLoyaltyv1");
    const loyalty = await loyalty_Factory.deploy(deployer, platformAddr);
    loyalty.waitForDeployment();
    const loyaltyAddr = await loyalty.getAddress();        
    const txLoyalty = await loyalty.deploymentTransaction();
    console.log("Loyalty NFT deployed at ", loyaltyAddr);
    
    //логируем в файл
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(
        logPath,
        `[${new Date().toISOString()}] Loyalty deployed at ${loyaltyAddr} by ${deployer.address}\n`
    );            
    
    
    //ждем подтверждений, чтобы верификация не отвалилась
    if(txLoyalty) {
        await txLoyalty.wait(5);
    }

    // Верификация
    
    try {
        await run("verify:verify", {
            address: platformAddr,
            constructorArguments: [platformAddr, deployer], 
        });
        console.log("Loyalty implementation verified!");
    } catch (e: any) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Loyalty implementation verified.");
        } else {
            console.error("Loyalty implementation:", e);
        }
    }    

    
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error); 
        process.exit(1);
    });