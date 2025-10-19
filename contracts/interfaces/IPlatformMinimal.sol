// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title сокращенный интерфейс платформы
/// @author mangert
/// @notice содержит сигнатуры функций, используемых программой лояльности
interface IPlatformMinimal {

    /// @notice функция возвращает базовый размер комиссии
    /// @return uint16 базовая комиссия в промилле
    function getBaseFee() external view returns (uint16);
    
    /// @notice Получить кампанию по глобальному индексу
    /// @param index глобальный индекс кампании
    /// @return address адрес кампании
    function getCampaignByIndex(uint32 index) external view returns (address);
    
    /// @notice Получить количество кампаний, созданных конкретным фаундером
    /// @param founder адрес фаундера, по которому делаем запрос
    /// @return uint32 количество кампаний заданного фаундера
    function getCampaignsCountByFounder(address founder) external view returns (uint32);
    
    /// @notice Получить кампанию фаундера по его локальному индексу
    /// @param founder адрес фаундера
    /// @param index индекс кампании у фаундера
    /// @return address адрес кампании
    function getCampaignOfFounderByIndex(address founder, uint32 index) external view returns (address);
}


    