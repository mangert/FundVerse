import {
  FVCampaignCreated as FVCampaignCreatedEvent,
  FVNewTokenAdded as FVNewTokenAddedEvent,
  FVTokenRemoved as FVTokenRemovedEvent
} from "../generated/Platform/Platform"

import {
  FVCampaignCreated,
  FVNewTokenAdded,
  FVTokenRemoved
} from "../generated/schema"

import { Campaign as CampaignTemplate } from "../generated/templates"


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