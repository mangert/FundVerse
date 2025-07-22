// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol"; //интерфейс
import "./CampaignBase.sol"; //общий код

/**
 * @title Контракт кампании (разновидность в нативной валюте) 
 * @notice обеспечивает сбор денег на конкретную цель
 */
contract CampaignNative is ICampaign, CampaignBase {    

    constructor(){

    }


    // Основные функции взаимодействия

    /// @notice Внести средства (ETH - cчитаем в wei)
    function contribute(uint256 amount) external payable {}

    /// @notice Получить текущий собранный баланс
    function getCurrentBalance() external view returns (uint256) { return 0;}

    /// @notice Забрать средства фаундером (если условия выполнены)
    function withdrawFunds() external {}

    /// @notice Отметить кампанию как завершенную (вручную или автоматически)
    function finalizeCampaign() external {}

    /// @notice Получить краткие данные о кампании
    function getSummary()
        external
        view
        returns (
            address creator,
            address token,       // 0x0 для ETH
            uint256 goal,
            uint256 raised,
            uint256 deadline,
            bool finalized,
            bool successful
        ) { //заглушка
            creator = address(0);
            token = address(0);       
            goal = 0;
            raised = 0;
            deadline = 0;
            finalized = false;
            successful = false;
        }

    /// @notice Статус кампании
    function isSuccessful() external view returns (bool) { false; }
}