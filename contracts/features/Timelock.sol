// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {PlatformStorageLib} from "../core/storage/PlatformStorageLib.sol";
import { IPlatformCommon } from "../interfaces/IPlatformCommon.sol";

/// @title Модуль проверки timelock
/// @author mangert
/// @notice содержит функционал для проверки и установки таймлоков создания новых кампаний
abstract contract Timelock is IPlatformCommon {      

    // Константы для настройки событий изменения параметров платформы
    bytes32 private constant PARAM_DELAY = keccak256("delay");

    /// @notice функция проверяет, действует ли еще таймлок для фаундера
    /// @param founder адрес фаундера, которого проверяем
    /// @return bool результат проверки
    function _isLocked(address founder) internal view returns(bool) {            
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        // solhint-disable-next-line gas-strict-inequalities, not-rely-on-time
        return(s.timelocks[founder] >= uint32(block.timestamp)); // slither-disable-line timestamp
    }

    /// @notice фунция устанавливает таймлок для пользователя
    /// @param founder адрес фаундера, для которого устанавливаем таймлок
    /// @dev должна вызываться при создании компаний
    function _setLockTime(address founder) internal {        
        //ссылка на хранилище    
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        // solhint-disable-next-line not-rely-on-time
        uint32 _timelock = uint32(block.timestamp) + s.delay;
        s.timelocks[founder] = _timelock;
        emit FVSetFounderTimelock(founder, _timelock);
    }

    /// @notice функция по установке срока таймлоков,
    /// @notice позволяет устанавливать длительность лока взамен установленного ранее
    /// @notice действует глобально для всех пользователей, создающих кампании после установки нового значения
    /// @dev следует переопределить с установкой роли
    /// @param newDelay новое значение лока
    function _setDelay(uint32 newDelay) internal {        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();        
        s.delay = newDelay;
        emit FVPlatformParameterUpdated(PARAM_DELAY, newDelay, msg.sender);
    }

    //геттеры
    
    /// @notice Получить информацию о стандартном значении лока
    /// @return uint32 установленная на платформе продолжительность лока
    function getDelay() external view returns (uint32) {
        return PlatformStorageLib.layout().delay;
    }

    /// @notice Получить информацию о таймлоке пользователя
    /// @param founder адрес фаундера, для которого проверяем таймлок
    /// @return uint32 текущее значение таймлока пользователя    
    function getFounderTimelock(address founder) external view returns (uint32) {
        return PlatformStorageLib.layout().timelocks[founder];
    }
}

