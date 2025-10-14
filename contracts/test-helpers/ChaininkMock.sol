// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title контракт-заглушка ChainlinkMock
/// @author mangert
/// @notice для тестов функция диспетчера статусов - имитирует Chainlink

import "../statusDispatcher/StatusDispatcher.sol";

contract ChainlinkMock {
    StatusDispatcher public dispatcher;

    constructor(address _dispatcher) {
        dispatcher = StatusDispatcher(_dispatcher);
    }

    function callDispatcher() external {
        
        (bool upkeepNeeded, bytes memory performData) = dispatcher.checkUpkeep("");
        
        if(upkeepNeeded) {
            dispatcher.performUpkeep(performData);
        }
    }
}