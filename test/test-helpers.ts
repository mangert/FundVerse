import { loadFixture, ethers, expect } from "./setup";
import { network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { token } from "../typechain-types/@openzeppelin/contracts";

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

export function defaultCreateCampaignArgs(overrides = {}) : [
    bigint, bigint, string, string ] {    
    const defaults = {        
        goal: 1000_000n,
        deadline: BigInt(Math.floor(Date.now() / 1000)) + (60n * 60n * 25n),
        campaignMeta: "Description and URI",        
        token: ethers.ZeroAddress
    };

    const merged = { ...defaults, ...overrides };
    
    return [
        merged.goal,        
        merged.deadline,
        merged.campaignMeta, 
        merged.token        
    ];   
}

//хелперы для тестов платформы

// функция-хелпер, чтобы заворачивать событие 
function getEventHash(signature : string) {
        
    return ethers.id(signature);
}

//Хэши сигнатур событий
export const EVENT_HASHES = {
    PARAM_UINT: getEventHash("FundVersePlatformParameterUpdated(string,uint256,address)"),
    PARAM_ADDRESS: getEventHash("FundVersePlatformParameterUpdated(string,address,address)"),            
};
