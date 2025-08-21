// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;


/// @title сокращенный интерфейс платформы
/// @notice содержит сигнатуры функций, используемых программой лояльности
interface IPlatformMinimal {

    /// @notice функция возвращает базовый размер комиссии
    function getBaseFee() external view returns (uint16);
    
    /// @notice Получить кампанию по глобальному индексу
    function getCampaignByIndex(uint32 index) external view returns (address);
    
    /// @notice Получить количество кампаний, созданных конкретным фаундером
    function getCampaignsCountByFounder(address founder) external view returns (uint32);
    
    /// @notice Получить кампанию фаундера по его локальному индексу
    function getCampaignOfFounderByIndex(address founder, uint32 index) external view returns (address);
}


    