//скрипт для тестирования в ноде - настройки платформы
import { ethers } from 'hardhat';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🚀 Settings...');

  // Загружаем ABI
  const abiPath = join(__dirname, '../front/src/contracts/abis/Platform.json');
  const abi = JSON.parse(readFileSync(abiPath, 'utf8'));
  
  // Загружаем адреса
  const addressesPath = join(__dirname, '../front/src/contracts/addresses.hardhat.json');
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

  // Параметры кампании - депозит
  const txSetDelay = await platform.setDelay(60*60*24);
  console.log('📦 Transaction sent:', txSetDelay.hash);
  
  // Ждем подтверждения
  console.log('⏳ Waiting for confirmation...');
  const receipt = await txSetDelay.wait();
  console.log('✅ Transaction confirmed in block:', receipt?.blockNumber);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });