import { loadFixture, ethers, expect  } from "./setup";
import { upgrades } from "hardhat";
import { network } from "hardhat";
import { defaultCreateCampaignArgs, EVENT_HASHES, loyaltyProgram } from "./test-helpers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { any } from "hardhat/internal/core/params/argumentTypes";


describe("Dispatcher tests", function() {
    async function deploy() {        
        const [ownerPlatform, userCreator, user0, user1, user2, user3, beneficiar] = await ethers.getSigners();               
        
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
        
        //деплоим контракт-диспетчер
        const dispatcher_Factory = await ethers.getContractFactory("StatusDispatcher");
        const dispatcher = await dispatcher_Factory.deploy();
        await dispatcher.waitForDeployment();  

        // присобачиваем его к нашей платформе
        const tx = await platform.connect(ownerPlatform).setStatusDispatcher(dispatcher);
        tx.wait(5);

        // фабрика заглушек
        const dummy_Factory = await ethers.getContractFactory("DummyCampaign");

        return {ownerPlatform, userCreator, 
            user0, user1, user2, user3, 
            platform, tokenERC20, tokenERC20Addr, factory,
            beneficiar, dispatcher, dummy_Factory
        };
    }

    //проверим, как у нас регистрируются и отписываются создаваемые кампании
    describe("register/unregister tеsts", function() { 
        //простой тест, что кампания зарегистрировалась
        it("should be register campaign", async function() {
            const { user0, platform, dispatcher } = await loadFixture(deploy);                                   
            
            //создаем кампанию
            //формируем стандарный набор аргументов кампании
            const args = defaultCreateCampaignArgs();
            const txCreate = await platform.connect(user0).createCampaign(...args);
            await txCreate.wait();   
            
            //смотрим что получилось
            const campaignAddr = await platform.getCampaignByIndex(0);
            const nextCampaign = (await dispatcher.getNextCampaign()).campaign;                        
            
            expect(campaignAddr).equal(nextCampaign);
            expect(txCreate).emit(dispatcher, "CampaignRegistered").withArgs(campaignAddr, anyValue);                        

        });

        //тест на отмену регистрации
        it("should be unregister campaign", async function() {
            const { user0, platform, dispatcher, dummy_Factory } = await loadFixture(deploy);                                   
            
            //создадим кампанию-заглушку
            
            const dummy = await dummy_Factory.deploy(dispatcher);
            await dummy.waitForDeployment();            
            
            const deadline = Math.floor(Date.now() / 1000) + 1;

            //зарегистрируем нашу заглушку
            const txReg = await dummy.register(deadline);

            //смотрим что получилось
            const dummyAddr = await dummy.getAddress();
            const nextCampaign = (await dispatcher.getNextCampaign()).campaign;                        
            
            expect(dummyAddr).equal(nextCampaign);
            expect(txReg).emit(dispatcher, "CampaignRegistered").withArgs(dummyAddr, anyValue);

            // отменим регистрацию
            const unRegTx = await dummy.unRegister();
            const dispCampaign = (await dispatcher.getNextCampaign()).campaign;            
            expect(dispCampaign).equal(ethers.ZeroAddress);
            expect(txReg).emit(dispatcher, "CampaignUnregistered").withArgs(dummyAddr, anyValue);

        });

        //отрицательный тест на повторную регистрацию
        it("should be reverted register twice", async function() {
            const { user0, platform, dispatcher, dummy_Factory } = await loadFixture(deploy);                                   
            
            //создадим кампанию-заглушку            
            const dummy = await dummy_Factory.deploy(dispatcher);
            await dummy.waitForDeployment();            
            
            const deadline = Math.floor(Date.now() / 1000) + 1;

            //зарегистрируем нашу заглушку
            const txReg = await dummy.register(deadline);

            //смотрим что получилось
            const dummyAddr = await dummy.getAddress();
            const nextCampaign = (await dispatcher.getNextCampaign()).campaign;                        

            // попробуем зарегистрировать повторно
            const txReg2 = dummy.register(deadline);            
            await expect(txReg2).revertedWithCustomError(dispatcher, "CampaignAlreadyRegistered");

        });

        //отрицательный тест на отмену регистрации незарегистрированной кампании
        it("should be reverted unregister not registered", async function() {
            const { user0, platform, dispatcher, dummy_Factory } = await loadFixture(deploy);                                   
            
            //создадим кампанию-заглушку            
            const dummy = await dummy_Factory.deploy(dispatcher);
            await dummy.waitForDeployment();            
            
            const deadline = Math.floor(Date.now() / 1000) + 1;

            //зарегистрируем нашу заглушку
            const txReg = await dummy.register(deadline);

            //созздадим вторую заглушку
            const dummy2 = await dummy_Factory.deploy(dispatcher);
            await dummy2.waitForDeployment();            
            
            // и попробуем отменить регистрацию второй заглушки
            const txUnreg = dummy2.unRegister();            
            await expect(txUnreg).revertedWithCustomError(dispatcher, "CampaignNotRegistered");

        });

        //тест на создание и удаления множества кампаний
        it("should maintain heap order on register/unregister and report gas usage", async function() {
            const { user0, platform, dispatcher, dummy_Factory } = await loadFixture(deploy);                                   
            
            const gasRegister = [];
            const gasUnregister = [];

            // разный набор дедлайнов, чтобы куча перестраивалась
            const deadlines = [50, 40, 60, 30, 10, 70, 20, 10, 80, 25, 15, 65, 8];
            const campaignAddrs = [];
            const NUM_CAMPAIGNS = deadlines.length;

            console.log("\n--- Register phase ---");

            for (let i = 0; i < NUM_CAMPAIGNS; i++) {
                
                // создаем кампанию
                const dummy = await dummy_Factory.deploy(dispatcher);
                await dummy.waitForDeployment();            

                // регистрируем кампанию через заглушку                
                const tx = await dummy.register(deadlines[i]);
                const receipt = await tx.wait();
                gasRegister.push(receipt?.gasUsed);

                // сохраняем адрес кампании, чтобы потом удалить
                const campaignAddr = await dummy.getAddress();
                campaignAddrs.push(campaignAddr);

                // проверяем, что корень — минимальный дедлайн
                const [rootAddr, rootDeadline] = await dispatcher.getNextCampaign();
                const expectedMin = Math.min(...deadlines.slice(0, i + 1));
                expect(rootDeadline).to.equal(expectedMin);

                console.log(
                    `Registered #${i} (deadline=${deadlines[i]}): gas=${receipt?.gasUsed}, root=${rootDeadline}`
                );
            }

            console.log("\n--- Unregister phase ---");

            // теперь удаляем кампании в произвольном порядке
            for (let i = 0; i < NUM_CAMPAIGNS; i++) {
                
                const dummy = await ethers.getContractAt("DummyCampaign", campaignAddrs[i]);
                const tx = await dummy.unRegister();
                const receipt = await tx.wait();
                gasUnregister.push(receipt?.gasUsed);

                // проверим, что структура кучи корректна (root — минимальный из оставшихся)
                const remaining = deadlines.slice(i + 1);
                if (remaining.length > 0) {
                    const [rootAddr, rootDeadline] = await dispatcher.getNextCampaign();
                    const expectedMin = Math.min(...remaining);                    
                    expect(rootDeadline).to.equal(expectedMin);
                    console.log(
                    `Unregistered #${i}: gas=${receipt?.gasUsed}, new root=${rootDeadline}`
                    );
                } else {
                    console.log(`Unregistered last node: gas=${receipt?.gasUsed}`);
                }
            }

            console.log("\nGas used for register:", gasRegister.map(g => g?.toString()));
            console.log("Gas used for unregister:", gasUnregister.map(g => g?.toString()));

            // --- CSV экспорт для графика ---
            console.log("\n--- CSV export for chart ---");
            console.log("Index,RegisterGas,UnregisterGas");
            for (let i = 0; i < NUM_CAMPAIGNS; i++) {
                const regGas = gasRegister[i] || "";
                const unregGas = gasUnregister[i] || "";
                console.log(`${i+1},${regGas},${unregGas}`);
            }
        });
    });

    describe("chailink mock tеsts", function() {
        
        after(async () => {
            await network.provider.send("hardhat_reset");
        });            

        //простой тест на автоматизацию
        it("should UpKeep", async function() {            
            const { user0, platform, dispatcher } = await loadFixture(deploy);                                   

            //создадим Chainlink            
        
            const chailink_Factory = await ethers.getContractFactory("ChainlinkMock");
            const chailink = await chailink_Factory.deploy(dispatcher);
            chailink.waitForDeployment();            
            
            //создаем кампанию
            //формируем стандарный набор аргументов кампании
            const args = defaultCreateCampaignArgs();
            const txCreate = await platform.connect(user0).createCampaign(...args);
            await txCreate.wait();   

            const campaignAddr = await platform.getCampaignByIndex(0);
            const campaign = await ethers.getContractAt("CampaignNative", campaignAddr);
            
        
            const status_before = await campaign.status();
            const nextCampaign_before = (await dispatcher.getNextCampaign()).campaign;

            expect(status_before).equal(0);
            //проматываем время...            

            const DEADLINE_SHIFT = 7 * 24 * 60 * 60; // например, неделя

            await network.provider.send("evm_increaseTime", [DEADLINE_SHIFT]);
            await network.provider.send("evm_mine"); // создаём новый блок            

            // теперь моделируем деятельность chailink

            const txUpKeep = await chailink.callDispatcher();

            const newStatus = await campaign.status();
            const nextCampaign = (await dispatcher.getNextCampaign()).campaign;            

            expect(newStatus).equal(3); // 3 - Failed
            expect(txUpKeep).to.emit(dispatcher, "CampaignUnregistered").withArgs(nextCampaign_before, anyValue);
            expect(nextCampaign).equal(ethers.ZeroAddress);

        });
    });
});
