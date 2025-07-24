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
        address _creator,
        string memory _campaignName,
        uint32 _Id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee
    ) {
        creator = _creator;
        campaignName = _campaignName;
        Id = _Id;
        goal = _goal;
        deadline = _deadline;
        campaignMeta = _campaignMeta;
        platformFee = _platformFee;

        status = Status.Live; //для ясности - можно убрать
        token = address(0); // для ясности - можно убрать
    }

    // Основные функции взаимодействия

    /// @notice Внести средства - неиспользуемая перегрузка
    function contribute(uint128 amount) external pure {
        revert CampaingIncorrertFunction();
    }

    /// @notice Внести средства (ETH - cчитаем в wei)
    function contribute() external payable updateStatusIfNeeded isLive {
        require(msg.value > 0, CampaingZeroDonation(msg.sender)); //проверяем, что не ноль

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
            (bool success, ) = payable(msg.sender).call{value: refund}("");
            if (!success) {
                pendingWithdrawals[msg.sender] += refund;
                emit CampaignTrasferFailed(msg.sender, refund, address(0));
            } else {
                emit CampaignRefunded(msg.sender, refund, address(0));
            }
        }
        //зачисляем взнос
        donates[msg.sender] += contribution;
        raised += uint128(contribution);

        emit CampaignContribution(msg.sender, contribution);
    }

    function claimContribution() external override {}

    function claimPendingFunds() external override {}

    //функции для владельца

    /// @notice Забрать средства фаундером (если условия выполнены)
    function withdrawFunds() external {}    

    //вспомогательные функции
    receive() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, "");
    }

    fallback() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, msg.data);
    }

    
}