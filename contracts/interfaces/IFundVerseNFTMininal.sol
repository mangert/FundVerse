// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title минимальный интерфейс NFT платформы
/// @notice содержит сигнатуры тольк специальных функций для скидок
interface IFundVerseNFTMinimal {    
    
    /// @notice функция возвращает размер скидки на комиссию для фаундера
    /// @param founder адрес фаундера, для которого рассчитываем скидку
    function getFounderDiscount(address founder) external view returns(uint16);

}