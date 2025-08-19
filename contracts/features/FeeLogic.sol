// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { PlatformStorageLib } from "../core/storage/PlatformStorageLib.sol";
import { IPlatformCommon } from "../interfaces/IPlatformCommon.sol";
import { IFundVerseLoyaltyMinimal } from "../interfaces/IFundVerseLoyaltyMininal.sol";
/**
 * @title черновик
 * @author 
 * @notice 
 */
using PlatformStorageLib for PlatformStorageLib.Layout;

abstract contract FeeLogic is IPlatformCommon {    
    
    /// @notice функция возвращает базовый размер комиссии
    function getBaseFee() public view returns (uint256) {        
        return PlatformStorageLib.layout().baseFee;
    }

    /// @notice функция возвращает размер комиссии для конкретного фаундера (с учетом дисконта)
    /// @param founder адрес фаундера, для которого запрашиваем комиссию
    function getFounderFee(address founder) public view returns (uint16) {        
        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        address loyaltyProgram = s.loyaltyProgram;

        //получаем размер скидки. 
        // если программа лояльности не прикреплена, скидка равна 0
        //если вдруг скидка больше 1000 промилле, просто отбрасываем лишнее
        // slither-disable-next-line uninitialized-local
        uint16 discount;
        if (loyaltyProgram != address(0)) {
            discount = IFundVerseLoyaltyMinimal(loyaltyProgram).getFounderDiscount(founder);
            if (discount > 1000) {
                discount = 1000; // ограничим сверху
            }
        }

        //запишем в переменную базовую комиссию
        uint16 fee = s.baseFee;
        
        //и применим к ней скидку (если вдруг скидка больше базовой комиссии, просто не применяем)
        unchecked {
            if (fee >= discount) {
              fee - discount;  
            }
        }               
        return fee;               
    }

    /// @notice функция установки базовой комиссии
    /// @dev необходимо переопределить с ролью
    /// @param _baseFee новой значение базовой комиссии
    function _setBaseFee(uint16 _baseFee) internal {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.baseFee = _baseFee;  
        
        emit FundVersePlatformParameterUpdated("baseFee", _baseFee, msg.sender);
    }   

}
