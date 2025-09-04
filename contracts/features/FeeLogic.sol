// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { PlatformStorageLib } from "../core/storage/PlatformStorageLib.sol";
import { IPlatformCommon } from "../interfaces/IPlatformCommon.sol";
import { IFundVerseLoyaltyMinimal } from "../interfaces/IFundVerseLoyaltyMinimal.sol";

/// @title Модуль рабрты с комиссиями платформы
/// @notice содержит базовый функционал настройки и расчетов комисиий
abstract contract FeeLogic is IPlatformCommon {

    // Константы для настройки событий изменения параметров платформы
    bytes32 constant PARAM_BASE_FEE = keccak256("baseFee");
    
    /// @notice функция возвращает базовый размер комиссии
    function getBaseFee() public view returns (uint16) {        
        return PlatformStorageLib.layout().baseFee;
    }

    /// @notice функция возвращает размер комиссии для конкретного фаундера (с учетом дисконта)
    /// @param founder адрес фаундера, для которого запрашиваем комиссию
    function getFounderFee(address founder) public view returns (uint16) {        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        uint16 fee = s.baseFee;

        if (s.loyaltyProgram != address(0)) {
            uint16 discount = IFundVerseLoyaltyMinimal(s.loyaltyProgram).getFounderDiscount(founder);
            if (discount > fee) {
                discount = fee;
            }
            fee -= discount;
        }
        return fee;        
    }

    /// @notice функция установки базовой комиссии
    /// @dev необходимо переопределить с ролью
    /// @param _baseFee новой значение базовой комиссии
    function _setBaseFee(uint16 _baseFee) internal {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.baseFee = _baseFee;          
        emit FVPlatformParameterUpdated(PARAM_BASE_FEE, _baseFee, msg.sender);
    }
    

}
