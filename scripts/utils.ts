//утилиты для записи адресов в файлы
import fs from "fs";
import path from "path";

export function readJsonSafe<T = any>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonPretty(filePath: string, data: any) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Written: ${filePath}`);
}

export function deriveNetworkName(chainId: bigint, nameFromProvider: string): string {
  if (nameFromProvider === "unknown") {
    return chainId === 31337n ? "hardhat" : "localhost";
  }
  return nameFromProvider;
}

export function updateEnv(envPath: string, key: string, value: string) {
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
  } else {
    content = `${key}=${value}`;
  }
  fs.mkdirSync(path.dirname(envPath), { recursive: true });
  fs.writeFileSync(envPath, content, "utf-8");
  console.log(`.env updated: ${key}=${value}`);
}
