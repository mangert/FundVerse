// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;


/// @title интерфейс IStatusDispatcher
/// @author mangert
/// @notice содержит определения external-функций и событий контракта-диспетчера статусов

interface IStatusDispatcher {

    // заглушаем предупреждения, чтобы время не заставлял делать indexed
    // solhint-disable gas-indexed-events       
    /// @notice событие индицирует регистрацию кампании в очереди
    /// @param campaign адрес кампании
    /// @param blockTimestamp временная метка регистрации
    event CampaignRegistered(address indexed campaign, uint256 blockTimestamp); 

    /// @notice событие индицирует исключение кампании из очереди
    /// @param campaign адрес кампании
    /// @param blockTimestamp временная метка регистрации    
    event CampaignUnregistered(address indexed campaign, uint256 blockTimestamp); 

    // solhint-disable gas-indexed-events

    /// @notice ошибка индицирует попытку повторно зарегистрировать кампанию в очереди
    error CampaignAlreadyRegistered();

    /// @notice ошибка индицирует попытку исключить из очереди отсутствующую кампанию
    error CampaignNotRegistered();
    
    /// @notice функция регистрирует кампанию в очереди
    /// @param _deadline дедлайн  
    function registerCampaign(uint32 _deadline) external;

    /// @notice функция исключает кампанию из очереди        
    function unregisterCampaign() external;    

    /// @notice функция возвращает верхнюю кампанию в куче
    /// @return campaign адрес кампании
    /// @return deadline дедлайн
    function getNextCampaign() external view returns (address campaign, uint256 deadline);

}
