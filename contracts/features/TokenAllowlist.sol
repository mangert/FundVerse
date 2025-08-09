// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title Абстрактный контракт управления токенами
 * @notice содержит функции проверки, поддерживается ли токен, функции добавления и удаления токенов из списка поддержки
 * @dev для нативной валюты предусмотрено значение address(0)
 */

import {PlatformStorageLib} from "../core/storage/PlatformStorageLib.sol"; //хранилище данных

using PlatformStorageLib for PlatformStorageLib.Layout;

abstract contract  TokenAllowList {

    /// @notice ошибка показывает, что добавление токена не произошло, потому что такой уже есть
    /// @param token адрес токена, который пытались добавить    
    error FundVerseAddingTokenAlreadySupported(address token);

    /// @notice ошибка показывает, что удаление токена не произошло, потому что и так не поддерживается
    /// @param token адрес токена, который пытались удалить    
    error FundVerseDeletingTokenNotSupported(address token);

    /// @notice функция проверяет, входит ли токен в список поддерживаемых
    function isAllowedToken(address token) internal view returns (bool)
    {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();        
        return(token == address(0) || s.allowedTokens[token]);
    }
    
    //служебные функции
    /// @notice функция добавляет токен в список поддерживаемых платформой
    /// @dev на уровне платформы обернуть в роль
    function _addTokenToAllowed (address token, bytes6 ticker) internal {       
        
        //повторно не добавляем        
        if(isAllowedToken(token)) {
            revert FundVerseAddingTokenAlreadySupported(token);
        }        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.allowedTokens[token] = true;        
        uint256 index = s.tokenTickers.length;
        s.tokenTickers.push(ticker);
        s.tokenIndexes[token] = index;       
        s.tokenByIndexes[index] = token;
    }

    /// @notice функция убирает токен из поддерживаемых платформой
    /// @dev на уровне платформы обернуть в роль
    function _removeTokenFromAllowed (address token) internal {        
        
        //если нет, не убираем        
        if(!isAllowedToken(token)) {
            revert FundVerseDeletingTokenNotSupported(token);
        }        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.allowedTokens[token] = false; //сначала меняем в основном мэппинге на false
        
        //меняем местами последний и удаляемый в массиве тикеров        
        uint256 lastTokenIndex = s.tokenTickers.length - 1; //зампоминаем индекс последнего элемента
        address lastToken = s.tokenByIndexes[lastTokenIndex]; //смотрим, какой это был токен

        uint256 tokenIndex = s.tokenIndexes[token]; //индекс удаляемого токена
        
        //ставим последний токен на место удаляемого и обрезаем массив
        s.tokenTickers[tokenIndex] = s.tokenTickers[lastTokenIndex];
        s.tokenTickers.pop();

        //присваиваем токену, который поставили на место удаляемого, индекс удаляемого
        //и убираем удаляемый из мэппинга
        s.tokenIndexes[lastToken] = tokenIndex;
        delete s.tokenIndexes[token];

        //присваиваем индексу, который удаляем, значение адреса последнего токена
        //и удаляем последний индекс токена из мэппинга
        s.tokenByIndexes[tokenIndex] = lastToken;
        delete s.tokenByIndexes[lastTokenIndex];        
    }    
}
