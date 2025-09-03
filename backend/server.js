const { ethers } = require('ethers');
const axios = require('axios');
require('dotenv').config();

// Настройки
const PROVIDER_URL = process.env.PROVIDER_URL;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;

// ABI фабрики (минимум - событие создания контракта)
const FACTORY_ABI = [
  "event ContractCreated(address indexed contractAddress)"
];

// Подключаемся к провайдеру
const provider = new ethers.providers.JsonRpcProvider(PROVIDER_URL);
const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);

// Функция верификации
async function verifyContract(address) {
  try {
    console.log(`Starting verification for contract: ${address}`);
    
    const response = await axios.post(
      'https://api.etherscan.io/api',
      {
        apikey: ETHERSCAN_API_KEY,
        module: 'contract',
        action: 'verifysourcecode',
        contractaddress: address,
        sourceCode: JSON.stringify(require('./artifacts/ChildContract.json')), // Метаданные контракта
        codeformat: 'solidity-standard-json-input',
        contractname: 'ChildContract',
        compilerversion: 'v0.8.19+commit.7dd6d989',
        optimizationused: 1,
        runs: 200
      }
    );

    console.log(`Verification result for ${address}:`, response.data);
    
    if (response.data.status === '1') {
      console.log(`✓ Contract ${address} verified successfully`);
    } else {
      console.log(`✗ Verification failed for ${address}:`, response.data.result);
    }
  } catch (error) {
    console.error(`Error verifying contract ${address}:`, error.message);
  }
}

// Слушаем события создания контрактов
factory.on('ContractCreated', (contractAddress) => {
  console.log(`New contract created at: ${contractAddress}`);
  verifyContract(contractAddress);
});

console.log('Verification server started. Listening for new contracts...');

// Обработка ошибок
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});