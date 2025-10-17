// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IStatusDispatcher } from "../interfaces/IStatusDispatcher.sol";

/// @title контракт-заглушка DummyCampaign
/// @author mangert
/// @notice для тестов функция диспетчера статусов
/// прикидывается контрактом-кампанией, чтобы зарегистрироваться в диспетчере
contract DummyCampaign {
    //solhint-disable comprehensive-interface
    
    /// @notice адрес диспетчера
    IStatusDispatcher public dispatcher;

    /// @notice в конструкторе присваиваем адрес диспетчера
    /// @param _dispatcher адрес диспетчера
    constructor(address _dispatcher) {
        dispatcher = IStatusDispatcher(_dispatcher);
    }

    /// @notice функция регистрируется в диспетчере
    /// @param deadline дедлайн, с которым будем регистрироваться
    function register(uint32 deadline) external {
        dispatcher.registerCampaign(deadline);
    }

    /// @notice функция отменяет подписку в диспетчере    
    function unRegister() external {
        dispatcher.unregisterCampaign();
    }
}
