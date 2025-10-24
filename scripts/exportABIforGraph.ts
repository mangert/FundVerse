// утилита убирает лишнее из артефактов для исплользование ABI с граф
import fs from "fs";
import path from "path";

async function main() {
  //Прежде чем запускать проверить пути!!!
    /*const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/core/Platform.sol/Platform.json"
  );*/

  const artifactPath = path.join(
    __dirname,
    "../artifacts/contracts/interfaces/ICampaign.sol/ICampaign.json"
  );
  
  //const outputPath = path.join(__dirname, "../graph-fund-verse/abis/Platform.json");
  const outputPath = path.join(__dirname, "../graph-fund-verse/abis/ICampaign.json");

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(abi, null, 2));

  console.log("ABI for The Graph written to", outputPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
