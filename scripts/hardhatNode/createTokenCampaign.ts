//скрипт для тестирования в ноде - создание тестовой кампании в токенах
import { ethers } from 'hardhat';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🚀 Creating test campaign...');

  // Загружаем ABI
  const abiPath = join(__dirname, './../../front/src/contracts/abis/Platform.json');
  const abi = JSON.parse(readFileSync(abiPath, 'utf8'));
  
  // Загружаем адреса
  const addressesPath = join(__dirname, './../../front/src/contracts/addresses.hardhat.json');
  const addresses = JSON.parse(readFileSync(addressesPath, 'utf8'));
  
  const [deployer, user] = await ethers.getSigners();
  console.log('Using account:', deployer.address);
  console.log('Platform address:', addresses.platform);

  // Создаем контракт через ethers
  const platform = new ethers.Contract(
    addresses.platform,
    abi,
    deployer
  );

  // Параметры кампании
  const goal = ethers.parseEther('1.0');
  const deadline = BigInt(Math.floor(Date.now() / 1000)) + 7n * 24n * 60n * 60n; // 7 дней
  const campaignMeta = 'ipfs://QmTestCampaignMetadataHash';
  const token = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";

  // Получаем required deposit
  console.log('⏳ Getting required deposit...');
  const requiredDeposit = await platform.getRequiredDeposit();
  console.log('Required deposit:', ethers.formatEther(requiredDeposit), 'ETH');

  // Проверяем баланс
  const balance = await deployer.provider?.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance || 0), 'ETH');

  if (balance && balance < requiredDeposit) {
    throw new Error(`Insufficient balance. Need ${ethers.formatEther(requiredDeposit)} ETH, have ${ethers.formatEther(balance)} ETH`);
  }

  // Создаем кампанию
  console.log('⏳ Creating campaign...');
  const tx = await platform.createCampaign(
    goal,
    deadline,
    campaignMeta,
    token,
    { value: requiredDeposit }
  );

  console.log('📦 Transaction sent:', tx.hash);
  
  // Ждем подтверждения
  console.log('⏳ Waiting for confirmation...');
  const receipt = await tx.wait();
  console.log('✅ Transaction confirmed in block:', receipt?.blockNumber);

  // Пытаемся найти событие CampaignCreated
  if (receipt?.logs) {
    for (const log of receipt.logs) {
      try {
        const parsedLog = platform.interface.parseLog(log);
        if (parsedLog?.name === 'FVCampaignCreated') {
          console.log('🎉 Campaign created at address:', parsedLog.args[0]);
          console.log('📝 Refresh your frontend to see the new campaign!');
          return;
        }
      } catch (e) {
        // Не все логи можно распарсить - это нормально
      }
    }
  }

  console.log('⚠️ CampaignCreated event not found, but transaction succeeded');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });