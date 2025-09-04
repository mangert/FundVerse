import fs from "fs";
import path from "path";

// Находит последний build-info и достаёт input
export function getCompilerInput(contractName: string) {
  const buildInfoDir = path.join(__dirname, "../contracts-data/");
  const filePath = path.join(buildInfoDir, `${contractName}.build-info.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Build info not found for ${contractName}`);
  }

  const buildInfo = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return buildInfo.input;
}
