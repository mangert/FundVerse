import fs from "fs";
import path from "path";
import { ethers, run } from "hardhat";
import { readJsonSafe, writeJsonPretty, deriveNetworkName } from "./utils";


// временный скрипт
async function main() {
  const logPath = path.join(__dirname, "logs", "deploy-log.txt");

  const campaignAddr = "0xB5B9C13811433B25eb1890F5dcec10D585Ec436d"; 
  const [deployer] = await ethers.getSigners();

  const ABI = [
  "function getSummary() public view returns (address, uint256, uint256, uint256, string memory, address, uint256)"
];
  const campaign = await ethers.getContractAt("ICampaign", campaignAddr, deployer);

  

  const goal = await campaign.goal();

  console.log("Summary:", goal);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

function join(addressesDir: string, arg1: string) {
    throw new Error("Function not implemented.");
}
