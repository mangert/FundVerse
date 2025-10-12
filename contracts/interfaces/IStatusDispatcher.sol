// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;


/// @title интерфейс IStatusDispatcher
/// @author mangert
/// @notice содержит определения external-функций и событий контракта-диспетчера статусов

interface IStatusDispatcher {

    /// @notice функция регистрирует кампанию в очереди
    /// @dev подумать, что она будет возращать
    function registerCampaign() external returns(bool);

    /// @notice функция исключает кампанию из очереди
    /// @dev подумать, что она будет возращать
    function unregisterCampaign() external returns(bool);    

}
