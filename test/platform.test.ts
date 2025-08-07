import { loadFixture, ethers, expect  } from "./setup";
import { upgrades } from "hardhat";
import {defaultCampaignArgs, getBadReciever, defaultCreateCampaignArgs} from "./test-helpers";

describe("Platform main functionality tests", function() {
    async function deploy() {        
        const [ownerPlatform, userCreator, user0, user1] = await ethers.getSigners();               
        
        //деплоим контракт платформы через прокси        
        const platform_Fabric = await ethers.getContractFactory("Platform");        
        const platform = await upgrades.deployProxy(platform_Fabric, {kind: "uups", });
        await platform.waitForDeployment();

        //это токены
        const token_Factory = await ethers.getContractFactory("TestTokenERC20");
        const tokenERC20 = await token_Factory.deploy();
        const tokenERC20Addr = await tokenERC20.getAddress();
        
        
        return {ownerPlatform, userCreator, user0, user1, platform, tokenERC20, tokenERC20Addr};
       
    }

    describe("deployment tеsts", function() { //примитивный тест на деплой - просто проверить, что общая часть работает
        it("should be deployed", async function() {
            const {platform} = await loadFixture(deploy);            

            expect(platform.target).to.be.properAddress;
            const balance = await ethers.provider.getBalance(platform.target);        
            expect(balance).eq(0);       
        });
    });

    describe("create platform tеsts", function() { //примитивный тест на деплой - просто проверить, что общая часть работает
        it("should create native campaign", async function() {
            const {ownerPlatform, user0, user1, platform} = await loadFixture(deploy);            

            const args = defaultCreateCampaignArgs();

            const txCreate = await platform.connect(user0).createCompaign(...args);
            const countCampaigns = await platform.getTotalCampaigns();
            const campaignAddress = await platform.getCampaignByIndex(0);
            
            await expect(txCreate).to.emit(platform, "FundVerseCampaignCreated")
                .withArgs(campaignAddress, user0, ethers.ZeroAddress, args[0]);       
            
            expect(await platform.getTotalCampaigns()).equal(1);
            expect(campaignAddress).equal(await platform.getCampaignOfFounderByIndex(user0, 0));
            expect(await platform.getCampaignsCountByFounder(user0)).equal(1);

            const campaign = await ethers.getContractAt("ICampaign", campaignAddress);
            expect(await campaign.token()).equal(ethers.ZeroAddress);            
        });

        it("should create token campaign", async function() {
            const {ownerPlatform, user0, user1, platform, tokenERC20, tokenERC20Addr} = await loadFixture(deploy);            

            const args = defaultCreateCampaignArgs({token: tokenERC20Addr});

            const txCreate = await platform.connect(user0).createCompaign(...args);
            const countCampaigns = await platform.getTotalCampaigns();
            const campaignAddress = await platform.getCampaignByIndex(0);
            
            await expect(txCreate).to.emit(platform, "FundVerseCampaignCreated")
                .withArgs(campaignAddress, user0, tokenERC20Addr, args[0]);       
            
            expect(await platform.getTotalCampaigns()).equal(1);
            expect(campaignAddress).equal(await platform.getCampaignOfFounderByIndex(user0, 0));
            expect(await platform.getCampaignsCountByFounder(user0)).equal(1);

            const campaign = await ethers.getContractAt("ICampaign", campaignAddress);
            expect(await campaign.token()).equal(tokenERC20Addr);            
        });
    });
});