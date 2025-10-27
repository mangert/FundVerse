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
  FVTokenRemoved,
  Token
} from "../generated/schema"

import { Campaign as CampaignTemplate } from "../generated/templates"
import { ICampaign } from "../generated/templates/Campaign/ICampaign"
import { IERC20Metadata } from "../generated/Platform/IERC20Metadata"

export function handleCampaignCreated(event: FVCampaignCreatedEvent): void {
  // забираем данные из события
  let addr = event.params.newCampaignAddress
  let founder = event.params.founder
  let token = event.params.token
  let goal = event.params.goal

  let blockNumber = event.block.number
  let blockTimestamp = event.block.timestamp
  let transactionHash = event.transaction.hash

  
  // создаём сущность события
  let entity = new FVCampaignCreated(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.newCampaignAddress = addr
  entity.founder = founder
  entity.token = token
  entity.goal = goal

  entity.blockNumber = blockNumber
  entity.blockTimestamp = blockTimestamp
  entity.transactionHash = transactionHash

  entity.save()

  // создаём сущность кампании

  let entityCampaign = new CampaignData(addr)
  entityCampaign.creator = founder
  entityCampaign.token = token
  entityCampaign.goal = goal

  let campaignContract = ICampaign.bind(addr);
  let summary = campaignContract.try_getSummary();  
  if (!summary.reverted) {
    entityCampaign.campaignId = summary.value.get_id();
    entityCampaign.raised = summary.value.get_raised();    
    entityCampaign.deadline = summary.value.get_deadline();
    entityCampaign.campaignMeta = summary.value.get_campaignMeta();
    entityCampaign.status = summary.value.get_status();    
  } else {
    entityCampaign.campaignId = BigInt.fromI32(-1);
    entityCampaign.raised = BigInt.fromI32(0);
    entityCampaign.deadline = BigInt.fromI32(0);
    entityCampaign.campaignMeta = "";
    entityCampaign.status = 0;
  }

  entityCampaign.isFundsWithdrawn = false;

  entityCampaign.blockNumber = blockNumber
  entityCampaign.blockTimestamp = blockTimestamp
  entityCampaign.transactionHash = transactionHash

  entityCampaign.save()

  // создаём динамический data source для новой кампании
  CampaignTemplate.create(addr)
}


export function handleTokenAdded(event: FVNewTokenAddedEvent): void {
  // забираем данные из события

  let tokenAddr = event.params.token
  let blockNumber = event.block.number
  let blockTimestamp = event.block.timestamp
  let transactionHash = event.transaction.hash
  
  // создаем сущность события
  let entity = new FVNewTokenAdded(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.token = tokenAddr
  entity.blockNumber = blockNumber 
  entity.blockTimestamp = blockTimestamp
  entity.transactionHash = transactionHash

  entity.save()

  // создаём (корректируем) сущность токена
  let token = Token.load(tokenAddr)
  if(!token) {
    token = new Token(tokenAddr)
  }
  let tokenContract = IERC20Metadata.bind(tokenAddr)
  let trySymbol = tokenContract.try_symbol();
  token.symbol = trySymbol.reverted ? "unknown" : trySymbol.value;

  let tryDecimals = tokenContract.try_decimals();
  token.decimals = tryDecimals.reverted ? 18 : tryDecimals.value;

  let tryName = tokenContract.try_name();
  token.name = tryName.reverted ? "unknown" : tryName.value;   
  
  token.status = true; 

  token.blockNumber = blockNumber
  token.blockTimestamp = blockTimestamp
  token.transactionHash = transactionHash

  token.save()
}


export function handleTokenRemoved(event: FVTokenRemovedEvent): void {
  
  let tokenAddr = event.params.token
  let blockNumber = event.block.number
  let blockTimestamp = event.block.timestamp
  let transactionHash = event.transaction.hash
  
  let entity = new FVTokenRemoved(
    event.transaction.hash.concatI32(event.logIndex.toI32())
  )

  entity.token = tokenAddr
  entity.blockNumber = blockNumber
  entity.blockTimestamp = blockTimestamp
  entity.transactionHash = transactionHash

  entity.save()

  // корретируем данные токена  
  let token = Token.load(tokenAddr)
  if(token) {
    token.status = false
    token.blockNumber = blockNumber
    token.blockTimestamp = blockTimestamp
    token.transactionHash = transactionHash

    token.save()
  }
}