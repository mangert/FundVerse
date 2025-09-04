import fs from "fs";
import path from "path";

const logFile = path.join(__dirname, "verification.log");

export function log(message: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  // Пишем в консоль коротко
  console.log(message);

  // Пишем в файл
  fs.appendFileSync(logFile, line, { encoding: "utf8" });
}
