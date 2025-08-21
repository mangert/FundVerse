import { loadFixture, ethers, expect  } from "./setup";
import { upgrades } from "hardhat";
import { network } from "hardhat";
import { defaultCreateCampaignArgs, EVENT_HASHES } from "./test-helpers";


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
            const txCreate = await platform.connect(user0).createCampaign(...args);
            
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
            const txCreate = await platform.connect(user0).createCampaign(...args);
            
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
            const txCreateNative = platform.connect(user0).createCampaign(...argsNative);
            //отправляем и ждем, что отвалится с ошибкой
            await expect(txCreateNative).revertedWithCustomError(platform, "FundVerseErrorZeroGoal");
            
            //а теперь то же самое в токенах
            //добавим наш токен в список
            (await platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20Addr)).wait(1);
            
            //меняем в аргументах цель на ноль
            const argsToken = defaultCreateCampaignArgs({goal:0, token: tokenERC20Addr});

            //формируем транзакцию
            const txCreateToken = platform.connect(user0).createCampaign(...argsToken);
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
            const txCreateNative = platform.connect(user0).createCampaign(...argsNative);
            //отправляем и ждем, что отвалится с ошибкой
            await expect(txCreateNative).revertedWithCustomError(platform, "FundVerseErrorDeadlineLessMinimun");
            
            //а теперь то же самое в токенах
            //добавим наш токен в список
            (await platform.connect(ownerPlatform).addTokenToAllowed(tokenERC20Addr)).wait(1);
            //уменьшаем в аргументах дедлайн до 1 минуты
            const argsToken = defaultCreateCampaignArgs({deadline: BigInt(Math.floor(Date.now() / 1000)) + 60n, token: tokenERC20Addr});
            //формируем транзакцию
            const txCreateToken = platform.connect(user0).createCampaign(...argsToken);
            //отправляем и ждем, что отвалится с ошибкой
            await expect(txCreateToken).revertedWithCustomError(platform, "FundVerseErrorDeadlineLessMinimun");            
        });
        //проверка реверта создания кампаний до истечения таймлока
        it("should revert create campaign before timelock expired", async function() {
            const {ownerPlatform, user0, platform, tokenERC20Addr} = await loadFixture(deploy);            
            //формируем стандарный набор аргументов кампании
            const args0 = defaultCreateCampaignArgs();
            
            //создаем кампанию
            const txCreate = await platform.connect(user0).createCampaign(...args0);
            
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
            const txCreate1 = platform.connect(user0).createCampaign(...args1);
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
            const txCreate2 = await platform.connect(user0).createCampaign(...args2);
            //и проверяем, что у нашего user0 теперь две кампании
            expect(await platform.getCampaignsCountByFounder(user0)).equal(2);            
        });

        //проверка реверта создания кампаний в неподдерживаемой валюте
        it("should revert campaign in unsupported token", async function() {
            const {user0, platform, tokenERC20, tokenERC20Addr} = await loadFixture(deploy); 
            
            const argsToken = defaultCreateCampaignArgs({ token: tokenERC20Addr});
            //формируем транзакцию
            const txCreateToken = platform.connect(user0).createCampaign(...argsToken);
            //отправляем и ждем, что отвалится с ошибкой
           await expect(txCreateToken).revertedWithCustomError(platform, "FundVerseUnsupportedToken")
            .withArgs(tokenERC20);
        });

        //проверка реверта создания кампаний если установленный залог не перечислен
        it("should revert campaign whithout deposit", async function() {
            const {ownerPlatform, user0, platform } = await loadFixture(deploy); 
            
            //установим размер залога
            const deposit = 1000n;
            const txSetDeposit = platform.connect(ownerPlatform).setRequiredDeposit(deposit);
            (await txSetDeposit).wait(1);

            //формируем стандарный набор аргументов кампании
            const args = defaultCreateCampaignArgs();
            //сделаем транзакцию по созданию кампании, но залог перечислять не будем
            const txCreate = platform.connect(user0).createCampaign(...args);
            //и ожидаем, что отвалится
            await expect(txCreate).revertedWithCustomError(platform, "FundVerseInsufficientDeposit")
                .withArgs(0, deposit);
            
            //сделаем транзакцию по созданию с перечислением залога (должна пройти)            
            const txCreateDep = await platform.connect(user0).createCampaign(...args, {value : deposit});
            expect(await platform.getCampaignsCountByFounder(user0)).equal(1);     
            expect(txCreateDep).to.emit(platform, "FundVerseDepositLocked")
                .withArgs(user0, deposit, await platform.getCampaignByIndex(0));
            
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
            const txCreateToken = platform.connect(user0).createCampaign(...argsToken);
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

    //тесты конфигурирования платформы
    describe("platform configuration tests", function() {
        
        //проверяем, что можно изменить параметр таймлока
        it("should change default timelock delay", async function() {
            const {ownerPlatform, platform } = await loadFixture(deploy);            
            const newDelay = 60 * 60 * 24;
            const tx = await platform.connect(ownerPlatform).setDelay(newDelay);
            tx.wait(1);            
            await expect(tx).to.emit(platform, EVENT_HASHES.PARAM_UINT)
                .withArgs(ethers.keccak256(ethers.toUtf8Bytes("delay")), newDelay, ownerPlatform);
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

        //проверяем, что можно устанавливать размеры залогов
        it("should set require deposit", async function() {
            const {ownerPlatform, platform } = await loadFixture(deploy);            
            //установим размер залога
            const deposit = 1000n;
            const txSetDeposit = await platform.connect(ownerPlatform).setRequiredDeposit(deposit);
            txSetDeposit.wait(1);
            //проверяем, что получилось
            expect(txSetDeposit).to.emit(platform, EVENT_HASHES.PARAM_UINT)
                .withArgs(ethers.keccak256(ethers.toUtf8Bytes("depositAmount")), deposit, ownerPlatform);
        });

        //проверяем, что кто попало не может изменить параметр размера залога
        it("should revert unauthorized change required deposit ", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);            
            //установим размер залога
            const deposit = 1000n;
            const txSetDeposit = platform.connect(user0).setRequiredDeposit(deposit);            
            //проверяем, что получилось
            await expect(txSetDeposit).revertedWithCustomError(platform, "AccessControlUnauthorizedAccount");            
        
        });

        //проверяем, что можно устанавливать минимальный дедлайн
        it("should set minimal lifespan", async function() {
            const {ownerPlatform, platform } = await loadFixture(deploy);            

            const lifespan = 60 * 60;
            const txSetLifespan = await platform.connect(ownerPlatform).setMinLifespan(lifespan);
            
            expect(txSetLifespan).to.emit(platform, EVENT_HASHES.PARAM_UINT)
                .withArgs(ethers.keccak256(ethers.toUtf8Bytes("minLifespan")), lifespan, ownerPlatform);            
        });

        //проверяем, что кто попало не может менять минимальный дедлайн
        it("should revert unauthorized change default minLifespan", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);            
            const lifespan = 60 * 60;
            const txSetLifespan = platform.connect(user0).setMinLifespan(lifespan);            
            //проверяем, что получилось
            await expect(txSetLifespan).revertedWithCustomError(platform, "AccessControlUnauthorizedAccount");            
        
        });

        //проверяем, что можно установить размер базовой комиссии
        it("should change base fee", async function() {
            const {ownerPlatform, platform } = await loadFixture(deploy);            
            const newBaseFee = 70n;
            const tx = await platform.connect(ownerPlatform).setBaseFee(newBaseFee);
            tx.wait(1);            
            await expect(tx).to.emit(platform, EVENT_HASHES.PARAM_UINT)
                .withArgs(ethers.keccak256(ethers.toUtf8Bytes("baseFee")), newBaseFee, ownerPlatform);
            expect(await platform.getBaseFee()).equal(newBaseFee);            
        });
        
        //проверяем, что кто попало не может установить размер базовой комиссии
        it("should revert unauthorized base fee", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);            
            const newBaseFee = 70;
            const tx = platform.connect(user0).setBaseFee(newBaseFee);
            await expect(tx).revertedWithCustomError(platform, "AccessControlUnauthorizedAccount");            
        });
    });    

    //тесты выводов средств с платформы
    describe("platform withdraw", function() {        
        //проверяем, что владелец может вывести с контракта эфиры
        it("should withraw incomes in native", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);                      
            
            //кинем на наш контракт как-бы прибыль
            //для этого создадим отправителя
            const sender_Factory = await ethers.getContractFactory("ETHSender");
            const sender = await sender_Factory.deploy();
            sender.waitForDeployment();
            const incomes = 1000n;
            await sender.sendTo(platform.target, {value : incomes});            

            const txWD = await platform.connect(ownerPlatform)["withdrawIncomes(address,uint256)"]
            (user0, incomes);
            await txWD.wait(1);

            expect(txWD).to.emit(platform, "FundVerseWithdrawn").withArgs(incomes, user0, ethers.ZeroAddress);
            expect(txWD).changeEtherBalances
                (                    
                    [user0, platform],
                    [incomes, -incomes]
                );            
        });
        //проверяем, что вывод отвалится, если попытаться вывести больше, чем есть
        it("should revert withraw more than incomes in native", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);                      
            
            //кинем на наш контракт как-бы прибыль
            //для этого создадим отправителя
            const sender_Factory = await ethers.getContractFactory("ETHSender");
            const sender = await sender_Factory.deploy();
            sender.waitForDeployment();
            const incomes = 1000n;
            await sender.sendTo(platform.target, {value : incomes});            
            
            //создадим штуки 3 кампании, чтобы накопился залог            
            const count = 3n;            
            const args = defaultCreateCampaignArgs();
            //установим размер залога
            const deposit = 1000n;
            const txSetDeposit = await platform.connect(ownerPlatform).setRequiredDeposit(deposit);
            (await txSetDeposit).wait(1);                                   
            
            //сбросим таймлок, чтобы не мешался
            const txSetTimelock = (await platform.connect(ownerPlatform).setDelay(0)).wait(1);
            for(let i = 0; i != 3; ++i){
                const tx = await platform.connect(user0).createCampaign(...args, {value : deposit});
                await tx.wait(1);
            }
            const totalDep = deposit * count;            

            //пробуем вывести вообще все
            const txWD = platform.connect(ownerPlatform)["withdrawIncomes(address,uint256)"]
            (user0, incomes + totalDep);
            
            //и ожидаем, что отвалится
            await expect(txWD).revertedWithCustomError(platform, "FundVerseInsufficientFunds")
                .withArgs(incomes + totalDep, incomes, ethers.ZeroAddress);            
        });

        //проверяем, что кто попало не может вывести
        it("should revert unauthorized withraw incomes in native", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);                      
            
            //кинем на наш контракт как-бы прибыль
            //для этого создадим отправителя
            const sender_Factory = await ethers.getContractFactory("ETHSender");
            const sender = await sender_Factory.deploy();
            sender.waitForDeployment();
            const incomes = 1000n;
            await sender.sendTo(platform.target, {value : incomes});            
            
            //пробуем вывести прибыль от имени левого кошелька
            const txWD = platform.connect(user0)["withdrawIncomes(address,uint256)"]
            (user0, incomes);
            
            //и ожидаем, что отвалится
            await expect(txWD).revertedWithCustomError(platform, "AccessControlUnauthorizedAccount");            
        });

        //проверяем, что можно вывеcти доход в токенах
        it("should withraw incomes in token", async function() {
            const {user0, ownerPlatform, platform, tokenERC20, tokenERC20Addr } = await loadFixture(deploy);            
            
            const incomes = 1000000n;
            //наминтим на адрес платформы токенов и представим, что это пришли комиссии
            const txMint = await tokenERC20.mint(platform.getAddress(), incomes);

            //попробуем вывести на адрес скажем user0.
            const txWD = await platform.connect(ownerPlatform)["withdrawIncomes(address,uint256,address)"]
            (user0, incomes, tokenERC20Addr);
            await txWD.wait(1);

            expect(txWD).to.emit(platform, "FundVerseWithdrawn").withArgs(incomes, user0, tokenERC20Addr);
            expect(txWD).changeTokenBalances
                (
                    tokenERC20,
                    [user0, platform],
                    [incomes, -incomes]
                );
        });
        
        //проверяем, что кто попало не может выести доход в токенах
        it("should withraw incomes in token", async function() {
            const {user0, ownerPlatform, platform, tokenERC20, tokenERC20Addr } = await loadFixture(deploy);            
            
            const incomes = 1000000n;
            //наминтим на адрес платформы токенов и представим, что это пришли комиссии
            const txMint = await tokenERC20.mint(platform.getAddress(), incomes);

            //попробуем вывести от имени левого кошелька
            const txWD = platform.connect(user0)["withdrawIncomes(address,uint256,address)"]
            (user0, incomes, tokenERC20Addr);
            await expect(txWD).revertedWithCustomError(platform, "AccessControlUnauthorizedAccount");
        });
        
        //проверяем, что нельзя вывести деньги в токенах больше, чем есть
        it("should revert withraw more than incomes in token", async function() {
            const {user0, ownerPlatform, platform, tokenERC20, tokenERC20Addr } = await loadFixture(deploy);            
            
            const incomes = 1000000n;
            //наминтим на адрес платформы токенов и представим, что это пришли комиссии
            const txMint = await tokenERC20.mint(platform.getAddress(), incomes);

            const delta = 1000n;
            //попробуем вывести на адрес скажем user0 больше, чем есть на дельту
            const txWD = platform.connect(ownerPlatform)["withdrawIncomes(address,uint256,address)"]
            (user0, incomes + delta, tokenERC20Addr);            

            //и ожидаем, что отвалится
            await expect(txWD).revertedWithCustomError(platform, "FundVerseInsufficientFunds")
                .withArgs(incomes + delta, incomes, tokenERC20);            
        });      

        //проверяем, что можно вывести залог
        it("should return deposit", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);
            //установим размер залога
            const depositAmount = 1000;
            const txSetDeposit = await platform.setRequiredDeposit(depositAmount);
            txSetDeposit.wait(1);

            //проверим
            expect(await platform.getRequiredDeposit()).equal(depositAmount);

            //формируем стандарный набор аргументов кампании
            const args = defaultCreateCampaignArgs();
            //создаем кампанию
            const txCreate = await platform.connect(user0).createCampaign(...args, {value : depositAmount});
            
            //получим адрес кампании
            const campaignAddr = await platform.getCampaignByIndex(0);
            const campaign = await ethers.getContractAt("CampaignNative", campaignAddr);
            
            //завершим кампанию - перечислим средства до цели
            const goal = await campaign.goal();
            const txContribute = await campaign.connect(user0)["contribute()"]({value: goal});
            txContribute.wait(1);

            //а теперь вернем депозит
            const txReturnDep = await platform.connect(user0).returnDeposit(campaign);
            await txReturnDep.wait(1);
            //и проверим, что получилось
            await expect(txReturnDep).changeEtherBalances([user0, platform], [depositAmount, -depositAmount]);
            await expect(txReturnDep).to.emit(platform, "FundVerseDepositReturned")
                .withArgs(user0, depositAmount, campaign);
        });     

        //проверяем, что нельзя вывести залог, если кампания не завершилась
        it("should revert return deposit from unfinished campaign", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);
            //установим размер залога
            const depositAmount = 1000;
            const txSetDeposit = await platform.setRequiredDeposit(depositAmount);
            txSetDeposit.wait(1);

            //проверим
            expect(await platform.getRequiredDeposit()).equal(depositAmount);

            //формируем стандарный набор аргументов кампании
            const args = defaultCreateCampaignArgs();
            //создаем кампанию
            const txCreate = await platform.connect(user0).createCampaign(...args, {value : depositAmount});
            
            //получим адрес кампании
            const campaignAddr = await platform.getCampaignByIndex(0);
            const campaign = await ethers.getContractAt("CampaignNative", campaignAddr);
            
            //не будем завершать кампанию

            //и попробуем вернуть депозит
            const txReturnDep = platform.connect(user0).returnDeposit(campaign);
            
            //ждем, что отвалится
            await expect(txReturnDep).revertedWithCustomError(platform, "FundVerseDepositNotYetReturnable");
        });

        //проверяем, что нельзя вывести залог дважды
        it("should revert twice return deposit", async function() {
            const {user0, ownerPlatform, platform } = await loadFixture(deploy);
            //установим размер залога
            const depositAmount = 1000;
            const txSetDeposit = await platform.setRequiredDeposit(depositAmount);
            txSetDeposit.wait(1);

            //проверим
            expect(await platform.getRequiredDeposit()).equal(depositAmount);

            //формируем стандарный набор аргументов кампании
            const args = defaultCreateCampaignArgs();
            //создаем кампанию
            const txCreate = await platform.connect(user0).createCampaign(...args, {value : depositAmount});
            
            //получим адрес кампании
            const campaignAddr = await platform.getCampaignByIndex(0);
            const campaign = await ethers.getContractAt("CampaignNative", campaignAddr);
            
            //завершим кампанию - перечислим средства до цели
            const goal = await campaign.goal();
            const txContribute = await campaign.connect(user0)["contribute()"]({value: goal});
            txContribute.wait(1);                        
            
            //и попробуем вернуть депозит
            const txReturnDep = await platform.connect(user0).returnDeposit(campaign);
            txReturnDep.wait(1);

            //и еще раз
            const txReturnDep2 = platform.connect(user0).returnDeposit(campaign);
            
            //ждем, что отвалится
            await expect(txReturnDep2).revertedWithCustomError(platform, "FundVerseZeroWithdrawnAmount");
        });

        //проверяем, что нельзя вывести чужой залог
        it("should revert return not own deposit", async function() {
            const {user0, user1, ownerPlatform, platform } = await loadFixture(deploy);
            //установим размер залога
            const depositAmount = 1000;
            const txSetDeposit = await platform.setRequiredDeposit(depositAmount);
            txSetDeposit.wait(1);

            //проверим
            expect(await platform.getRequiredDeposit()).equal(depositAmount);

            //формируем стандарный набор аргументов кампании
            const args = defaultCreateCampaignArgs();
            //создаем кампанию
            const txCreate = await platform.connect(user0).createCampaign(...args, {value : depositAmount});
            
            //получим адрес кампании
            const campaignAddr = await platform.getCampaignByIndex(0);
            const campaign = await ethers.getContractAt("CampaignNative", campaignAddr);
            
            //завершим кампанию - перечислим средства до цели
            const goal = await campaign.goal();
            const txContribute = await campaign.connect(user0)["contribute()"]({value: goal});
            txContribute.wait(1);                        
            
            //и попробуем вернуть депозит
            const txReturnDep = platform.connect(user1).returnDeposit(campaign);            

            //ждем, что отвалится
            await expect(txReturnDep).revertedWithCustomError(platform, "FundVerseNotCampaignFounder");
        });            
    });
    
    //тестируем программу лояльности
    describe("loyaty program tеsts", function() {
        
        //хелпер - чтобы каждый раз не деполить нашу программу
        async function loyaltyProgram (ownerPlatform : any, platform  : any) {        
            
            //деплоим
            const loyalty_Factory = await ethers.getContractFactory("FundVerseLoyaltyv1");
            const loyalty = await loyalty_Factory.deploy(ownerPlatform, platform);
            loyalty.waitForDeployment();
            
            return loyalty;            
        }
        
        //проверяем возможности деплоя и настройки комиссий
        // - положительный и отрицательный сценарии
        it("should possible set discount", async function() {
            
            const {user0, user1, ownerPlatform, platform } = await loadFixture(deploy);

            //установим комиссию платформы
            const baseFee = 20;
            const txSetPlatformFee = await platform.connect(ownerPlatform).setBaseFee(baseFee);
            
            //задеплоим программу лояльности
            const loyalty = await loyaltyProgram(ownerPlatform, platform);
            expect(platform.target).to.be.properAddress;            

            //настроим дисконт - 10 промилле
            const discount = 10;
            const txSetDiscont = await loyalty.connect(ownerPlatform).setFeeDiscount(discount);
            expect(txSetDiscont).to.emit(loyalty, "FeeDiscountChanged")
                .withArgs(0, discount, ownerPlatform);
            expect(await loyalty.feeDiscount()).equal(discount);

            //поменяем дисконт на недопустимый - больше комиссии
            const txSetDiscont2 = loyalty.connect(ownerPlatform).setFeeDiscount(discount + baseFee);
            await expect(txSetDiscont2).revertedWithCustomError(loyalty, "UnacceptableFeeDiscount")
                .withArgs(discount + baseFee);

            //поменяем дисконт на недопустиым - больше 1000
            const txSetDiscont3 = loyalty.connect(ownerPlatform).setFeeDiscount(1001);
            await expect(txSetDiscont3).revertedWithCustomError(loyalty, "UnacceptableFeeDiscount")
                .withArgs(1001);    

            //поменяем дисконт на допустимый от имени кого попало
            const txSetDiscont4 = loyalty.connect(user0).setFeeDiscount(discount);
            await expect(txSetDiscont4).revertedWithCustomError(loyalty, "OwnableUnauthorizedAccount");                
        });

        //проверяем возможности настройки адреса платформы
        // - положительный и отрицательный сценарии
        it("should possible set platform", async function() {
            
            const {user0, user1, ownerPlatform, platform } = await loadFixture(deploy);
                        
            //задеплоим программу лояльности
            const loyalty = await loyaltyProgram(ownerPlatform, platform);
            expect(platform.target).to.be.properAddress;            

            //сначала поменяем на действительный адрес(пусть это и не наша платформа)            
            const txSetPlatform = await loyalty.connect(ownerPlatform).setPlatformAddress(user0);
            expect(txSetPlatform).to.emit(loyalty, "PlatformAddressChanged")
                .withArgs(platform, user0, ownerPlatform);            

            //поменяем на недопустимый - нулевой
            const txSetPlatform2 = loyalty.connect(ownerPlatform).setPlatformAddress(ethers.ZeroAddress);
            await expect(txSetPlatform2).revertedWithCustomError(loyalty, "UnacceptablePlatformAddress")
                .withArgs(ethers.ZeroAddress);

            //поменяем на допустимый от имени кого попало
            const txSetPlatform3 = loyalty.connect(user0).setPlatformAddress(user0);
            await expect(txSetPlatform3).revertedWithCustomError(loyalty, "OwnableUnauthorizedAccount");                
        });

        //прооверим подключение программы лояльности к платформе        
        it("should set loyalty program on platform", async function() {
            
            const {user0, user1, ownerPlatform, platform } = await loadFixture(deploy);                        
            
            //задеплоим программу лояльности
            const loyalty = await loyaltyProgram(ownerPlatform, platform);            

            //установим нашу программу на платформе
            const txSetLoyalty = await platform.connect(ownerPlatform).setLoyaltyProgram(loyalty);
            await expect(txSetLoyalty).to.emit(platform, EVENT_HASHES.PARAM_ADDRESS)
                .withArgs(ethers.keccak256(ethers.toUtf8Bytes("loyaltyProgram")), loyalty, ownerPlatform);

            //проверим, что можно отключить программу лояльности    
            const txSetLoyaltyOff = await platform.connect(ownerPlatform).setLoyaltyProgram(ethers.ZeroAddress);
            await expect(txSetLoyaltyOff).to.emit(platform, EVENT_HASHES.PARAM_ADDRESS)
                .withArgs(ethers.keccak256(ethers.toUtf8Bytes("loyaltyProgram")), ethers.ZeroAddress, ownerPlatform);
            
            //проверим, что нельзя прицепить что попало (ну например - сам адрес платформы)
            const txSetBadLoyalty = platform.connect(ownerPlatform).setLoyaltyProgram(platform);
            await expect(txSetBadLoyalty).revertedWithCustomError(platform, "FundVerseUnacceptableLoyaltyProgram")
                .withArgs(platform);
            
        });

        //сложный тест на минт NFT
        it("should mint NFT", async function() {
            
            const {user0, user1, ownerPlatform, platform } = await loadFixture(deploy);                        
            
            //1. Подготовка
            //задеплоим программу лояльности
            const loyalty = await loyaltyProgram(ownerPlatform, platform);            

            //установим комиссию платформы
            const baseFee = 20;
            const txSetPlatformFee = await platform.connect(ownerPlatform).setBaseFee(baseFee);
            //сбросим таймлок, чтобы не мешался
            (await platform.connect(ownerPlatform).setDelay(0)).wait(1);
            //установим нашу программу на платформе            
            const txSetLoyalty = await platform.connect(ownerPlatform).setLoyaltyProgram(loyalty);
            
            //настроим дисконт - 10 промилле
            const discount = 10;
            const txSetDiscont = await loyalty.connect(ownerPlatform).setFeeDiscount(discount);

            //2. Создадим и завершим кампанию
            //создаем кампанию
            const args = defaultCreateCampaignArgs();
            const txCreate = await platform.connect(user0).createCampaign(...args);
            
            //получим адрес кампании
            const campaignAddr = await platform.getCampaignByIndex(0);
            const campaign = await ethers.getContractAt("CampaignNative", campaignAddr);
            
            //завершим кампанию - перечислим средства до цели
            const goal = await campaign.goal();
            const txContribute = await campaign.connect(user0)["contribute()"]({value: goal});
            txContribute.wait(1); 
            
            //3. Пробуем сминтить NFT
            const mintTx = await loyalty.connect(user0).safeMint(user0);
            expect(mintTx).to.emit(loyalty, "Transfer").withArgs(ethers.ZeroAddress, user0, 1);

            //4. Для пробы - еще раз (должно отвалиться)
            const mintTx2 = loyalty.connect(user0).safeMint(user0);
            await expect(mintTx2).revertedWithCustomError(loyalty, "RepeatNFTRequest")
                .withArgs(user0, 1);
        });

        //тес проверки расчетов комиссий со скидками по NFT
        it("should calculate founder fees", async function() {
            
            const {user0, user1, ownerPlatform, platform } = await loadFixture(deploy);                        
            
            //1. Подготовка
            //задеплоим программу лояльности
            const loyalty = await loyaltyProgram(ownerPlatform, platform);            

            //установим комиссию платформы
            const baseFee = 20;
            (await platform.connect(ownerPlatform).setBaseFee(baseFee)).wait(1);
            //сбросим таймлок, чтобы не мешался
            (await platform.connect(ownerPlatform).setDelay(0)).wait(1);
            //установим нашу программу на платформе            
            const txSetLoyalty = await platform.connect(ownerPlatform).setLoyaltyProgram(loyalty);
            
            //настроим дисконт - 10 промилле
            const discount = 10n;
            const txSetDiscont = await loyalty.connect(ownerPlatform).setFeeDiscount(discount);

            //2. Создадим и завершим кампанию
            //создаем кампанию
            const args = defaultCreateCampaignArgs();
            const txCreate = await platform.connect(user0).createCampaign(...args);
            
            //получим адрес кампании
            const campaignAddr = await platform.getCampaignByIndex(0);
            const campaign = await ethers.getContractAt("CampaignNative", campaignAddr);
            
            //завершим кампанию - перечислим средства до цели
            const goal = await campaign.goal();
            const txContribute = await campaign.connect(user0)["contribute()"]({value: goal});
            txContribute.wait(1); 
            
            //3. Сминтим NFT
            const mintTx = await loyalty.connect(user0).safeMint(user0);

            //4. Проверим комиссию для нашего user0 (должна быть fee - discount)
            expect(await platform.getFounderFee(user0)).equal(await platform.getBaseFee() - discount);

            //5. Уменьшим комиссию на платформе до размера дисконта и посмотрим, какая будет комиссия у фаундера (0)
            (await platform.connect(ownerPlatform).setBaseFee(discount)).wait(1);            
            expect(await platform.getFounderFee(user0)).equal(0);

             //6. Уменьшим комиссию на платформе меньше дисконта и посмотрим, какая будет комиссия у фаундера (0)
            const newBaseFee = discount - 5n;
             (await platform.connect(ownerPlatform).setBaseFee(newBaseFee)).wait(1);            
            expect(await platform.getFounderFee(user0)).equal(0);

            //7. Проверим, какая будет комиссия у фаундера без NFT
            expect(await platform.getFounderFee(user1)).equal(newBaseFee);

            //8. Отключим программу лояльности и проверим, какая теперь будет комиссия у нашего user0
            (await platform.connect(ownerPlatform).setLoyaltyProgram(ethers.ZeroAddress)).wait(1);    
            expect(await platform.getFounderFee(user0)).equal(newBaseFee);        
        });
    });
});