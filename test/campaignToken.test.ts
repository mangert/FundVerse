import { loadFixture, ethers, expect } from "./setup";
import { network } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {defaultCampaignArgs, getBadReciever} from "./test-helpers"

describe("Campaign Token", function() {
    async function deploy() {        
        const [userPlatform, userCreator, user0, user1, user2] = await ethers.getSigners();

        const token_Factory = await ethers.getContractFactory("TestTokenERC20");
        const tokenERC20 = await token_Factory.deploy();
        const tokenERC20Addr = await tokenERC20.getAddress();
        
        
          const args: [
                string, // platformAddress
                string, // creator
                string, // campaignName
                bigint, // Id
                bigint, // goal
                number, // deadline
                string, // campaignMeta
                number, // platformFee                      
            ] = defaultCampaignArgs({}, userPlatform.address, userCreator.address);      
        
        const campaign_Factory = await ethers.getContractFactory("CampaignToken");
        const campaign = await campaign_Factory.deploy(...args, tokenERC20, {});
        await campaign.waitForDeployment();        

        return { userPlatform, userCreator, user0, user1, user2, campaign, tokenERC20 }
    }

    describe("deployment tеsts", function() {
        it("should be deployed", async function() { //простой тест, что деплоится нормально
            const { userPlatform, userCreator, campaign, tokenERC20} = await loadFixture(deploy); 
            
            //заберем аргументы, с которыми деплоили
            const args = defaultCampaignArgs({}, userPlatform.address, userCreator.address);
            
            
            expect(campaign.target).to.be.properAddress;
            //и проверим, правильно ли установились поля
            expect (await campaign.creator()).equal(args[1]);
            expect (await campaign.campaignName()).equal(args[2]);
            expect (await campaign.id()).equal(args[3]);
            expect (await campaign.goal()).equal(args[4]);
            expect (await campaign.deadline()).to.be.closeTo(args[5], 1);
            expect (await campaign.campaignMeta()).equal(args[6]);
            expect (await campaign.platformFee()).equal(args[7]);       
            expect (await campaign.token()).equal(tokenERC20);       

        });
    
        it("should have 0 eth by default", async function() {
            const { campaign } = await loadFixture(deploy );
    
            const balance = await ethers.provider.getBalance(campaign.target);        
            expect(balance).eq(0);            
        });     
    });
    
    //тесты на взносы в кампанию
    describe("contribution tеsts", function() { 
        //просто проверяем, что взносы принимаются
        it("should possible contribute", async function() { 
            const {userPlatform, userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy);        

            //пусть будут 3 взноса
            const contributions = [100, 1000, 10000];

            //выдадим нашему user0 токены
            const txMint = await tokenERC20.mint(user0.address
                , contributions.reduce((acc, curr) => acc + curr, 0));
            
            let raised = 0;
            for(let counter = 0; counter != 3; ++counter) {               
                const txAppove = await tokenERC20.connect(user0)
                    .approve(await campaign.getAddress(), contributions[counter]);
                await txAppove.wait(1);
                
                const tx = await campaign.connect(user0)["contribute(uint128)"](contributions[counter]);
                await tx.wait(1);
                raised += contributions[counter];
                expect(await campaign.raised()).equal(raised);
                expect(await campaign.getContribution(user0)).equal(raised);
                await expect(tx).to.emit(campaign, "CampaignContribution").withArgs(user0, contributions[counter]);            
            }         
            const balance = await tokenERC20.balanceOf(campaign);
            expect(balance).equal(raised);               
        });
        
        //проверка корректности обработки взносов от нескольких участников
        it("should possible multi contributes", async function() { 
            const {user0, user1, user2, campaign, tokenERC20 } = await loadFixture(deploy);        

            //пусть будут 3 взноса
            const contributions = [100, 1000, 10000];
            const users = [user0, user1, user2];

            //выдадим нашим юзерам токены
            for(let counter = 0; counter != 3; ++counter) {
                tokenERC20.mint(users[counter], contributions[counter]);
            }

            let raised = 0;
            
            for(let counter = 0; counter != 3; ++counter) {               

                (await tokenERC20.connect(users[counter]).approve(
                    await campaign.getAddress(), 
                    contributions[counter])
                ).wait(1);

                const tx = await campaign.connect(users[counter])["contribute(uint128)"](contributions[counter]);
                await tx.wait(1);
                raised += contributions[counter];
                expect(await campaign.raised()).equal(raised);                
                expect(tx).changeTokenBalance(tokenERC20, users[counter], -contributions[counter]);
                expect(await campaign.getContribution(users[counter])).equal(contributions[counter]);
                await expect(tx).to.emit(campaign, "CampaignContribution").withArgs(users[counter], contributions[counter]);            
            }         

            const balance = await tokenERC20.balanceOf(campaign);
            expect(balance).equal(raised);               
        });

        //проверяем, что взносы принимаются до цели и возвращается сдача
        it("should refund overgoal contribution", async function() { 
            const {userPlatform, userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy);        

            //пусть будут 3 взноса внутри суммы            
            const contributions = [100, 1000, 10000];

            const txMint = await tokenERC20.mint(user0.address, contributions.reduce((acc, curr) => acc + curr, 0));

            for(let counter = 0; counter != 3; ++counter) {
                
                (await tokenERC20.connect(user0).approve(
                    await campaign.getAddress(), 
                    contributions[counter])
                ).wait(1);

                const tx = await campaign.connect(user0)["contribute(uint128)"](contributions[counter]);
                await tx.wait(1);                           
            }         

            //и еще один, который будет больше, чем остаток, скажем, на 500;
            const accepted = (await campaign.goal()) - (await campaign.raised()); //считаем остаток
            const refund = 500n; //добавляем плюс
            const overcontribution = accepted + refund; //формируем избыточный взнос            
            
            (await tokenERC20.mint(userCreator.address, overcontribution)).wait(1);

            await tokenERC20.connect(userCreator).approve(await campaign.getAddress(), overcontribution);
            
            const tx = await campaign.connect(userCreator)["contribute(uint128)"](overcontribution);
            await tx.wait(1);            

            expect(tx).changeTokenBalance(tokenERC20, userCreator, -accepted);
            expect(await campaign.raised()).equal(await campaign.goal());
            //проверяем события
            // взнос принят
            await expect(tx).to.emit(campaign, "CampaignContribution").withArgs(userCreator, accepted);            
            //рефанд отправлен
            await expect(tx).to.emit(campaign, "CampaignRefunded").withArgs(userCreator, refund, tokenERC20);            
            //цель достигнута (смена статуса на Success)
            await expect(tx).to.emit(campaign, "CampaignStatusChanged").withArgs(0, 4, anyValue);
            expect(await campaign.status()).equal(4);
                      
        });
        
        //проверяем, что статус коректктно меняется при донате вровень с целью
        it("should change status ater complete contribution", async function() { 
            const {user0, campaign, tokenERC20 } = await loadFixture(deploy);        

            //определяем сумму взноса как всю цель
            const amount = await campaign.goal(); 
            (await tokenERC20.connect(user0).mint(user0, amount)).wait(1);
            
            (await tokenERC20.connect(user0).approve(campaign, amount));
            const tx =  await campaign.connect(user0)["contribute(uint128)"](amount);
            await tx.wait(1);            

            expect(tx).changeTokenBalance(tokenERC20, user0, -amount);
            expect(await campaign.raised()).equal(await campaign.goal());
            
            //проверяем события
            // взнос принят
            await expect(tx).to.emit(campaign, "CampaignContribution").withArgs(user0, amount);                                   
            //цель достигнута (смена статуса на Success)
            await expect(tx).to.emit(campaign, "CampaignStatusChanged").withArgs(0, 4, anyValue);
            expect(await campaign.status()).equal(4);                      
        });

        //проверка отказа в вызове не той перегрузки
        it("should be reverted uncorrect contribute call", async function() { 
            const {userPlatform, campaign } = await loadFixture(deploy );
    
            const amount = 500n;
            const tx = campaign["contribute()"]({value: amount});
            await expect(tx).revertedWithCustomError(campaign, "CampaignIncorrertFunction");           
            
        });
        //проверка отката нулевого взноса
        it("should be reverted zero contribute", async function() { 
            const {user0, campaign, tokenERC20 } = await loadFixture(deploy );
    
            const amount = 0n;
            const tx = campaign.connect(user0)["contribute(uint128)"](amount);
            await expect(tx).revertedWithCustomError(campaign, "CampaignZeroDonation").withArgs(user0);
            
        });

        //проверка отката по некорректному статусу
        it("should be reverted donate to unlive campaign", async function() { 
            const {userCreator, campaign, tokenERC20 } = await loadFixture(deploy );
    
            //отменяем кампанию -> переводим статус 
            const cancelStatus = 2;
            const txCancell = await campaign.connect(userCreator).setCampaignStatus(cancelStatus);
            txCancell.wait(1);
            
            const amount = 100n;
            const tx = campaign["contribute(uint128)"](amount);
            await expect(tx).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(cancelStatus, 0);
            
        });
        
        //проверка отката по некорректному статусу (дедлайн)
        it("should be reverted donate to failed campaign", async function() { 
            const {userCreator, campaign } = await loadFixture(deploy );
    
            //пропускаем время
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 60 * 60; // 1 час
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");            
            
            const amount = 100n;
            const tx = campaign["contribute(uint128)"](amount);
            const deadline = await campaign.deadline();            
            
            await expect(tx).revertedWithCustomError(campaign, "CampaignTimeExpired")
                .withArgs(deadline, anyValue);
            
        });

        //проверка отката по некорректному статусу (сбор завершен)
        it("should be reverted donate to successful campaign", async function() { 
            const {user0, campaign, tokenERC20 } = await loadFixture(deploy );
    
            const goal = await campaign.goal();
            const amount = 100n;
            (await tokenERC20.connect(user0).mint(user0, goal + amount)).wait(1);
            (await tokenERC20.connect(user0).approve(campaign, goal)).wait(1);
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](goal);
            await txContribute.wait(1);            
            
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;            
            (await tokenERC20.connect(user0).approve(user0, amount)).wait(1);
            const txOverfund = campaign.connect(user0)["contribute(uint128)"](amount);            
            
            await expect(txOverfund).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(4, 0);                                    
        });
        
        //проверка отката взноса на отмененную кампанию
        it("should be reverted donate to cancelled campaign", async function() { 
            const {userCreator, user0, campaign } = await loadFixture(deploy );   
            
            const txStatus = await campaign.connect(userCreator).setCampaignStatus(2);
            await txStatus.wait(1);
            
            const amount = 100n;
            const tx = campaign.connect(user0)["contribute(uint128)"](amount);                        
            await expect(tx).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(2, 0);                                    
        });
    });
    
    //тесты выводов клиенских средств
    describe("contributions users' claim tests", function() {
        //простой тест, что пользователь может вывести свои средства
        //если кампания ушла в дедлайн и провалилась
        it("should be possible claim contribute from failed", async function() { 
            
            const {user0, user1, campaign, tokenERC20 } = await loadFixture(deploy );
    
            
            const amount = 500n;
            //выдадим нашим юзерам токены
            (await tokenERC20.mint(user0, amount * 10n));
            (await tokenERC20.mint(user1, amount * 10n));
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);
            const txDonate0 = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txDonate0.wait(1);
            
            (await tokenERC20.connect(user1).approve(campaign, amount * 2n)).wait(1);
            const txDonate1 = await campaign.connect(user1)["contribute(uint128)"](amount * 2n);
            await txDonate1.wait(1);
            let balance = await campaign.raised();

            //пропускаем время
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 60 * 60; // 1 час
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");            
            
            //user0  клеймит взнос            
            const txWD0 = await campaign.connect(user0).claimContribution();
            await txWD0.wait(1);
            balance -= amount;
            
            await expect(txWD0).changeTokenBalance(tokenERC20, user0, amount);            
            await expect(txWD0).changeTokenBalance(tokenERC20, campaign, -amount);
            expect(await campaign.getContribution(user0)).equal(0);
            expect(await campaign.status()).equal(3);
            
            //проверяем события
            // взнос получен
            await expect(txWD0).to.emit(campaign, "CampaignContributionClaimed").withArgs(user0, amount);                                               
            //Фиксируем, что кампания провалилась (смена статуса на Failed)
            await expect(txWD0).to.emit(campaign, "CampaignStatusChanged").withArgs(0, 3, anyValue);            

            //user1  клеймит взнос
            
            const txWD1 = await campaign.connect(user1).claimContribution();
            await txWD1.wait(1);
            balance -= (2n * amount);
            
            await expect(txWD1).changeTokenBalance(tokenERC20, user1, 2n * amount);            
            await expect(txWD1).changeTokenBalance(tokenERC20, campaign, -(2n * amount));
            expect(await campaign.getContribution(user1)).equal(0);            
            //проверяем, что статус сохранился
            expect(await campaign.status()).equal(3);                      
            
            //проверяем события
            // взнос получен
            await expect(txWD1).to.emit(campaign, "CampaignContributionClaimed").withArgs(user1, amount * 2n);                                               
            
        });

        //простой тест, что пользователь может вывести свои средства
        //если кампания отменена
        it("should be possible claim contribute from cancelled", async function() { 
            
            const {userCreator, user0, user1, campaign, tokenERC20 } = await loadFixture(deploy );
    
            const amount = 500n;

            //выдадим нашим юзерам токены
            (await tokenERC20.mint(user0, amount * 10n));
            (await tokenERC20.mint(user1, amount * 10n));
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);
            const txDonate0 = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txDonate0.wait(1);
            
            (await tokenERC20.connect(user1).approve(campaign, amount * 2n)).wait(1);
            const txDonate1 = await campaign.connect(user1)["contribute(uint128)"](amount * 2n);
            await txDonate1.wait(1);
            let balance = await campaign.raised();

            //фаундер отменяет кампанию
            const txCancel = await campaign.connect(userCreator).setCampaignStatus(2);
            await txCancel.wait(1);
            expect(await campaign.status()).equal(2);
            expect(txCancel).to.emit(campaign, "CampaignStatusChanged").withArgs(0, 2, anyValue);

            //user0  клеймит взнос            
            const txWD0 = await campaign.connect(user0).claimContribution();
            await txWD0.wait(1);
            balance -= amount;
            
            await expect(txWD0).changeTokenBalance(tokenERC20, user0, amount);            
            await expect(txWD0).changeTokenBalance(tokenERC20, campaign, -amount);
            expect(await campaign.getContribution(user0)).equal(0);
            expect(await campaign.status()).equal(2);
            
            //проверяем события
            // взнос получен
            await expect(txWD0).to.emit(campaign, "CampaignContributionClaimed").withArgs(user0, amount);                                                           

            //user1  клеймит взнос            
            const txWD1 = await campaign.connect(user1).claimContribution();
            await txWD1.wait(1);
            balance -= (2n * amount);
            
            await expect(txWD1).changeTokenBalance(tokenERC20, user1, 2n * amount);            
            await expect(txWD1).changeTokenBalance(tokenERC20, campaign, -(2n * amount));
            expect(await campaign.getContribution(user1)).equal(0);
            //проверяем, что статус сохранился
            expect(await campaign.status()).equal(2);
            
            //проверяем события
            // взнос получен
            await expect(txWD1).to.emit(campaign, "CampaignContributionClaimed").withArgs(user1, amount * 2n);
        });

        //проверяем, что пользователь может вывести свои средства
        //если кампания приостановленная кампания ушла в дедлайн и провалилась
        it("should be possible claim contribute from failed", async function() { 
            
            const {userCreator, user0, user1, campaign, tokenERC20 } = await loadFixture(deploy );
    
            const amount = 500n;
            //выдадим нашим юзерам токены
            (await tokenERC20.mint(user0, amount * 10n));
            (await tokenERC20.mint(user1, amount * 10n));            

            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);
            const txDonate0 = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txDonate0.wait(1);
            
            (await tokenERC20.connect(user1).approve(campaign, amount * 2n)).wait(1);
            const txDonate1 = await campaign.connect(user1)["contribute(uint128)"](amount * 2n);
            await txDonate1.wait(1);
            let balance = await campaign.raised();

            //приостанавливаем кампанию
            const txStop = await campaign.connect(userCreator).setCampaignStatus(1);

            //проверяем, что сейчас пользователь не может вывести взнос
            const txWDStopped = campaign.connect(user0).claimContribution();
            await expect(txWDStopped).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(1, 3);
            
            //пропускаем время
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 60 * 60; // 1 час
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");            
            
            //user0  клеймит взнос            
            const txWD0 = await campaign.connect(user0).claimContribution();
            await txWD0.wait(1);
            balance -= amount;
            
            await expect(txWD0).changeTokenBalance(tokenERC20, user0, amount);            
            await expect(txWD0).changeTokenBalance(tokenERC20, campaign, -amount);
            expect(await campaign.getContribution(user0)).equal(0);
            expect(await campaign.status()).equal(3);
            
            //проверяем события
            // взнос получен
            await expect(txWD0).to.emit(campaign, "CampaignContributionClaimed").withArgs(user0, amount);                                               
            //Фиксируем, что кампания провалилась (смена статуса на Failed)
            await expect(txWD0).to.emit(campaign, "CampaignStatusChanged").withArgs(1, 3, anyValue);            

            //user1  клеймит взнос
            
            const txWD1 = await campaign.connect(user1).claimContribution();
            await txWD1.wait(1);
            balance -= (2n * amount);
            
            await expect(txWD1).changeTokenBalance(tokenERC20, user1, 2n * amount);            
            await expect(txWD1).changeTokenBalance(tokenERC20, campaign, -(2n * amount));
            expect(await campaign.getContribution(user1)).equal(0);            
            //проверяем, что статус сохранился
            expect(await campaign.status()).equal(3);                      
            
            //проверяем события
            // взнос получен
            await expect(txWD1).to.emit(campaign, "CampaignContributionClaimed").withArgs(user1, amount * 2n);                                         
            
        });
        
        //отрицательные тесты
        //проверяем, что невозможно вывести взнос из живой кампании
        it("should be reverted claim contribute from Alive", async function() { 
            
            const {userCreator, user0, user1, campaign, tokenERC20 } = await loadFixture(deploy );
    
            const amount = 500n;
            //выдадим нашему юзерy токены
            (await tokenERC20.mint(user0, amount * 10n));            
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);
            const txDonate0 = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txDonate0.wait(1);                        
            
            expect(await campaign.status()).equal(0);
            
            //user0  клеймит взнос            
            const txWD0 = campaign.connect(user0).claimContribution();
            
            await expect(txWD0).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(0, 3);            
            expect(await campaign.getContribution(user0)).equal(amount);
            expect(await campaign.status()).equal(0);
        });

        //проверяем, что невозможно вывести взнос из завершенной успешной кампании
        it("should be reverted claim contribute from Successful", async function() { 
            
            const {userCreator, user0, user1, campaign, tokenERC20 } = await loadFixture(deploy );
    
            const amount = 500n;
            //выдадим нашим юзерам токены
            (await tokenERC20.mint(user0, amount * 10n));            
            (await tokenERC20.mint(user1, await campaign.goal()));            
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);
            const txDonate0 = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txDonate0.wait(1);
            
            const restAmount = await campaign.goal() - amount;
            
            (await tokenERC20.connect(user1).approve(campaign, restAmount)).wait(1);
            const txDonate1 = await campaign.connect(user1)["contribute(uint128)"](restAmount);
            expect(await campaign.status()).equal(4);
            
            //user0  клеймит взнос            
            const txWD0 = campaign.connect(user0).claimContribution();
            
            await expect(txWD0).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(4, 3);            
            expect(await campaign.getContribution(user0)).equal(amount);
            expect(await campaign.status()).equal(4);
        });

        //проверям, что пользователь не может вывести деньги дважды
        it("should be reverted claim contribute twice", async function() { 
            
            const {userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy );
    
            const amount = 500n;
            //выдадим токены
            (await tokenERC20.mint(user0, amount * 10n));                        
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);
            const txDonate0 = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txDonate0.wait(1);
            
            let balance = await campaign.raised();
            
            //фаундер отменяет кампанию (чтобы время не мотать, так проще)
            const txCancel = await campaign.connect(userCreator).setCampaignStatus(2);
            expect(await campaign.status()).equal(2);
            
            //user0  клеймит взнос первый раз
            const txWD0 = await campaign.connect(user0).claimContribution();
            expect(await campaign.getContribution(user0)).equal(0);

            //и вызывает функцию заново
            const txWDR = campaign.connect(user0).claimContribution();            
            await expect(txWDR).revertedWithCustomError(campaign, "CampaignZeroWithdraw").withArgs(user0.address);            
            
        });
    });
    
    //тесты вывода фондов фаундером
    describe("creator's withdraw tеsts", function() { 
        
        //простой тест на вывод средств из успешной кампании
        it("should possible withdraw funds", async function() { 
            const {userPlatform, userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy );
    
            //переводим деньги до цели
            const goal = await campaign.goal();
            (await tokenERC20.mint(user0, goal));                        
            
            (await tokenERC20.connect(user0).approve(campaign, goal)).wait(1);            
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](goal);
            await txContribute.wait(1);
            //на всякий случай проверим статус кампании - должен быть успешный
            expect(await campaign.status()).equal(4);

            //рассчитаем комиссию руками
            const fee : bigint  = ((await campaign.goal() * 1000n) * await campaign.platformFee()) / (1000_000n);
            const fund = goal - fee;

            //пробуем вывести
            const txWD = await campaign.connect(userCreator).withdrawFunds();
            await expect(txWD).changeTokenBalances(tokenERC20,
                [userPlatform, userCreator, campaign], 
                [fee, fund, -goal]);
            //проверяем события
            await expect(txWD).to.emit(campaign, "CampaignFeePayed").withArgs(userPlatform, fee);
            await expect(txWD).to.emit(campaign, "CampaignFundsClaimed").withArgs(userCreator, fund);
            
        });
        
        //проверяем, что нельзя вывести два раза
        it("should reverted double withdraw funds", async function() { 
            const {userPlatform, userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy );
    
            //переводим деньги до цели
            const goal = await campaign.goal();
            (await tokenERC20.mint(user0, goal));                        
            
            (await tokenERC20.connect(user0).approve(campaign, goal)).wait(1);            
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](goal);
            await txContribute.wait(1);
            //на всякий случай проверим статус кампании - должен быть успешный
            expect(await campaign.status()).equal(4);
            
            //пробуем вывести
            const txWD = await campaign.connect(userCreator).withdrawFunds();

            //и еще раз
            const txWD2 = campaign.connect(userCreator).withdrawFunds();

            await expect(txWD2).revertedWithCustomError(campaign, "CampaignTwiceWithdraw").withArgs(userCreator);            
        });

        //проверяем, что нельзя вывести из "живой" кампании
        it("should reverted withdraw funds from alive", async function() { 
            const {userPlatform, userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy);
    
            //переводим деньги
            const amount = 500n;
            (await tokenERC20.mint(user0, amount));                        
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);            
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txContribute.wait(1);
            
            
            //пробуем вывести
            const txWD =  campaign.connect(userCreator).withdrawFunds();

            await expect(txWD).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(0, 4);            
        });

        //проверяем, что нельзя вывести из отмененной кампании
        it("should reverted withdraw funds from cancelled", async function() { 
            const {userPlatform, userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy);
    
            //переводим деньги
            const amount = 500n;
            (await tokenERC20.mint(user0, amount));                        
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);            
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txContribute.wait(1);
            //отменяем кампанию
            await campaign.connect(userCreator).setCampaignStatus(2);            
            
            //пробуем вывести
            const txWD =  campaign.connect(userCreator).withdrawFunds();

            await expect(txWD).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(2, 4);            
        });

        //проверяем, что нельзя вывести из остановленной кампании
        it("should reverted withdraw funds from stopped", async function() { 
            const {userPlatform, userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy);
    
            //переводим деньги
            const amount = 500n;
            (await tokenERC20.mint(user0, amount));                        
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);            
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txContribute.wait(1);
            //останавливаем кампанию
            await campaign.connect(userCreator).setCampaignStatus(1);            
            
            //пробуем вывести
            const txWD =  campaign.connect(userCreator).withdrawFunds();

            await expect(txWD).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(1, 4);            
        });

        //проверяем, что нельзя вывести из неуспешной кампании
        it("should reverted withdraw funds from failed", async function() { 
            const {userPlatform, userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy);
    
            //переводим деньги
            const amount = 500n;
            (await tokenERC20.mint(user0, amount));                        
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);            
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txContribute.wait(1);
            
            //пропускаем время
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 60 * 60; // 1 час
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");
            
            const changeStatusTX = (await campaign.checkDeadlineStatus()).wait(1);
            await expect(changeStatusTX).to.emit(campaign, "CampaignStatusChanged").withArgs(0, 3, anyValue);            
            //пробуем вывести
            const txWD =  campaign.connect(userCreator).withdrawFunds();

            await expect(txWD).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(3, 4);            
        });

        //проверяем, что не может вывести кто попало
        it("should reverted withdraw funds without access", async function() { 
            const {userPlatform, userCreator, user0, campaign, tokenERC20 } = await loadFixture(deploy );
    
            //переводим деньги до цели
            const goal = await campaign.goal();
            (await tokenERC20.mint(user0, goal));                        
            
            (await tokenERC20.connect(user0).approve(campaign, goal)).wait(1);            
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](goal);
            await txContribute.wait(1);
            //на всякий случай проверим статус кампании - должен быть успешный
            expect(await campaign.status()).equal(4);
            
            //пробуем вывести от имени левого юзера
            const txWD = campaign.connect(user0).withdrawFunds();           

            await expect(txWD).revertedWithCustomError(campaign, "CampaignUnauthorizedAccount").withArgs(user0);                       
        });  

    });
    
    
    //тестируем зависание и вывод "зависших" средств
    describe("pending withdraw tеsts", function() {               
        
        //Проверка contribute + claimPendingFunds в данном контракте не нужна, потому что
        //переводы принимаются в размере зачисления, "сдача" вычитается из перевода
        //и остается на балансе инвестора, а не попадает в pending
        
        
        //проверяем, накапливаются ли неудачно выведенные взносы в pending withdraw и можно ли их потом вывести
        //то есть проверяем сlaimContribution + claimPendingFunds
        it("should be possible withraw pending contributes", async function() {
            const {user0, userCreator, campaign, tokenERC20 } = await loadFixture(deploy);                        
            
            //сначала просто задонатим 
            const amount = 500n;                         
            (await tokenERC20.mint(user0, amount));                        
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);            
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](amount);

            //теперь отменим кампанию
            (await campaign.connect(userCreator).setCampaignStatus(2)).wait(1);            
            
            //теперь пробуем вернуть взнос
            (await tokenERC20.switchTransfer(false)).wait(1);
            const claimTx = await campaign.connect(user0).claimContribution();

            expect(await campaign.getContribution(user0)).equal(0);
            expect(await campaign.getPendingFunds(user0)).equal(amount);            
            await expect(claimTx).to.emit(campaign, "CampaignContributionDeffered").withArgs(user0, amount);
            await expect(claimTx).to.emit(campaign, "CampaignTransferFailed").withArgs(user0, amount, tokenERC20);
            
            //теперь пробуем затребовать его из пендинга
            //отрицательный сценарий 
            const txWD0 = campaign.connect(user0).claimPendingFunds();
            await expect(txWD0).to.be.revertedWithCustomError(campaign, "CampaignPendingWithdrawFailed")
                .withArgs(user0, amount, tokenERC20);                        
            
            //положительный сценарий
            //переключаем флаг, чтобы можно было получать средства
            (await tokenERC20.switchTransfer(true)).wait(1);
            const txWD1 = await campaign.connect(user0).claimPendingFunds();
            expect(await campaign.getPendingFunds(user0)).equal(0);            
            await expect(txWD1).to.emit(campaign, "PendingFundsClaimed").withArgs(user0, amount);
        });     

        //проверяем, накапливаются ли неудачно выведенные фонды фаундера в pending withdraw и можно ли их потом вывести
        //то есть проверяем withdrawFunds + claimPendingFunds
        it("should be possible withraw faunder pending funds", async function() {
            const { user0, userCreator, userPlatform, campaign, tokenERC20 } = await loadFixture(deploy); 
            
            //сначала просто задонатим от любого пользователя до цели контаркта
            
            const amount = await campaign.goal();                         
            (await tokenERC20.mint(user0, amount));                        
            
            (await tokenERC20.connect(user0).approve(campaign, amount)).wait(1);            
            const txContribute = await campaign.connect(user0)["contribute(uint128)"](amount);
            await txContribute.wait(1);           

            //посчитаем, сколько приходится на комиссию платформы
            const fee : bigint  = ((await campaign.goal() * 1000n) * await campaign.platformFee()) / (1000_000n);
            const funds = amount - fee;            
            
            //запретим переводы на стороне токена
            (await tokenERC20.switchTransfer(false)).wait(1);
            //теперь пробуем получить фонды и отправить комиссию
            const withdrawFundsTx = await campaign.connect(userCreator).withdrawFunds();
            
            expect(await campaign.getPendingFunds(userCreator)).equal(funds);            
            expect(await campaign.getPendingFunds(userPlatform)).equal(fee);            
            await expect(withdrawFundsTx).to.emit(campaign, "CampaignFeeDeffered").withArgs(userPlatform, fee);
            await expect(withdrawFundsTx).to.emit(campaign, "CampaignFundsDeffered").withArgs(userCreator, funds);
            
            //теперь пробуем затребовать его из пендинга
            //отрицательный сценарий
            const txWD0 = campaign.connect(userCreator).claimPendingFunds();
            await expect(txWD0).to.be.revertedWithCustomError(campaign, "CampaignPendingWithdrawFailed")
                .withArgs(userCreator, funds, tokenERC20);                        
            
            //положительный сценарий
            //переключаем флаг, чтобы можно было получать средства
            (await tokenERC20.switchTransfer(true)).wait(1);
            const txWD1 = await campaign.connect(userCreator).claimPendingFunds();
            expect(await campaign.getPendingFunds(userCreator)).equal(0);            
            await expect(txWD1).to.emit(campaign, "PendingFundsClaimed").withArgs(userCreator, funds);
        });     

    });     

    //разные тесты
    describe("other functions tеsts", function() {
        //проверяем геттеры
        it("should get correct info", async function() { 
            const { campaign } = await loadFixture(deploy); 
            
            const summary = await campaign.getSummary();

            expect(summary[0]).to.equal(await campaign.creator());
            expect(summary[1]).to.equal(await campaign.campaignName());
            expect(summary[2]).to.equal(await campaign.id());
            expect(summary[3]).to.equal(await campaign.token());
            expect(summary[4]).to.equal(await campaign.goal());
            expect(summary[5]).to.equal(await campaign.raised());
            expect(summary[6]).to.equal(await campaign.deadline());
            expect(summary[7]).to.equal(await campaign.campaignMeta());
            expect(summary[8]).to.equal(await campaign.status());

        });
    
        it("should revert setting status without access", async function() {
            const {user0, campaign } = await loadFixture(deploy );
    
            const txChangeStatus = campaign.connect(user0).setCampaignStatus(2);
            await expect(txChangeStatus).revertedWithCustomError(campaign, "CampaignUnauthorizedAccount").withArgs(user0);
            
        });     

    });
 
});