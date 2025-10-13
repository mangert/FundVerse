// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;


/// @title интерфейс IStatusDispatcher
/// @author mangert
/// @notice содержит определения external-функций и событий контракта-диспетчера статусов

interface IStatusDispatcher {

    /// @notice событие индицирует регистрацию кампании в очереди
    /// @param campaign адрес кампании
    /// @param blockTimestamp временная метка регистрации
    event CampaingnRegistered(address indexed campaign, uint32 blockTimestamp);

    /// @notice событие индицирует исключение кампании из очереди
    /// @param campaign адрес кампании
    /// @param blockTimestamp временная метка регистрации
    event CampaingnUnregistered(address indexed campaign, uint32 blockTimestamp);

    /// @notice ошибка индицирует попытку повторно зарегистрировать кампанию в очереди
    error CampaignAlreadyRegistered();

    /// @notice ошибка индицирует попытку исключить из очереди отсутствующую кампанию
    error CampaignNotRegistered();
    
    /// @notice функция регистрирует кампанию в очереди    
    function registerCampaign() external;

    /// @notice функция исключает кампанию из очереди    
    function unregisterCampaign() external;    

}
