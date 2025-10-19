// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title минимальный интерфейс контракта программы лояльности платформы
/// @author mangert
/// @notice содержит сигнатуры тольк специальных функций для скидок
interface IFundVerseLoyaltyMinimal {    
    
    /// @notice функция возвращает размер скидки на комиссию для фаундера
    /// @param founder адрес фаундера, для которого рассчитываем скидку
    /// @return uint16 скидка на комиссию фаундера
    function getFounderDiscount(address founder) external view returns(uint16);

    /// @notice функция возвращает адрес платформы, на которую распространяется программа лояльности
    /// @return address адрес платформы
    function platform() external view returns(address);
}