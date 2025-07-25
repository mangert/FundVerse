// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol"; //интерфейс
import "./CampaignBase.sol"; //общий код

/**
 * @title Контракт кампании (разновидность в нативной валюте) 
 * @notice обеспечивает сбор денег на конкретную цель
 */
contract CampaignNative is ICampaign, CampaignBase {
    constructor(
        address payable _platformAddress,
        address _creator,
        string memory _campaignName,
        uint32 _Id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee
    ) CampaignBase (
        _platformAddress,
        _creator,
        _campaignName,
        _Id,
        _goal,
        _deadline,
        _campaignMeta,
        _platformFee,
        address(0)
    ) {}    

    // Основные функции взаимодействия

    /// @notice Внести средства - неиспользуемая перегрузка
    function contribute(uint128 amount) external pure {
        revert CampaingIncorrertFunction();
    }

    /// @notice Внести средства (ETH - cчитаем в wei)
    function contribute() external payable updateStatusIfNeeded isLive {
        
        address contributor = msg.sender;

        require(msg.value > 0, CampaingZeroDonation(contributor)); //проверяем, что не ноль

        uint128 accepted = goal - raised; //проверяем, сколько осталось до цели

        uint256 refund; //переменная для возвратов
        uint256 contribution; //сумма к зачислению       

        //в этом блоке смотрим, сколько из взноса зачислим, а сколько вернем излишков
        if (msg.value > accepted) {
            refund = msg.value - accepted;
            contribution = accepted;
        } else {
            refund = 0;
            contribution = msg.value;
        }
        //если есть, что возвращать
        if (refund > 0) {            
           if(_transferTo(payable(contributor), refund)) {
            emit CampaignRefunded(contributor, refund, address(0));
           }
        }
        //зачисляем взнос
        donates[contributor] += contribution;
        raised += uint128(contribution);

        emit CampaignContribution(contributor, contribution);
    }

    /// @notice затребовать взнос с провалившейстя или отмененной кампании
    function claimContribution() updateStatusIfNeeded external override {
        
        address recipient = msg.sender;
        
        require(status == Status.Failed || status == Status.Cancelled,
            CampaingInvalidStatus(status, Status.Failed));
        uint256 contiribution = donates[recipient];
        
        require(contiribution > 0, CampaingZeroWithdraw(recipient));
        donates[recipient] = 0;
        
        if(_transferTo(payable(recipient), contiribution)){
            emit CampaignContributionClaimed(recipient, contiribution);    
        } else {
            emit CampaignContributionDeffered(recipient, contiribution);
        }
    }

    ///@notice затребовать "зависшие" средства
    function claimPendingFunds() external override {
        address payable recipient;
        
        uint256 amount = pendingWithdrawals[recipient]; //смотрим, сколько у пользователя "зависло" средств
        require(amount > 0, CampaingZeroWithdraw(recipient)); //проверка, что невыведенные средства больше нуля

        pendingWithdrawals[recipient] = 0; //обнуляем баланс

        (bool success, ) = recipient.call{value: amount}("");
        require(success, CampaignPendingWithdrawFailed(recipient, amount, address(0)));
    }

    //функции для владельца

    /// @notice Забрать средства фаундером (если условия выполнены)
    function withdrawFunds() external updateStatusIfNeeded onlyCreator {
        //сначала проверяем статус
        require(status == Status.Successful, CampaingInvalidStatus(status, Status.Successful));
        //проверям, есть ли фонды, которые можно перевести
        uint256 fund = raised;
        require(fund > 0, CampaingZeroWithdraw(msg.sender));
        
        uint256 fee = ((fund * 1000) * platformFee) / (1000_000);
        uint256 withdrawnAmount = fund - fee;

        //обнуляем баланс
        raised = 0;
        //переводим сначала комиссию
        if(_transferTo(platformAddress, fee)){
            emit CampaignFeePayed(platformAddress, fee);
        }
        else{
            emit CampaignFeeDeffered(platformAddress, fee);
        }

        //теперь переводим себе
        if(_transferTo(payable(creator), withdrawnAmount)){
            emit CampaignFundsClaimed(creator, fund);
        }
        else{
            emit CampaignFundsDeffered(creator, fund);
        }
    }    

    //вспомогательные функции
    /**
     * @notice служебная функция перевода средств
     * @dev используется для рефандов и переводов
     * @dev не использовать при клейме зависших средств!
     */
    function _transferTo(address payable recipient, uint256 amount) internal returns (bool) {
        (bool success, ) = recipient.call{value: amount}("");
            if (!success) {
                pendingWithdrawals[recipient] += amount;
                emit CampaignTrasferFailed(msg.sender, amount, address(0));
            }
        return success;
    }

    receive() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, "");
    }

    fallback() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, msg.data);
    }    
}