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
        address  _platformAddress,
        address _creator,
        string memory _campaignName,
        uint32 _id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee
    ) CampaignBase (
        _platformAddress,
        _creator,
        _campaignName,
        _id,
        _goal,
        _deadline,
        _campaignMeta,
        _platformFee,
        address(0)
    ) {}    

    // Основные функции взаимодействия

    /// @notice Внести средства - неиспользуемая перегрузка
    function contribute(uint128 _amount) external pure {
        revert CampaingIncorrertFunction();
    }

   /// @notice Внести средства (ETH - cчитаем в wei)
    function contribute() external payable nonReentrant checkState {
        
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
        
        //зачисляем взнос
        donates[contributor] += contribution;
        raised += uint128(contribution);
        
        if(raised >= goal) { //если после зачисления достигли цели
            status = Status.Successful; //Аетуализируем статус
            emit CampaignStatusChanged(Status.Live, status, block.timestamp); // timestamp manipulation not critical here
        }

        //если есть, что возвращать
        if (refund > 0) {            
           if(_transferTo(payable(contributor), refund)) {
            emit CampaignRefunded(contributor, refund, address(0));
           }
        }

        emit CampaignContribution(contributor, contribution);
    }     

    ///@notice затребовать "зависшие" средства    
    function claimPendingFunds() external override nonReentrant {
        address recipient = payable(msg.sender);
        
        uint256 amount = pendingWithdrawals[recipient]; //смотрим, сколько у пользователя "зависло" средств
        require(amount > 0, CampaingZeroWithdraw(recipient)); //проверка, что невыведенные средства больше нуля

        pendingWithdrawals[recipient] = 0; //обнуляем баланс

        emit PendingFundsClaimed(recipient, amount);

        (bool success, ) = recipient.call{value: amount}("");
        require(success, CampaignPendingWithdrawFailed(recipient, amount, address(0)));
    }          

    //вспомогательные функции
    /**
     * @notice служебная функция перевода средств
     * @dev используется для рефандов и переводов
     * @dev не использовать при клейме зависших средств!
     */
    function _transferTo(address recipient, uint256 amount) internal override returns (bool) {
        (bool success, ) = payable(recipient).call{value: amount}("");
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