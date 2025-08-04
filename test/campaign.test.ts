import { loadFixture, ethers, expect } from "./setup";
import { network } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {defaultCampaignArgs, getBadReciever} from "./test-helpers"

describe("Campaign Native", function() {
    async function deploy() {        
        const [userPlatform, userCreator, user0, user1, user2] = await ethers.getSigners();
        
          const args: [
                string, // platformAddress
                string, // creator
                bigint, // Id
                bigint, // goal
                number, // deadline
                string, // campaignMeta
                number, // platformFee      
            ] = defaultCampaignArgs({}, userPlatform.address, userCreator.address);
      
        
        const campaign_Factory = await ethers.getContractFactory("CampaignNative");
        const campaign = await campaign_Factory.deploy(...args, {});
        await campaign.waitForDeployment();        

        return { userPlatform, userCreator, user0, user1, user2, campaign }
    }

    describe("deployment tеsts", function() {
        it("should be deployed", async function() { //простой тест, что деплоится нормально
            const { userPlatform, userCreator, campaign } = await loadFixture(deploy); 
            
            //заберем аргументы, с которыми деплоили
            const args = defaultCampaignArgs({}, userPlatform.address, userCreator.address);
            
            expect(campaign.target).to.be.properAddress;
            //и проверим, правильно ли установились поля
            expect (await campaign.creator()).equal(args[1]);            
            expect (await campaign.id()).equal(args[2]);
            expect (await campaign.goal()).equal(args[3]);
            expect (await campaign.deadline()).to.be.closeTo(args[4], 1);
            expect (await campaign.campaignMeta()).equal(args[5]);
            expect (await campaign.platformFee()).equal(args[6]);       

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
            const {userPlatform, userCreator, user0, campaign } = await loadFixture(deploy);        

            //пусть будут 3 взноса
            const contributions = [100, 1000, 10000];

            let raised = 0;
            for(let counter = 0; counter != 3; ++counter) {               

                const tx = await campaign.connect(user0)["contribute()"]({value: contributions[counter]});
                await tx.wait(1);
                raised += contributions[counter];
                expect(await campaign.raised()).equal(raised);
                expect(await campaign.getContribution(user0)).equal(raised);
                await expect(tx).to.emit(campaign, "CampaignContribution").withArgs(user0, contributions[counter]);            
            }         

            const balance = await ethers.provider.getBalance(campaign.target);       
            expect(balance).equal(raised);               
        });
        
        //проверка корректности обработки взносов от нескольких участников
        it("should possible multi contributes", async function() { 
            const {userPlatform, userCreator, user0, user1, user2, campaign } = await loadFixture(deploy);        

            //пусть будут 3 взноса
            const contributions = [100, 1000, 10000];
            const users = [user0, user1, user2];

            let raised = 0;
            
            for(let counter = 0; counter != 3; ++counter) {               

                const tx = await campaign.connect(users[counter])["contribute()"]({value: contributions[counter]});
                await tx.wait(1);
                raised += contributions[counter];
                expect(await campaign.raised()).equal(raised);                
                expect(tx).changeEtherBalance(users[counter], -contributions[counter]);
                expect(await campaign.getContribution(users[counter])).equal(contributions[counter]);
                await expect(tx).to.emit(campaign, "CampaignContribution").withArgs(users[counter], contributions[counter]);            
            }         

            const balance = await ethers.provider.getBalance(campaign.target);       
            expect(balance).equal(raised);               
        });

        //проверяем, что взносы принимаются до цели и возвращается сдача
        it("should refund overgoal contribution", async function() { 
            const {userPlatform, userCreator, user0, campaign } = await loadFixture(deploy);        

            //пусть будут 3 взноса внутри суммы
            const contributions = [100, 1000, 10000];

            for(let counter = 0; counter != 3; ++counter) {               

                const tx = await campaign.connect(user0)["contribute()"]({value: contributions[counter]});
                await tx.wait(1);                           
            }         

            //и еще один, который будет больше, чем остаток, скажем, на 500;
            const accepted = (await campaign.goal()) - (await campaign.raised()); //считаем остаток
            const refund = 500n; //добавляем плюс
            const overcontribution = accepted + refund; //формируем избыточный взнос            
            
            const tx =  await campaign.connect(userCreator)["contribute()"]({value: overcontribution});
            await tx.wait(1);            

            expect(tx).changeEtherBalance(userCreator, -accepted);
            expect(await campaign.raised()).equal(await campaign.goal());
            //проверяем события
            // взнос принят
            await expect(tx).to.emit(campaign, "CampaignContribution").withArgs(userCreator, accepted);            
            //рефанд отправлен
            await expect(tx).to.emit(campaign, "CampaignRefunded").withArgs(userCreator, refund, ethers.ZeroAddress);            
            //цель достигнута (смена статуса на Success)
            await expect(tx).to.emit(campaign, "CampaignStatusChanged").withArgs(0, 4, anyValue);
            expect(await campaign.status()).equal(4);

                      
        });
        
        //проверяем, что статус коректктно меняется при донате вровень с целью
        it("should change status ater complete contribution", async function() { 
            const {user0, campaign } = await loadFixture(deploy);        

            //определяем сумму взноса как всю цель
            const amount = await campaign.goal(); 
            
            const tx =  await campaign.connect(user0)["contribute()"]({value: amount});
            await tx.wait(1);            

            expect(tx).changeEtherBalance(user0, -amount);
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
            const tx = campaign["contribute(uint128)"](amount);
            await expect(tx).revertedWithCustomError(campaign, "CampaignIncorrertFunction");           
            
        });
        //проверка отката нулевого взноса
        it("should be reverted zero contribute", async function() { 
            const {user0, campaign } = await loadFixture(deploy );
    
            const amount = 0n;
            const tx = campaign.connect(user0)["contribute()"]({value: amount});
            await expect(tx).revertedWithCustomError(campaign, "CampaignZeroDonation").withArgs(user0);
            
        });

        //проверка отката по некорректному статусу
        it("should be reverted donate to unlive campaign", async function() { 
            const {userCreator, campaign } = await loadFixture(deploy );
    
            //отменяем кампанию -> переводим статус 
            const cancelStatus = 2;
            const txCancell = await campaign.connect(userCreator).setCampaignStatus(cancelStatus);
            txCancell.wait(1);
            
            const amount = 100n;
            const tx = campaign["contribute()"]({value: amount});
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
            const tx = campaign["contribute()"]({value: amount});
            const deadline = await campaign.deadline();            
            
            await expect(tx).revertedWithCustomError(campaign, "CampaignTimeExpired")
                .withArgs(deadline, anyValue);
            
        });

        //проверка отката по некорректному статусу (сбор завершен)
        it("should be reverted donate to successful campaign", async function() { 
            const {user0, campaign } = await loadFixture(deploy );
    
            const goal = await campaign.goal();
            const txContribute = await campaign["contribute()"]({value:goal});
            await txContribute.wait(1);

            
            const amount = 100n;
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;            
            
            const txOverfund = campaign.connect(user0)["contribute()"]({value: amount});            
            
            await expect(txOverfund).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(4, 0);                                    
        });

        it("should be reverted donate to cancelled campaign", async function() { //проверка отката взноса на отмененную кампанию
            const {userCreator, user0, campaign } = await loadFixture(deploy );   
            
            const txStatus = await campaign.connect(userCreator).setCampaignStatus(2);
            await txStatus.wait(1);
            
            const amount = 100n;
            const tx = campaign.connect(user0)["contribute()"]({value: amount});                        
            await expect(tx).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(2, 0);                                    
        });
    });
    
    //тесты выводов клиенских средств
    describe("contributions users' claim tests", function() {
        //простой тест, что пользователь может вывести свои средства
        //если кампания ушла в дедлайн и провалилась
        it("should be possible claim contribute from failed", async function() { 
            
            const {user0, user1, campaign } = await loadFixture(deploy );
    
            const amount = 500n;
            const txDonate0 = await campaign.connect(user0)["contribute()"]({value: amount});
            await txDonate0.wait(1);
            const txDonate1 = await campaign.connect(user1)["contribute()"]({value: amount * 2n});
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
            
            await expect(txWD0).changeEtherBalance(user0, amount);            
            await expect(txWD0).changeEtherBalance(campaign, -amount);
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
            
            await expect(txWD1).changeEtherBalance(user1, 2n * amount);            
            await expect(txWD1).changeEtherBalance(campaign, -(2n * amount));
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
            
            const {userCreator, user0, user1, campaign } = await loadFixture(deploy );
    
            const amount = 500n;
            const txDonate0 = await campaign.connect(user0)["contribute()"]({value: amount});
            await txDonate0.wait(1);
            const txDonate1 = await campaign.connect(user1)["contribute()"]({value: amount * 2n});
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
            
            await expect(txWD0).changeEtherBalance(user0, amount);            
            await expect(txWD0).changeEtherBalance(campaign, -amount);
            expect(await campaign.getContribution(user0)).equal(0);
            expect(await campaign.status()).equal(2);
            
            //проверяем события
            // взнос получен
            await expect(txWD0).to.emit(campaign, "CampaignContributionClaimed").withArgs(user0, amount);                                                           

            //user1  клеймит взнос            
            const txWD1 = await campaign.connect(user1).claimContribution();
            await txWD1.wait(1);
            balance -= (2n * amount);
            
            await expect(txWD1).changeEtherBalance(user1, 2n * amount);            
            await expect(txWD1).changeEtherBalance(campaign, -(2n * amount));
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
            
            const {userCreator, user0, user1, campaign } = await loadFixture(deploy );
    
            const amount = 500n;
            const txDonate0 = await campaign.connect(user0)["contribute()"]({value: amount});
            await txDonate0.wait(1);
            const txDonate1 = await campaign.connect(user1)["contribute()"]({value: amount * 2n});
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
            
            await expect(txWD0).changeEtherBalance(user0, amount);            
            await expect(txWD0).changeEtherBalance(campaign, -amount);
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
            
            await expect(txWD1).changeEtherBalance(user1, 2n * amount);            
            await expect(txWD1).changeEtherBalance(campaign, -(2n * amount));
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
            
            const {userCreator, user0, user1, campaign } = await loadFixture(deploy );
    
            const amount = 500n;
            const txDonate0 = await campaign.connect(user0)["contribute()"]({value: amount});
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
            
            const {userCreator, user0, user1, campaign } = await loadFixture(deploy );
    
            const amount = 500n;
            const txDonate0 = await campaign.connect(user0)["contribute()"]({value: amount});
            await txDonate0.wait(1);
            
            const restAmount = await campaign.goal() - amount;
            
            const txDonate1 = await campaign.connect(user1)["contribute()"]({value: restAmount});
            expect(await campaign.status()).equal(4);
            
            //user0  клеймит взнос            
            const txWD0 = campaign.connect(user0).claimContribution();
            
            await expect(txWD0).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(4, 3);            
            expect(await campaign.getContribution(user0)).equal(amount);
            expect(await campaign.status()).equal(4);
        });

        //проверям, что пользователь не может вывести деньги дважды
        it("should be reverted claim contribute twice", async function() { 
            
            const {userCreator, user0, user1, campaign } = await loadFixture(deploy );
    
            const amount = 500n;
            const txDonate0 = await campaign.connect(user0)["contribute()"]({value: amount});
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
            const {userPlatform, userCreator, user0, campaign } = await loadFixture(deploy );
    
            //переводим деньги до цели
            const goal = await campaign.goal();
            const txContribute = await campaign["contribute()"]({value:goal});
            await txContribute.wait(1);
            //на всякий случай проверим статус кампании - должен быть успешный
            expect(await campaign.status()).equal(4);

            //рассчитаем комиссию руками
            const fee : bigint  = ((await campaign.goal() * 1000n) * await campaign.platformFee()) / (1000_000n);
            const fund = goal - fee;

            //пробуем вывести
            const txWD = await campaign.connect(userCreator).withdrawFunds();
            await expect(txWD).changeEtherBalances(
                [userPlatform, userCreator, campaign], 
                [fee, fund, -goal]);
            //проверяем события
            await expect(txWD).to.emit(campaign, "CampaignFeePayed").withArgs(userPlatform, fee);
            await expect(txWD).to.emit(campaign, "CampaignFundsClaimed").withArgs(userCreator, fund);
            
        });
        
        //проверяем, что нельзя вывести два раза
        it("should reverted double withdraw funds", async function() { 
            const {userPlatform, userCreator, user0, campaign } = await loadFixture(deploy );
    
            //переводим деньги до цели
            const goal = await campaign.goal();
            const txContribute = await campaign["contribute()"]({value:goal});
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
            const {userPlatform, userCreator, user0, campaign } = await loadFixture(deploy);
    
            //переводим деньги до цели
            const amount = 500n;
            const txContribute = await campaign["contribute()"]({value:amount});
            await txContribute.wait(1);
            
            
            //пробуем вывести
            const txWD =  campaign.connect(userCreator).withdrawFunds();

            await expect(txWD).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(0, 4);            
        });

        //проверяем, что нельзя вывести из отмененной кампании
        it("should reverted withdraw funds from cancelled", async function() { 
            const {userPlatform, userCreator, user0, campaign } = await loadFixture(deploy);
    
            //переводим деньги до цели
            const amount = 500n;
            const txContribute = await campaign["contribute()"]({value:amount});
            await txContribute.wait(1);
            //отменяем кампанию
            await campaign.connect(userCreator).setCampaignStatus(2);            
            
            //пробуем вывести
            const txWD =  campaign.connect(userCreator).withdrawFunds();

            await expect(txWD).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(2, 4);            
        });

        //проверяем, что нельзя вывести из остановленной кампании
        it("should reverted withdraw funds from stopped", async function() { 
            const {userPlatform, userCreator, user0, campaign } = await loadFixture(deploy);
    
            //переводим деньги до цели
            const amount = 500n;
            const txContribute = await campaign["contribute()"]({value:amount});
            await txContribute.wait(1);
            //останавливаем кампанию
            await campaign.connect(userCreator).setCampaignStatus(1);            
            
            //пробуем вывести
            const txWD =  campaign.connect(userCreator).withdrawFunds();

            await expect(txWD).revertedWithCustomError(campaign, "CampaignInvalidStatus").withArgs(1, 4);            
        });

        //проверяем, что нельзя вывести из неуспешной кампании
        it("should reverted withdraw funds from failed", async function() { 
            const {userPlatform, userCreator, user0, campaign } = await loadFixture(deploy);
    
            //переводим деньги до цели
            const amount = 500n;
            const txContribute = await campaign["contribute()"]({value:amount});
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
            const {userPlatform, userCreator, user0, campaign } = await loadFixture(deploy );
    
            //переводим деньги до цели
            const goal = await campaign.goal();
            const txContribute = await campaign["contribute()"]({value:goal});
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
        
        //проверяем, накапливаются ли рефанды в pending withdraw и можно ли их потом вывести
        //то есть проверяем contribute + claimPendingFunds
        it("should be possible withraw pending refunds", async function() { 
            const {user0, campaign } = await loadFixture(deploy); 
            
            //наш "жертвователь" - контракт, который отклоняет приходы в receive         
            const badReceiver = await getBadReciever(); 
            
            //сначала просто задонатим, чтобы не 0 был
            const amount0 = 500n; 
            const txContribute = await campaign["contribute()"]({value:amount0});          
            
            //теперь будем переводить деньги от "плохого" контаркта
            const contribution = await campaign.goal(); //не вычитаем уже накопленное
            const refund = amount0; //поэтому сдача будет равна первоначальному взносу
            const txDonate0 = await badReceiver.callContribute(campaign, contribution);
            await txDonate0.wait();

            expect(await campaign.getContribution(badReceiver)).equal(contribution - refund);
            expect(await campaign.getPendingFunds(badReceiver)).equal(amount0);
            await expect(txDonate0).to.emit(campaign, "CampaignContribution").withArgs(badReceiver, contribution - refund);
            await expect(txDonate0).to.emit(campaign, "CampaignTransferFailed").withArgs(badReceiver, refund, ethers.ZeroAddress);
            
            //теперь пробуем затребовать его из пендинга
            //отрицательный сценарий
            const txWD0 = badReceiver.callClaimPendingFunds(campaign);
            await expect(txWD0).to.be.revertedWithCustomError(campaign, "CampaignPendingWithdrawFailed")
                .withArgs(badReceiver, refund, ethers.ZeroAddress);                        
            
            //положительный сценарий
            //переключаем флаг, чтобы можно было получать средства
            await badReceiver.setRevertFlag(true);
            //сделать ли событие успешного клейма?
            const txWD1 = await badReceiver.callClaimPendingFunds(campaign);                            
            expect(await campaign.getPendingFunds(badReceiver)).equal(0);
            await expect(txWD1).to.emit(campaign, "PendingFundsClaimed").withArgs(badReceiver, refund)
        });
    
        //проверяем, накапливаются ли неудачно выведенные взносы в pending withdraw и можно ли их потом вывести
        //то есть проверяем сlaimContribution + claimPendingFunds
        it("should be possible withraw pending contributes", async function() {
            const {userCreator, campaign } = await loadFixture(deploy); 
            
            //наш "жертвователь" - контракт, который отклоняет приходы в receive         
            const badReceiver = await getBadReciever(); 
            
            //сначала просто задонатим от "плохого" контаркта
            const amount = 500n;                         
            const txDonate = await badReceiver.callContribute(campaign, amount);
            await txDonate.wait();

            //теперь отменим кампанию
            (await campaign.connect(userCreator).setCampaignStatus(2)).wait(1);            
            
            //теперь пробуем вернуть взнос
            const claimTx = await badReceiver.callClaimContribution(campaign);

            expect(await campaign.getContribution(badReceiver)).equal(0);
            expect(await campaign.getPendingFunds(badReceiver)).equal(amount);            
            await expect(claimTx).to.emit(campaign, "CampaignContributionDeffered").withArgs(badReceiver, amount);
            await expect(claimTx).to.emit(campaign, "CampaignTransferFailed").withArgs(badReceiver, amount, ethers.ZeroAddress);
            
            //теперь пробуем затребовать его из пендинга
            //отрицательный сценарий
            const txWD0 = badReceiver.callClaimPendingFunds(campaign);
            await expect(txWD0).to.be.revertedWithCustomError(campaign, "CampaignPendingWithdrawFailed")
                .withArgs(badReceiver, amount, ethers.ZeroAddress);                        
            
            //положительный сценарий
            //переключаем флаг, чтобы можно было получать средства
            await badReceiver.setRevertFlag(true);            
            const txWD1 = await badReceiver.callClaimPendingFunds(campaign);                            
            expect(await campaign.getPendingFunds(badReceiver)).equal(0);            
            await expect(txWD1).to.emit(campaign, "PendingFundsClaimed").withArgs(badReceiver, amount);
        });     

        //проверяем, накапливаются ли неудачно выведенные фонды фаундера в pending withdraw и можно ли их потом вывести
        //то есть проверяем withdrawFunds + claimPendingFunds
        it("should be possible withraw faunder pending funds", async function() {
            const { user0 } = await loadFixture(deploy); 
            
            //наш "фаундер" и "платформа" - контракт, который отклоняет приходы в receive         
            const badReceiver = await getBadReciever(); 
            const badReceiverAddr = await badReceiver.getAddress();

            //передеплоим контракт с "плохим получателем" как фаундером и платформой
            const args: [
                string, // platformAddress
                string, // creator                
                bigint, // Id
                bigint, // goal
                number, // deadline
                string, // campaignMeta
                number, // platformFee      
            ] = defaultCampaignArgs({}, badReceiverAddr, badReceiverAddr);
      
        
            const campaign_Factory = await ethers.getContractFactory("CampaignNative");
            const campaign = await campaign_Factory.deploy(...args, {});
            await campaign.waitForDeployment();                   
            
            
            //сначала просто задонатим от любого пользователя до цели контаркта
            const amount = await campaign.goal();                         
            const txDonate = await badReceiver.callContribute(campaign, amount);
            await txDonate.wait(1);

            //посчитаем, сколько приходится на комиссию платформы
            const fee : bigint  = ((await campaign.goal() * 1000n) * await campaign.platformFee()) / (1000_000n);
            const funds = amount - fee;            
            
            //теперь пробуем получить фонды и отправить комиссию
            const withdrawFundsTx = await badReceiver.callWithdrawFunds(campaign);
            
            expect(await campaign.getPendingFunds(badReceiver)).equal(amount);            
            await expect(withdrawFundsTx).to.emit(campaign, "CampaignFeeDeffered").withArgs(badReceiver, fee);
            await expect(withdrawFundsTx).to.emit(campaign, "CampaignFundsDeffered").withArgs(badReceiver, funds);
            
            //теперь пробуем затребовать его из пендинга
            //отрицательный сценарий
            const txWD0 = badReceiver.callClaimPendingFunds(campaign);
            await expect(txWD0).to.be.revertedWithCustomError(campaign, "CampaignPendingWithdrawFailed")
                .withArgs(badReceiver, amount, ethers.ZeroAddress);                        
            
            //положительный сценарий
            //переключаем флаг, чтобы можно было получать средства
            await badReceiver.setRevertFlag(true);            
            const txWD1 = await badReceiver.callClaimPendingFunds(campaign);                            
            expect(await campaign.getPendingFunds(badReceiver)).equal(0);            
            await expect(txWD1).to.emit(campaign, "PendingFundsClaimed").withArgs(badReceiver, amount);
        });         

    });         
    //разные тесты
    describe("other functions tеsts", function() {
        //проверяем геттеры
        it("should get correct info", async function() { 
            const { campaign } = await loadFixture(deploy); 
            
            const summary = await campaign.getSummary();

            expect(summary[0]).to.equal(await campaign.creator());        
            expect(summary[1]).to.equal(await campaign.id());
            expect(summary[2]).to.equal(await campaign.token());
            expect(summary[3]).to.equal(await campaign.goal());
            expect(summary[4]).to.equal(await campaign.raised());
            expect(summary[5]).to.equal(await campaign.deadline());
            expect(summary[6]).to.equal(await campaign.campaignMeta());
            expect(summary[7]).to.equal(await campaign.status());

        });
    
        it("should revert setting status without access", async function() {
            const {user0, campaign } = await loadFixture(deploy );
    
            const txChangeStatus = campaign.connect(user0).setCampaignStatus(2);
            await expect(txChangeStatus).revertedWithCustomError(campaign, "CampaignUnauthorizedAccount").withArgs(user0);
            
        });     

    });
 
});