import { loadFixture, ethers, expect  } from "./setup";
import { upgrades } from "hardhat";
import { network } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {defaultCampaignArgs, getBadReciever, defaultCreateCampaignArgs} from "./test-helpers";


describe("Platform main functionality tests", function() {
    async function deploy() {        
        const [ownerPlatform, userCreator, user0, user1] = await ethers.getSigners();               
        
        //депплоим фабрику
        const factory_Factory = await ethers.getContractFactory("FactoryCore");
        const factory = await factory_Factory.deploy();
        factory.waitForDeployment();
        const factoryAddr = await factory.getAddress();        
        //деплоим контракт платформы через прокси        
        const platform_Fabric = await ethers.getContractFactory("Platform");        
        const platform = await upgrades.deployProxy(platform_Fabric, [factoryAddr], {kind: "uups", });
        await platform.waitForDeployment();

        //это токены
        const token_Factory = await ethers.getContractFactory("TestTokenERC20");
        const tokenERC20 = await token_Factory.deploy();
        const tokenERC20Addr = await tokenERC20.getAddress();        
        
        return {ownerPlatform, userCreator, user0, user1, platform, tokenERC20, tokenERC20Addr, factory};       
    }

    describe("deployment tеsts", function() { //примитивный тест на деплой - просто проверить, что общая часть работает
        it("should be deployed", async function() {
            const {platform} = await loadFixture(deploy);            

            expect(platform.target).to.be.properAddress;
            const balance = await ethers.provider.getBalance(platform.target);        
            expect(balance).eq(0);       
        });
    });

    describe("create capmpaign tеsts", function() {
        // проверяем, что можно создать кампанию в нативной валюте
        it("should create native campaign", async function() {
            const {ownerPlatform, user0, user1, platform, factory} = await loadFixture(deploy);            
            //формируем стандарный набор аргументов кампании
            const args = defaultCreateCampaignArgs();
            //создаем кампанию
            const txCreate = await platform.connect(user0).createCompaign(...args);
            
            //смортрим, что получилось            
            const campaignAddress = await platform.getCampaignByIndex(0);            
            await expect(txCreate).to.emit(platform, "FundVerseCampaignCreated")
                .withArgs(campaignAddress, user0, ethers.ZeroAddress, args[0]);       
            
            
            expect(await platform.getTotalCampaigns()).equal(1);
            expect(campaignAddress).equal(await platform.getCampaignOfFounderByIndex(user0, 0));
            expect(await platform.getCampaignsCountByFounder(user0)).equal(1);

            const campaign = await ethers.getContractAt("ICampaign", campaignAddress);
            expect(await campaign.token()).equal(ethers.ZeroAddress);            
        });
        // проверяем, что можно создать кампанию в токенах
        it("should create token campaign", async function() {
            const {ownerPlatform, user0, user1, platform, tokenERC20Addr, factory} = await loadFixture(deploy);            
            //формируем стандарный набор аргументов кампании
            const args = defaultCreateCampaignArgs({token: tokenERC20Addr});
            
            //добавим наш токен в список
            (await platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20Addr)).wait(1);
            
            //создаем кампанию
            const txCreate = await platform.connect(user0).createCompaign(...args);
            
            //смотрим, что получилось
            const campaignAddress = await platform.getCampaignByIndex(0);            
            await expect(txCreate).to.emit(platform, "FundVerseCampaignCreated")
                .withArgs(campaignAddress, user0, tokenERC20Addr, args[0]);       
            
            expect(await platform.getTotalCampaigns()).equal(1);
            expect(campaignAddress).equal(await platform.getCampaignOfFounderByIndex(user0, 0));
            expect(await platform.getCampaignsCountByFounder(user0)).equal(1);

            const campaign = await ethers.getContractAt("ICampaign", campaignAddress);
            expect(await campaign.token()).equal(tokenERC20Addr);            
        });
        //проверка реверта создания кампаний с нулевой целью сбора
        it("should revert campaign with zero goal", async function() {
            const {ownerPlatform, user0, platform, tokenERC20Addr} = await loadFixture(deploy);            
            //сначала попробуем в нативной валюте
            //меняем в аргументах цель на ноль
            const argsNative = defaultCreateCampaignArgs({goal: 0n});
            //формируем транзакцию
            const txCreateNative = platform.connect(user0).createCompaign(...argsNative);
            //отправляем и ждем, что отвалится с ошибкой
            await expect(txCreateNative).revertedWithCustomError(platform, "FundVerseErrorZeroGoal");
            
            //а теперь то же самое в токенах
            //добавим наш токен в список
            (await platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20Addr)).wait(1);
            
            //меняем в аргументах цель на ноль
            const argsToken = defaultCreateCampaignArgs({goal:0, token: tokenERC20Addr});

            //формируем транзакцию
            const txCreateToken = platform.connect(user0).createCompaign(...argsToken);
            //отправляем и ждем, что отвалится с ошибкой
            await expect(txCreateToken).revertedWithCustomError(platform, "FundVerseErrorZeroGoal");            
        });
        //проверка реверта создания кампаний c маленькой продолжительностью 
        it("should revert campaign with too litle lifespan", async function() {
            const {ownerPlatform, user0, user1, platform, tokenERC20, tokenERC20Addr} = await loadFixture(deploy);            
            //сначала попробуем в нативной валюте
            //уменьшаем в аргументах дедлайн до 1 минуты
            const argsNative = defaultCreateCampaignArgs({deadline: BigInt(Math.floor(Date.now() / 1000)) + 60n});
            //формируем транзакцию
            const txCreateNative = platform.connect(user0).createCompaign(...argsNative);
            //отправляем и ждем, что отвалится с ошибкой
            await expect(txCreateNative).revertedWithCustomError(platform, "FundVerseErrorDeadlineLessMinimun");
            
            //а теперь то же самое в токенах
            //добавим наш токен в список
            (await platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20Addr)).wait(1);
            //уменьшаем в аргументах дедлайн до 1 минуты
            const argsToken = defaultCreateCampaignArgs({deadline: BigInt(Math.floor(Date.now() / 1000)) + 60n, token: tokenERC20Addr});
            //формируем транзакцию
            const txCreateToken = platform.connect(user0).createCompaign(...argsToken);
            //отправляем и ждем, что отвалится с ошибкой
            await expect(txCreateToken).revertedWithCustomError(platform, "FundVerseErrorDeadlineLessMinimun");            
        });
        //проверка реверта создания кампаний до истечения таймлока
        it("should revert create campaign before timelock expired", async function() {
            const {ownerPlatform, user0, platform, tokenERC20Addr} = await loadFixture(deploy);            
            //формируем стандарный набор аргументов кампании
            const args0 = defaultCreateCampaignArgs();
            
            //создаем кампанию
            const txCreate = await platform.connect(user0).createCompaign(...args0);
            
            //смотрим, что получилось
            const timelock = await platform.getFounderTimelock(user0);
            const campaignAddress = await platform.getCampaignByIndex(0);            
            await expect(txCreate).to.emit(platform, "FundVerseCampaignCreated")
                .withArgs(campaignAddress, user0, ethers.ZeroAddress, args0[0]);            
            await expect(txCreate).to.emit(platform, "FundVerseSetFounderTimelock")
                .withArgs(user0, timelock);

            //добавим наш токен в список
            (await platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20Addr)).wait(1);

            //а теперь пробуем создать новую кампанию (стандартный таймлок - двое суток)
            const args1 = defaultCreateCampaignArgs({token: tokenERC20Addr});
            const txCreate1 = platform.connect(user0).createCompaign(...args1);
            //ожидаем, что ревертнется, так как таймлок еще не закончился
            await expect(txCreate1).revertedWithCustomError(platform, "FundVerseErrorTimeLocked")
                .withArgs(timelock);            

            //а теперь пропустим время и попробуем еще раз - должно получиться
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 60 * 60 * 48 + 60; // двое суток плюс минута
            const futureTime = now + timeToAdd;
            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");
            
            //обновляем аргументы - дедлайн устанавливаем с учетом прокрученного времения
            const args2 = defaultCreateCampaignArgs({deadline: futureTime + 60 * 60 * 48 });
            //создаем кампанию
            const txCreate2 = await platform.connect(user0).createCompaign(...args2);
            //и проверяем, что у нашего user0 теперь две кампании
            expect(await platform.getCampaignsCountByFounder(user0)).equal(2);            
        });

        //проверка реверта создания кампаний в неподдерживаемой валюте
        it("should revert campaign in unsupported token", async function() {
            const {user0, platform, tokenERC20, tokenERC20Addr} = await loadFixture(deploy); 
            
            const argsToken = defaultCreateCampaignArgs({ token: tokenERC20Addr});
            //формируем транзакцию
            const txCreateToken = platform.connect(user0).createCompaign(...argsToken);
            //отправляем и ждем, что отвалится с ошибкой
           await expect(txCreateToken).revertedWithCustomError(platform, "FundVerseUnsupportedToken")
            .withArgs(tokenERC20);
        });
    });
    describe("add and remove token tests", function() {
        // проверяем, что можно добавить новый токен
        it("should add new token", async function() {
            const {ownerPlatform, platform, tokenERC20} = await loadFixture(deploy);            

            const tx = await platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20);
            tx.wait(1);
            expect(tx).to.emit(platform, "FundVerseNewTokenAdded").withArgs(tokenERC20);                        
        });

        // проверяем, что нельзя добавить токен, который уже есть
        it("should not add same token twice", async function() {
            const {ownerPlatform, platform, tokenERC20} = await loadFixture(deploy);            
            //добавим первый раз (транзакция проходит)
            const tx = await platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20);
            tx.wait(1);
            //добавляем тот же токен второй раз, и ждем, что отвалится
            const txNew = platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20);
            await expect(txNew).revertedWithCustomError(platform, "FundVerseAddingTokenAlreadySupported").withArgs(tokenERC20);
        });

        // проверяем, что токен не может добавить кто попало
        it("should not add new token by unauthorized user", async function() {
            const { user0, platform, tokenERC20} = await loadFixture(deploy);                        
            
            //добавляем токен от имени user0, и ждем, что отвалится
            const tx = platform.connect(user0).addTokenToAllowed(tokenERC20);
            await expect(tx).revertedWithCustomError(platform, "AccessControlUnauthorizedAccount");
        });

        // проверяем, что можно удалить токен
        it("should remove token", async function() {
            const {ownerPlatform, user0, platform, tokenERC20, tokenERC20Addr} = await loadFixture(deploy);                        
            //сначала добавим токен (чтобы было, что удалять)
            const txAdd = await platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20);
            txAdd.wait(1);

            //а теперь удалим, что добавили
            const txRemove = await platform.connect(ownerPlatform).removeTokenFromAllowed(tokenERC20);
            txRemove.wait(1);
            expect(txRemove).to.emit(platform, "FundVerseTokenRemoved").withArgs(tokenERC20);                        

            //дополнительно проверим - создание кампании в этом токене должно отвалиться
            const argsToken = defaultCreateCampaignArgs({ token: tokenERC20Addr});
            //формируем транзакцию
            const txCreateToken = platform.connect(user0).createCompaign(...argsToken);
            //отправляем и ждем, что отвалится с ошибкой
           await expect(txCreateToken).revertedWithCustomError(platform, "FundVerseUnsupportedToken")
            .withArgs(tokenERC20);
        });

        //проверяем, что не можем удалить то, чего нет
        it("should not remove unsupported token", async function() {
            const {ownerPlatform, platform, tokenERC20} = await loadFixture(deploy);            
            
            //удалим токен, которого не добавляли
            const tx = platform.connect(ownerPlatform).removeTokenFromAllowed(tokenERC20);
            //и ждем, что отвалится
            await expect(tx).revertedWithCustomError(platform, "FundVerseRemovingTokenNotSupported").withArgs(tokenERC20);
        }); 

        // проверяем, что токен не может удалить кто попало
        it("should not remove token by unauthorized user", async function() {
            const { user0, platform, tokenERC20} = await loadFixture(deploy);                        
            
            //добавляем токен от имени user0, и ждем, что отвалится
            const tx = platform.connect(user0).removeTokenFromAllowed(tokenERC20);
            await expect(tx).revertedWithCustomError(platform, "AccessControlUnauthorizedAccount");
        });

    });    

    describe("platform configuration tests", function() {
        
        //проверяем, что можно изменить параметр таймлока
        it("should change default timelock delay", async function() {
            const {ownerPlatform, platform } = await loadFixture(deploy);            
            const newDelay = 60 * 60 * 24;
            const tx = await platform.connect(ownerPlatform).setDelay(newDelay);
            tx.wait(1);            
            await expect(tx).to.emit(platform, "FundVersePlatformParameterUpdated")
                .withArgs("delay", newDelay, ownerPlatform);
            expect(await platform.getDelay()).equal(newDelay);            
        });

        //проверяем, что кто попало не может изменить параметр таймлока
        it("should revert unauthorized change default timelock delay", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);            
            const newDelay = 60 * 60 * 24;
            const tx = platform.connect(user0).setDelay(newDelay);
            
            await expect(tx).revertedWithCustomError(platform, "AccessControlUnauthorizedAccount");
            expect(await platform.getDelay()).not.equal(newDelay);            
        });

       
    });    

});