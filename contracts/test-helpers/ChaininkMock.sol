// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { StatusDispatcher } from "../statusDispatcher/StatusDispatcher.sol";

/// @title контракт-заглушка ChainlinkMock
/// @author mangert
/// @notice для тестов функция диспетчера статусов - имитирует Chainlink
contract ChainlinkMock {
    //solhint-disable comprehensive-interface
    
    /// @notice адрес диспетчера
    StatusDispatcher immutable public dispatcher;

    /// @notice в конструкторе регистрируем диспетчера
    /// @param _dispatcher адрес диспетчера
    constructor(address _dispatcher) {
        dispatcher = StatusDispatcher(_dispatcher);
    }

    /// @notice функция прикидывается chainlink и опрашивает диспетчер
    function callDispatcher() external {
        
        (bool upkeepNeeded, bytes memory performData) = dispatcher.checkUpkeep("");
        
        if(upkeepNeeded) {
            dispatcher.performUpkeep(performData);
        }
    }
}