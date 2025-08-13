// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { PlatformStorageLib } from "../core/storage/PlatformStorageLib.sol";
import { IPlatformCommon } from "../interfaces/IPlatformCommon.sol";
import { IFundVerseNFTMinimal } from "../interfaces/IFundVerseNFTMininal.sol";
/**
 * @title черновик
 * @author 
 * @notice 
 */
using PlatformStorageLib for PlatformStorageLib.Layout;

abstract contract FeeLogic is IPlatformCommon {    
    
    function getBaseFee() public view returns (uint256) {        
        return PlatformStorageLib.layout().baseFee;
    }

    function getFounderFee(address founder) public view returns (uint16) {        
        
        uint16 discount = (IFundVerseNFTMinimal(PlatformStorageLib.layout().discountNFT)
            .getFounderDiscount(founder)) % 1000;

        require(PlatformStorageLib.layout().baseFee >= discount, "ERROR");
        
        uint16 fee = (PlatformStorageLib.layout().baseFee - discount);

        return fee;               
    }

    // Можно переопределить в Platform с модификатором onlyRole(ADMIN_ROLE)
    function _setBaseFee(uint16 _baseFee) internal {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.baseFee = _baseFee;  
        
        emit FundVersePlatformParameterUpdated("baseFee", _baseFee, msg.sender);
    }   

}
