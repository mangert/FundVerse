// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";
import "../campaigns/CampaignNative.sol";
import "../campaigns/CampaignToken.sol";
import "../libs/PlatformStorageLib.sol";

using PlatformStorageLib for PlatformStorageLib.Layout;

/**
 * @title пока совсем черновик 
 * @notice 
 */
abstract contract FactoryCore {      
    
    /// @notice событие порождается при создании новой кампании
    /// @param NewCampaignAddress адрес контратка созданной кампании
    /// @param founder адрес фаундера
    /// @param token адрес токена валюты кампании (для ETH - address(0))
    /// @param goal целевая сумма сбора     
    event FundVerseCampaignCreated(
        ICampaign indexed NewCampaignAddress
        , address indexed founder
        , address indexed token
        , uint256 goal
        ); 

    
    function _createCampaign(        
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee, 
        address _token
        ) internal returns(ICampaign) { 

        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();

        address founder = msg.sender;
        uint32 index = s.totalCounter;
        ICampaign newCampaign = s.campaignIndex[index];
        
        if(_token == address(0)) {
            newCampaign = new CampaignNative(
                address(this),       
                founder,
                index,
                _goal,
                _deadline,
                _campaignMeta,
                _platformFee                 
            ); 
        }
        else {
            newCampaign = new CampaignToken(
                address(this),       
                founder,
                index,
                _goal,
                _deadline,
                _campaignMeta,
                _platformFee, 
                _token
            ); 
        }
        s.totalCounter++;        
        s.campaignsByFounder[founder][s.campaignsCountByFounder[founder]++] = newCampaign;        

        emit FundVerseCampaignCreated(
            newCampaign,
            founder,
            _token,
            _goal
        );
        return newCampaign;
    }    
}
