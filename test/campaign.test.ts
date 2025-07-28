import { dropTransaction } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { loadFixture, ethers, expect } from "./setup";
import { network } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

import {defaultCampaignArgs} from "./test-helpers"

describe("Campaign Native", function() {
    async function deploy() {        
        const [userPlatform, userCreator, user0] = await ethers.getSigners();
        
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
      
        
        const campaign_Factory = await ethers.getContractFactory("CampaignNative");
        const campaign = await campaign_Factory.deploy(...args, {});
        await campaign.waitForDeployment();        

        return { userPlatform, userCreator, user0, campaign }
    }

    describe("deployment tеsts", function() {
        it("should be deployed", async function() { //простой тест, что деплоится нормально
            const { userPlatform, userCreator, campaign } = await loadFixture(deploy); 
            
            //заберем аргументы, с которыми деплоили
            const args = defaultCampaignArgs({}, userPlatform.address, userCreator.address);
            
            expect(campaign.target).to.be.properAddress;
            //и проверим, правильно ли установились поля
            expect (await campaign.creator()).equal(args[1]);
            expect (await campaign.campaignName()).equal(args[2]);
            expect (await campaign.Id()).equal(args[3]);
            expect (await campaign.goal()).equal(args[4]);
            expect (await campaign.deadline()).to.be.closeTo(args[5], 1);
            expect (await campaign.campaignMeta()).equal(args[6]);
            expect (await campaign.platformFee()).equal(args[7]);       

        });
    
        it("should have 0 eth by default", async function() {
            const { campaign } = await loadFixture(deploy );
    
            const balance = await ethers.provider.getBalance(campaign.target);        
            expect(balance).eq(0);
            
        });     

    });
    describe("contribution test tеsts", function() {
        it("should possible contribute", async function() { //просто проверяем, что взносы принимаются
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

        it("should refund overgoal contribution", async function() { //проверяем, что взносы принимаются до цели и возвращается сдача
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
            await expect(tx).to.emit(campaign, "CampaignContribution").withArgs(userCreator, accepted);            
            await expect(tx).to.emit(campaign, "CampaignRefunded").withArgs(userCreator, refund, ethers.ZeroAddress);            
                      
        });

        it("should be reverted uncorrect contribute call", async function() { //проверка отказа в вызове не той перегрузки
            const {userPlatform, campaign } = await loadFixture(deploy );
    
            const amount = 500n;
            const tx = campaign["contribute(uint128)"](amount);
            await expect(tx).revertedWithCustomError(campaign, "CampaingIncorrertFunction");           
            
        });

        it("should be reverted zero contribute", async function() { //проверка отката нулевого взноса
            const {user0, campaign } = await loadFixture(deploy );
    
            const amount = 0n;
            const tx = campaign.connect(user0)["contribute()"]({value: amount});
            await expect(tx).revertedWithCustomError(campaign, "CampaingZeroDonation").withArgs(user0);
            
        });

        it("should be reverted donate to unlive campaign", async function() { //проверка отката по некорректному статусу
            const {userCreator, campaign } = await loadFixture(deploy );
    
            //отменяем кампанию -> переводим статус 
            const cancelStatus = 2;
            const txCancell = await campaign.connect(userCreator).setCampaignStatus(cancelStatus);
            txCancell.wait(1);
            
            const amount = 100n;
            const tx = campaign["contribute()"]({value: amount});
            await expect(tx).revertedWithCustomError(campaign, "CampaingInvalidStatus").withArgs(cancelStatus, 0);
            
        });

        it("should be reverted donate to failed campaign", async function() { //проверка отката по некорректному статусу (дедлайн)
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
            
            await expect(tx).revertedWithCustomError(campaign, "CampaingTimeExpired")
                .withArgs(deadline, anyValue);
            
        });

        it("should be reverted donate to successful campaign", async function() { //проверка отката по некорректному статусу (сбрр завершен)
            const {user0, campaign } = await loadFixture(deploy );
    
            const goal = await campaign.goal();
            const txContribute = await campaign["contribute()"]({value:goal});
            await txContribute.wait(1);

            
            const amount = 100n;
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;            
            
            const txOverfund = campaign.connect(user0)["contribute()"]({value: amount});            
            
            await expect(txOverfund).revertedWithCustomError(campaign, "CampaingInvalidStatus").withArgs(4, 0);                                    
        });

        it("should be reverted donate to cancelled campaign", async function() { //проверка отката взноса на отмененную кампанию
            const {userCreator, user0, campaign } = await loadFixture(deploy );   
            
            const txStatus = await campaign.connect(userCreator).setCampaignStatus(2);
            await txStatus.wait(1);
            
            const amount = 100n;
            const tx = campaign.connect(user0)["contribute()"]({value: amount});                        
            await expect(tx).revertedWithCustomError(campaign, "CampaingInvalidStatus").withArgs(2, 0);                                    
        });

    });




    /*describe("create funtion tests", function() {

        it("should create auction", async function(){
            const {userPlatform, auction } = await loadFixture(deploy);
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            const tx = await auction.createAuction(startPrice, discountRate, duration, item);
            tx.wait(1);
            
            const countAucitons = await auction.counter();            
            expect(countAucitons).eq(1);
           
            const createdAuction = await auction.auctions(0);
            expect(createdAuction.seller).eq(userPlatform.address);
            expect(createdAuction.startPrice).eq(startPrice);
            expect(createdAuction.stopped).eq(false);
            await expect(tx).to.emit(auction, "NewAuctionCreated").withArgs(0, item, startPrice, duration);

        
        });

        it("should be reverted creating with low start price", async function(){
            
            const {userPlatform, auction } = await loadFixture(deploy);
            const startPrice = 100n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            await expect(auction.createAuction(startPrice, discountRate, duration, item))
                    .revertedWithCustomError(auction, "InvalidStartPrice")
                    .withArgs(startPrice, discountRate * duration);

        });
    });

    describe("Buy and get fucnctions", function() {
        
        it("should get auction info", async function(){
            
            const {userPlatform, auction } = await loadFixture(deploy);
            
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) {
                
                const tx = await auction.createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);
            }

            const lot = await auction.getLot(3);

            expect(lot.description).eq(item + "3");           

        
        });

        it("should be reverted request non-existent lot", async function(){
            
            const {userPlatform, auction } = await loadFixture(deploy);
            
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) {
                
                const tx = await auction.createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);
            }

            await expect(auction.getLot(5)).revertedWithCustomError(auction, "NonExistentLot").withArgs(5);
        });
        
        it("should buy lot", async function(){ //проверка функции buy
            const {userPlatform, userCreator, user2, auction } = await loadFixture(deploy);
            
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) { //сначала создадим 4 лота
                
                const tx = await auction.connect(userCreator).createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);                
            }
            
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 12 * 60 * 60; // 12 часов
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");

            //теперь попробуем купить
            const index = 3n; //попробуем купить третий лот
            const price = await auction.getPrice(index);  //получаем цену лота                     

            const buyTx = await auction.connect(user2).buy(index, {value: price}); //покупаем
            
            const lot3 = await auction.getLot(index); //получаем данные купленного лота            
            const finalPrice = lot3.finalPrice;

            //тестируем событие
            await expect(buyTx).to.emit(auction, "AuctionEnded").withArgs(index, finalPrice, user2);            
            
            //проверяем балансы
            const sellerIncome = finalPrice - ((finalPrice * 10n) / 100n);
            const auctionIncome = (finalPrice * 10n) / 100n;            

            await expect(buyTx).to.changeEtherBalances([userCreator, user2, auction.target],[sellerIncome, -finalPrice, auctionIncome]);
        
        });
        it("should revert buy with not enough funds", async function(){ //проверка возврата функции buy из-аз недостаточности средств
            const {userPlatform, userCreator, user2, auction } = await loadFixture(deploy);
            
            //сначала выставим на продажу несколько лотов
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) { //сначала создадим 4 лота
                
                const tx = await auction.connect(userCreator).createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);                
            }
            
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 12 * 60 * 60; // 12 часов
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");

            //теперь попробуем купить
            const index = 3n; //попробуем купить третий лот
            const price = await auction.getPrice(index);  //получаем цену лота                     
            const priceUser = price / 2n;  //а перечислим в два раза меньше
            
            await expect(auction.connect(user2).buy(index, {value: priceUser}))
                .revertedWithCustomError(auction, "InfucientFunds")
                .withArgs(index, priceUser, price - (await auction.getLot(index)).discountRate);
        });

        it("should be reverted buy non-existent lot", async function(){
            
            const {userPlatform, auction } = await loadFixture(deploy);
            
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) {
                
                const tx = await auction.createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);
            }

            await expect(auction.buy(5, {value: startPrice})).revertedWithCustomError(auction, "NonExistentLot").withArgs(5);
        });

                it("should revert buy lot from stopped auction", async function(){ //проверка возврата функции buy при повторной покупке
            const {userPlatform, userCreator, user2, auction } = await loadFixture(deploy);
            
            //сначала выставим на продажу несколько лотов
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) { //сначала создадим 4 лота
                
                const tx = await auction.connect(userCreator).createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);                
            }
            
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 12 * 60 * 60; // 12 часов
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");

            //теперь сначала делаем покупку, чтобы перевести аукцион в стоп
            const index = 3n; //будем дважды покупать третий лот
            const price = await auction.getPrice(index);  //получаем цену лота                     
;
            const tx  = await auction.connect(user2).buy(index, {value: price});
            tx.wait(1);
            
            await expect(auction.connect(user2).buy(index, {value: price}))
                .revertedWithCustomError(auction, "RequestToStoppedAuction")
                .withArgs(index);
        });

                it("should revert buy lot with expired time", async function(){ //проверка возврата функции buy при истечении срока
            const {userPlatform, userCreator, user2, auction } = await loadFixture(deploy);
            
            //сначала выставим на продажу несколько лотов
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) { //сначала создадим 4 лота
                
                const tx = await auction.connect(userCreator).createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);                
            }
            
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 48 * 60 * 60; // 48 часов
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");

            //теперь сначала делаем покупку, чтобы перевести аукцион в стоп
            const index = 3n; //будем покупать третий лот
            const price = await auction.getPrice(index);  //получаем цену лота            
            
            await expect(auction.connect(user2).buy(index, {value: price}))
                .revertedWithCustomError(auction, "ExpiredTime")
                .withArgs(index);
        });
    });

    describe("withdraw funcitons", function() {
        async function getBadReciever() { //вспомогательная функция создания "сбоящего" получателя средств

            const badReceiverFactory = await ethers.getContractFactory("BadReceiver");
            const badReceiver = await badReceiverFactory.deploy();            
            await badReceiver.waitForDeployment();

            const [sender] = await ethers.getSigners();            

            //пускай на контракте будут средства - 1 эфир
            const tx = await badReceiver.connect(sender).getTransfer({value: ethers.parseEther("1.0")})                         

            return badReceiver;
        }

        it("should buy lot and manual refund withdraw", async function(){ //проверка неуспешного рефанда и ручного вывода сдачи
            const {userPlatform, userCreator, user2, auction } = await loadFixture(deploy);
            const badReceiver = await getBadReciever(); //наш "покупатель" - контракт, который отклоняет приходы в receive         
            
            
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) { //сначала создадим 4 лота
                
                const tx = await auction.connect(userCreator).createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);                
            }
            
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 12 * 60 * 60; // 12 часов
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");

            //теперь покупаем
            const index = 3n; //попробуем купить третий лот
            const price = await auction.getPrice(index);  //получаем цену лота                     
            
            const txBuy = await badReceiver.callBuy(auction, price, index);
            txBuy.wait(1);
            const lot3 = await auction.getLot(index); //получаем данные купленного лота                         
            const finalPrice = lot3.finalPrice;
            const refund = price - finalPrice;
            const fee = finalPrice * 10n / 100n;

            //проверяем, что сдача не вернулась и сгенерировано соответствующее событие
            expect(txBuy).changeEtherBalance(auction, (fee + refund)); //проверяем, что баланс аукциона увеличился на сумму комиссии и сдачи
            expect(txBuy).changeEtherBalance(badReceiver, - price); //проверяем, что покупатель не получил сдачу
            expect(txBuy).to.emit(auction, "MoneyTrasferFailed").withArgs(index, badReceiver, refund, "refund failed");            

            //пробуем вывести средства вручную
            await badReceiver.setRevertFlag(true);            
            const txWithdraw = await badReceiver.callWithdrawRefund(auction);
            expect(txWithdraw).changeEtherBalance(badReceiver, refund);
            
        });

        it("should withdraw incomes", async function(){ //проверка вывода прибыли
            const {userPlatform, userCreator, user2, auction } = await loadFixture(deploy);           
            
            
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) { //сначала создадим 4 лота
                
                const tx = await auction.connect(userCreator).createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);                
            }
            
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 12 * 60 * 60; // 12 часов
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");

            //теперь покупаем
            const index = 3n; //попробуем купить третий лот
            const price = await auction.getPrice(index);  //получаем цену лота                     
            
            const txBuy = await auction.buy(index, {value: price});
            txBuy.wait(1);
            const lot3 = await auction.getLot(index); //получаем данные купленного лота                         
            const finalPrice = lot3.finalPrice;            
            const fee = finalPrice * 10n / 100n; //комиссия

            const txWithdraw = await auction.connect(userPlatform).withdrawIncomes(fee);
            await txWithdraw.wait(1);
            
            expect(txWithdraw).changeEtherBalance(userPlatform, fee);
            
        });

        it("should revert withdraw incomes not an owner", async function(){ //проверка вывода прибыли
            const {userPlatform, userCreator, user2, auction } = await loadFixture(deploy);           
            
            
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) { //сначала создадим 4 лота
                
                const tx = await auction.connect(userCreator).createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);                
            }
            
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 12 * 60 * 60; // 12 часов
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");

            //теперь покупаем
            const index = 3n; //попробуем купить третий лот
            const price = await auction.getPrice(index);  //получаем цену лота                     
            
            const txBuy = await auction.buy(index, {value: price});
            txBuy.wait(1);
            const lot3 = await auction.getLot(index); //получаем данные купленного лота                         
            const finalPrice = lot3.finalPrice;            
            const fee = finalPrice * 10n / 100n; //комиссия                       
            
            //вызываем вывод от имени невладельца и ждем отката
            await expect(auction.connect(userCreator).withdrawIncomes(fee))
                .revertedWithCustomError(auction, "NotAnOwner").withArgs(userCreator);
            
        });

        it("should revert withdraw incomes with not enough funds", async function(){ //проверка вывода прибыли
            const {userPlatform, userCreator, user2, auction } = await loadFixture(deploy);           
            
            
            const startPrice = 1000000000n;
            const duration = 1n*24n*60n*60n;
            const item = "example";
            const discountRate = 10n;

            for(let i = 0n; i != 4n; ++i) { //сначала создадим 4 лота
                
                const tx = await auction.connect(userCreator).createAuction(startPrice + i, discountRate, duration, item + i);
                tx.wait(1);                
            }
            
            const now = (await ethers.provider.getBlock("latest"))!.timestamp;
            const timeToAdd = 12 * 60 * 60; // 12 часов
            const futureTime = now + timeToAdd;

            await network.provider.send("evm_setNextBlockTimestamp", [futureTime]);
            await network.provider.send("evm_mine");

            //теперь покупаем
            const index = 3n; //попробуем купить третий лот
            const price = await auction.getPrice(index);  //получаем цену лота                     
            
            const txBuy = await auction.buy(index, {value: price});
            txBuy.wait(1);
            const lot3 = await auction.getLot(index); //получаем данные купленного лота                         
            const finalPrice = lot3.finalPrice;            
            const fee = finalPrice * 10n / 100n; //комиссия                       
            
            //вызываем вывод на большую, чем полученные комиссии сумму и ждем отката
            await expect(auction.connect(userPlatform).withdrawIncomes(fee * 2n))
                .revertedWithCustomError(auction, "NotEnoughFunds").withArgs(fee * 2n);
            
        });        
    

    });*/

    
});