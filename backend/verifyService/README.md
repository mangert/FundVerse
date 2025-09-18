# Cервис верификации контрактовFundVerse

**Сервис в разработке**

## 📌 Основной функционал

Предполагается автоматическая верификация контрактов-кампаний, создаваемых на платформой FundVerse в обозревателе eherscan
Сервис слушает события платформы FVCampaignCreated и запускает скрипт верификации.

**Используемые технологии и ограничения:**
- Используется hardhat, TypeScript, Node.js, Ethers.js, dotenv.
- Верификация произоводится с помощью инструментов hardhat v.2.26.*. 


## 🏗 Приблизительная структура (может быть скорректирована)


```
verifyService/
├─ src/
│  ├─ server.ts          # основной сервер
│  ├─ utils/
│  │  ├─ setup.ts        # пути и имена контрактов
│  │  └─ verify-util.ts  # функция runVerify
│  └─ logger.ts
├─ artifacts/            # скомпилированные контракты Hardhat
│  ├─ contracts/core/Platform.sol/Platform.json
│  └─ contracts/modules/campaigns/...
├─ package.json
├─ tsconfig.json
└─ dist/
```
---

## ✨ Статус проекта

В разработке. На данный момент решаются проблемы совместимости ES Modules,
hardhat, Node v22, ethers v.6 