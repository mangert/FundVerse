import {
  CampaignContribution as CampaignContributionEvent,
  CampaignFundsClaimed as CampaignFundsClaimedEvent
} from "../generated/templates/Campaign/ICampaign"

import {
  CampaignContribution,
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

  entity.recipient = event.params.recipient
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
