// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title контракт-заглушка DummyCampaign
/// @author mangert
/// @notice для тестов функция диспетчера статусов

import "../interfaces/IStatusDispatcher.sol";

contract DummyCampaign {
    IStatusDispatcher public dispatcher;

    constructor(address _dispatcher) {
        dispatcher = IStatusDispatcher(_dispatcher);
    }

    function register(uint32 deadline) external {
        dispatcher.registerCampaign(deadline);
    }

    function unRegister() external {
        dispatcher.unregisterCampaign();
    }
}
