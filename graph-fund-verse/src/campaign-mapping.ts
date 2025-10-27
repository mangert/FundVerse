import {
  CampaignContribution as CampaignContributionEvent,
  CampaignFundsClaimed as CampaignFundsClaimedEvent
} from "../generated/templates/Campaign/ICampaign"

import {
  CampaignContribution,
  CampaignData,
  CampaignFundsClaimed
} from "../generated/schema"


export function handleContribution(event: CampaignContributionEvent): void {
  let entity = new CampaignContribution(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.contributor = event.params.contributor
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}


export function handleFundsClaimed(event: CampaignFundsClaimedEvent): void {
  let entity = new CampaignFundsClaimed(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  let blockNumber = event.block.number
  let blockTimestamp = event.block.timestamp
  let transactionHash = event.transaction.hash

  entity.recipient = event.params.recipient
  entity.amount = event.params.amount

  entity.blockNumber = blockNumber
  entity.blockTimestamp = blockTimestamp
  entity.transactionHash = transactionHash

  entity.save()

  // корректируем кампанию
  let entityCampaign = CampaignData.load(event.address);
  
  if(entityCampaign) {
    
    entityCampaign.isFundsWithdrawn = true
    entityCampaign.blockNumber = blockNumber
    entityCampaign.blockTimestamp = blockTimestamp
    entityCampaign.transactionHash = transactionHash

    entityCampaign.save()
  } 
}
