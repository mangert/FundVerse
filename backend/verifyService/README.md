# Cервис верификации контрактовFundVerse

## 📌 Основной функционал

Сервис обеспечивает автоматическую верификацию контрактов-кампаний, создаваемых на платформой FundVerse в обозревателе eherscan
Сервис слушает события платформы FVCampaignCreated и запускает скрипт верификации.

**Используемые технологии и ограничения:**
- Используется hardhat, TypeScript, Node.js, Ethers.js, dotenv.
- Верификация произоводится с помощью инструментов hardhat v.2.26.*. 


## 🏗 Упрощенная структура

```
verifyService/
├─ src/
│  ├─ server.ts          # основной сервер
│  ├─ utils/
│  │  ├─ setup.ts         # пути и имена контрактов
│  │  ├─ verify-wrapper   # cкрипт вызова verify:verify (hardhat-верификация)
│  │  └─ verify-util.ts   # функция runVerify (вызов скрипта через hardhat)
│  └─ logger.ts
├─ artifacts/ # скомпилированные контракты Hardhat
│  ├─ build-info         
│  ├─ contracts/core/Platform.sol/Platform.json
│  └─ contracts/modules/campaigns/...
├─ package.json
├─ tsconfig.json
└─ dist/
```
---

## ✨ Статус проекта

Проект развернуть на сервере и запущен. 
Контракты, создаваемые платформой, верифицируются в автоматическом режиме.