//утилита для запуска верификации
import hre from "hardhat";

async function main() {
  const address = process.env.VERIFY_ADDRESS;
  const args = process.env.VERIFY_ARGS ? JSON.parse(process.env.VERIFY_ARGS) : [];
  const contract = process.env.VERIFY_CONTRACT;

  if (!address || !contract) {
    throw new Error("❌ Missing VERIFY_ADDRESS or VERIFY_CONTRACT env vars");
  }

  console.log(`🔍 Verifying ${contract} at ${address} with args:`, args);
  const network = hre.network.name;
  console.log(`🔧 Network inside verify-wrapper: ${network}`);  


  await hre.run("verify:verify", {
    address,
    constructorArguments: args,
    contract,
  });

  console.log(`✅ Verified ${contract} at ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
