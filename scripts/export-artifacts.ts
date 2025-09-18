//скрипт для настройки сервиса верификации
//копируем артефакты для сервиса верификации
import fs from "fs";
import path from "path";
import { artifacts } from "hardhat";

async function main() {
  const outDir = path.join(__dirname, "../backend/verifyService/contracts-data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // контракты, которые нужны бэку
  const contracts = [
    "CampaignNative",
    "CampaignToken",
    "Platform",
  ];

  // экспорт ABI
  for (const name of contracts) {
    const artifact = await artifacts.readArtifact(name);
    const abiFile = path.join(outDir, `${name}.abi.json`);
    fs.writeFileSync(abiFile, JSON.stringify(artifact.abi, null, 2));
    console.log(`✓ ABI ${name} → ${abiFile}`);
  }

  // экспорт build-info (standard-json-input)
  const buildInfoDir = path.join(__dirname, "../artifacts/build-info");
  const buildFiles = fs.readdirSync(buildInfoDir);

  for (const file of buildFiles) {
    const fullPath = path.join(buildInfoDir, file);
    const content = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

    for (const [sourceName, contractsObj] of Object.entries<any>(
      content.output.contracts
    )) {
      for (const contractName of Object.keys(contractsObj)) {
        if (contracts.includes(contractName)) {
          const outFile = path.join(outDir, `${contractName}.build-info.json`);
          fs.writeFileSync(
            outFile,
            JSON.stringify({ input: content.input }, null, 2)
          );
          console.log(`✓ Build-info ${contractName} → ${outFile}`);
        }
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
