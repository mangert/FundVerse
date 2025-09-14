// src/utils/verify-wrapper.ts
import hre from "hardhat";

async function main() {
  const args = process.argv.slice(2);
  const addressIdx = args.indexOf("--address");
  const argsIdx = args.indexOf("--args");
  const contractIdx = args.indexOf("--contract");

  if (addressIdx === -1 || argsIdx === -1 || contractIdx === -1) {
    throw new Error("❌ Usage: --address <addr> --args '[...]' --contract <name>");
  }

  const address = args[addressIdx + 1];
  const constructorArgs = JSON.parse(args[argsIdx + 1]);
  const contract = args[contractIdx + 1];

  console.log(`▶️ Verifying ${address} with args: ${JSON.stringify(constructorArgs)}`);

  await hre.run("verify:verify", {
    address,
    constructorArguments: constructorArgs,
    contract,
  });

  console.log(`✅ Verified ${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
