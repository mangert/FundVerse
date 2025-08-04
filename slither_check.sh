#!/bin/bash
# slither_check.sh

if [ -z "$1" ]; then
  echo "❌ Укажи путь до контракта, например:"
  echo "   ./slither_check.sh contracts/campaigns/CampaignNative.sol"
  exit 1
fi

slither "$1" \
  --exclude locked-ether \
  --solc-remaps @openzeppelin=node_modules/@openzeppelin \
  --solc-args "--allow-paths .,./node_modules --base-path . --include-path node_modules"
