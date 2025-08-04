import { loadFixture, ethers, expect } from "./setup";
import { network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

//хелперы для тестов контракта-кампании в версии для нативной валюты
//функция для задания аргументов конструктора для нативной версии контракта
export function defaultCampaignArgs(overrides = {}, platformAddr : string, creatorAddr : string ) : [
    string, string, /*string,*/ bigint, bigint, number, string, number ] {    
    const defaults = {
        platformAddress: platformAddr,
        creator: creatorAddr,        
        Id: 123n,
        goal: 1000_000n,
        deadline: Math.floor(Date.now() / 1000) + 60,
        campaignMeta: "Description and URI",
        platformFee: 50
    };

    const merged = { ...defaults, ...overrides };
    
    return [
        merged.platformAddress,
        merged.creator,        
        merged.Id,
        merged.goal,
        merged.deadline,
        merged.campaignMeta,
        merged.platformFee        
    ];   
}

//хелперы для тестов контракта-кампании в обеих версиях
//вспомогательная функция создания "сбоящего" получателя средств
export async function getBadReciever() { 

    const badReceiverFactory = await ethers.getContractFactory("BadReceiver");
    const badReceiver = await badReceiverFactory.deploy();            
    await badReceiver.waitForDeployment();

    const [sender] = await ethers.getSigners();            

    //пускай на контракте будут средства - 1 эфир
    const tx = await badReceiver.connect(sender).getTransfer({value: ethers.parseEther("1.0")})                         

    return badReceiver;
}