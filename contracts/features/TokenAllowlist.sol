// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title Абстрактный контракт управления токенами
 * @notice содержит функции проверки, поддерживается ли токен, функции добавления и удаления токенов из списка поддержки
 * @dev для нативной валюты предусмотрено значение address(0)
 */

import { IPlatformCommon } from "../interfaces/IPlatformCommon.sol";
import {PlatformStorageLib} from "../core/storage/PlatformStorageLib.sol"; //хранилище данных

abstract contract TokenAllowList is IPlatformCommon {

    /// @notice функция проверяет, входит ли токен в список поддерживаемых
    function isAllowedToken(address token) internal view returns (bool)
    {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();        
        return(token == address(0) || s.allowedTokens[token]);
    }
    
    //служебные функции
    /// @notice функция добавляет токен в список поддерживаемых платформой
    /// @dev на уровне платформы обернуть в роль
    /// @dev нативную валюту добавить нельзя
    /// @param token адрес добавляемого токена    
    function _addTokenToAllowed (address token) internal {       
        
        //повторно не добавляем        
        if(token == address(0) || isAllowedToken(token)) {
            revert FundVerseAddingTokenAlreadySupported(token);
        }        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.allowedTokens[token] = true;                
        emit FundVerseNewTokenAdded(token);
    }

    /// @notice функция убирает токен из поддерживаемых платформой
    /// @dev на уровне платформы обернуть в роль
    /// @dev нативную валюту убрать нельзя
    /// @param token адрес убираемого токена    
    function _removeTokenFromAllowed (address token) internal {        
        
        //если нет, не убираем        
        if(token == address(0) || !isAllowedToken(token)) {
            revert FundVerseRemovingTokenNotSupported(token);
        }        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        delete s.allowedTokens[token];
        emit FundVerseTokenRemoved(token);
        
    }    
}
