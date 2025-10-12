// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title 
/// @author mangert
/// @notice содержит функционал автоперевода статуса контрактов-кампанй

import { IStatusDispatcher } from "../interfaces/IStatusDispatcher.sol";

contract StatusDispatcher is IStatusDispatcher{

    /// @notice функция регистрирует кампанию в очереди
    /// @dev подумать, что она будет возращать
    function registerCampaign() external override returns(bool) {
        return true;
    }

    /// @notice функция исключает кампанию из очереди
    /// @dev подумать, что она будет возращать
    function unregisterCampaign() external override returns(bool) {
        return true;
    }    

}
