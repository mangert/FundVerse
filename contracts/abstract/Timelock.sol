// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PlatformStorageLib} from "../libs/PlatformStorageLib.sol";

using PlatformStorageLib for PlatformStorageLib.Layout;

/// @title Модуль проверки timelock
/// @notice содержит функционал для проверки и установки таймлоков создания новых кампаний
abstract contract Timelock {      
     
    /// @notice событие индицирует установку фаундеру нового таймлока
    /// @param founder адрес фаундера
    /// @param timelock время истечения таймлока
    event FundVerseSetFounderTimelock(address founder, uint32 timelock);
    
    /// @notice ошибка индицирует попытку создания кампании до истечения таймлока
    /// @param timelock время истечения таймлока
    error FundVerseErrorTimeLocked(uint256 timelock);
    
    /// @notice функция проверяет, действует ли еще таймлок для фаундера
    function _isLocked(address founder) internal view returns(bool) {            
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        
        return(s.timelocks[founder] >= uint32(block.timestamp));
    }

    /// @notice фунция устанавливает таймлок для пользователя
    /// @dev должна вызываться при создании компаний
    function _setLockTime(address founder) internal {        
        //ссылка на хранилище    
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        uint32 _timelock = uint32(block.timestamp) + s.delay;
        s.timelocks[founder] = _timelock;
        emit FundVerseSetFounderTimelock(founder, _timelock);
    }

    /// @notice функция по установке срока таймлоков,
    /// @notice позволяет устанавливать длительность лока взамен установленного ранее
    /// @notice действует глобально для всех пользователей, создающих кампании после установки нового значения
    /// @dev следует переопределить с установкой роли
    function _setDelay(uint32 newDelay) internal {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.delay = newDelay;
    }

    //геттеры
    /// @notice Получить информацию о таймлоке пользователя
    /*function getFounderTimelock(address founder) external view returns (uint32) {
        return PlatformStorageLib.layout().timelocks[founder];
    }*/


}

