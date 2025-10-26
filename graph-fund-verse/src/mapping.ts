import { BigInt } from "@graphprotocol/graph-ts"
import {
  FVCampaignCreated as FVCampaignCreatedEvent,
  FVNewTokenAdded as FVNewTokenAddedEvent,
  FVTokenRemoved as FVTokenRemovedEvent
} from "../generated/Platform/Platform"

import {
  CampaignData,
  FVCampaignCreated,
  FVNewTokenAdded,
  FVTokenRemoved
} from "../generated/schema"

import { Campaign as CampaignTemplate } from "../generated/templates"
import { ICampaign } from "../generated/templates/Campaign/ICampaign"

export function handleCampaignCreated(event: FVCampaignCreatedEvent): void {
  // создаём сущность события
  let entity = new FVCampaignCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.newCampaignAddress = event.params.newCampaignAddress
  entity.founder = event.params.founder
  entity.token = event.params.token
  entity.goal = event.params.goal

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // создаём сущность кампании

  let entityCampaign = new CampaignData(entity.newCampaignAddress)
  entityCampaign.founder = entity.founder
  entityCampaign.token = entity.token
  entityCampaign.goal = entity.goal

  let campaignContract = ICampaign.bind(event.params.newCampaignAddress);
  let summary = campaignContract.try_getSummary();  
  if (!summary.reverted) {
    entityCampaign.capmpaignId = summary.value.get_id();
    entityCampaign.raised = summary.value.get_raised();    
    entityCampaign.deadline = summary.value.get_deadline();
    entityCampaign.campaignMeta = summary.value.get_campaignMeta();
    entityCampaign.status = summary.value.get_status();
  } else {
    entityCampaign.capmpaignId = BigInt.fromI32(-1);
    entityCampaign.raised = BigInt.fromI32(0);
    entityCampaign.deadline = BigInt.fromI32(0);
    entityCampaign.campaignMeta = "";
    entityCampaign.status = 0;
  }

  entityCampaign.blockNumber = event.block.number
  entityCampaign.blockTimestamp = event.block.timestamp
  entityCampaign.transactionHash = event.transaction.hash

  entityCampaign.save()

  // создаём динамический data source для новой кампании
  CampaignTemplate.create(event.params.newCampaignAddress)
}


export function handleTokenAdded(event: FVNewTokenAddedEvent): void {
  let entity = new FVNewTokenAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.token = event.params.token
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}


export function handleTokenRemoved(event: FVTokenRemovedEvent): void {
  let entity = new FVTokenRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.token = event.params.token
  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}