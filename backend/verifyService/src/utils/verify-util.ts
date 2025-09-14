// src/utils/verify-util.ts
//Утилита для вызова Hardhat через subprocess:
import { exec } from "child_process";
import { NETWORK } from "./setup";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runVerify(
  address: string,
  constructorArgs: any[],
  contractName: string,
  maxAttempts = 5,
  initialDelay = 60000 // 1 минута
): Promise<boolean> {
  let attempt = 1;
  let delayMs = initialDelay;

  while (attempt <= maxAttempts) {
    console.log(`⏳ Попытка ${attempt}/${maxAttempts} верификации ${address}`);

    try {
      await execPromise(
        `npx hardhat run src/utils/verify-wrapper.ts --network ${NETWORK} --address ${address} --args '${JSON.stringify(constructorArgs)}' --contract ${contractName}`
      );

      console.log(`✅ Контракт ${address} верифицирован на попытке ${attempt}`);
      return true;
    } catch (err: any) {
      console.error(`❌ Ошибка верификации (попытка ${attempt}): ${err.message || err}`);
      if (attempt < maxAttempts) {
        console.log(`🔁 Жду ${delayMs / 1000} секунд перед повтором...`);
        await delay(delayMs);
        delayMs *= 2; // экспоненциальная задержка
      }
      attempt++;
    }
  }

  console.error(`❌ Все ${maxAttempts} попытки верификации ${address} исчерпаны`);
  return false;
}

function execPromise(cmd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message));
      } else {
        console.log(stdout);
        resolve();
      }
    });
  });
}
