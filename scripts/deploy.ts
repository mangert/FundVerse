import { upgrades } from "hardhat";

const { ethers, hre } = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
    const [deployer] = await ethers.getSigners();
  
  console.log('Deploying contracts with account:', deployer.address);

//депплоим фабрику
    console.log("Factory DEPLOYING...");
    const factory_Factory = await ethers.getContractFactory("FactoryCore");
    const factory = await factory_Factory.deploy();
    factory.waitForDeployment();
    const factoryAddr = await factory.getAddress();        
    console.log("Factory deployed at ", factoryAddr);
        
    //деплоим контракт платформы через прокси        
    console.log("Platform DEPLOYING...");
    const platform_Fabric = await ethers.getContractFactory("Platform");        
    const platform = await upgrades.deployProxy(platform_Fabric, [factoryAddr], {kind: "uups", });
    await platform.waitForDeployment();
    const platformAddr = await platform.getAddress();        
    console.log("Platform deployed at ", platformAddr);
    
    console.log("Loyalty DEPLOYING...");
    const loyalty_Factory = await ethers.getContractFactory("FundVerseLoyaltyv1");
    const loyalty = await loyalty_Factory.deploy(deployer, platform);
    loyalty.waitForDeployment();
    const loyaltyAddr = await loyalty.getAddress();        
    console.log("Loyalty NFT deployed at ", loyaltyAddr);
    
  // Сохраняем адреса в файл
  const addresses = {
    platform: platformAddr,
    loyaltyNFT: loyaltyAddr,
    deployer: deployer.address
  };

  const addressesDir = './front/src/contracts/';
  if (!fs.existsSync(addressesDir)) {
    fs.mkdirSync(addressesDir, { recursive: true });
  }

  // Получаем network из hardhat runtime environment  
  const network = await ethers.provider.getNetwork();  
  const networkName = (network.name === 'unknown' ? (
    network.id === 31337 ? 'hardhat' :'localhost') 
    : network.name);
  const outputPath = path.join(addressesDir, `addresses.${networkName}.json`);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(addresses, null, 2)
  );
  
  console.log('📁 ', path.join(addressesDir, `addresses.${networkName}.json`));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function join(addressesDir: string, arg1: string) {
    throw new Error("Function not implemented.");
}
