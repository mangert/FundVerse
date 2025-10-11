//Утилита для вызова Hardhat через subprocess:
import { exec } from "child_process";
import { NETWORK } from "./setup";
import path from "path";

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

  const projectRoot = path.resolve(__dirname, "../../");


  while (attempt <= maxAttempts) {
    console.log(`⏳ Попытка ${attempt}/${maxAttempts} верификации ${address}`);

    try {
      // ✅ Добавлено: безопасное преобразование BigInt → string
      const safeArgs = constructorArgs.map((arg) =>
        typeof arg === "bigint" ? arg.toString() : arg
      );
      const jsonArgs = JSON.stringify(safeArgs);

      await execPromise(`npx hardhat run src/utils/verify-wrapper.ts --config hardhat.config.cjs --network ${NETWORK} --no-compile`,
        {
          cwd: projectRoot,
          env: {
            ...process.env,
            VERIFY_ADDRESS: address,
            VERIFY_ARGS: jsonArgs,
            VERIFY_CONTRACT: contractName,
          },
        }
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

//функция-обертка для запуска процесса как субпроцесса, возращающа промис с вызовом exec команды
// в нашем случае в параметр передадим запуск скрипта через hardhat с опциями
function execPromise(
  cmd: string,
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(cmd, options, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(
          (stderr?.toString() || stdout?.toString() || error.message)
        ));

      } else {
        console.log(stdout);
        resolve();
      }
    });
  });
}