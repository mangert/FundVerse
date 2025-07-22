// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";
import "../abstract/PlatformStorage.sol";
import "../campaigns/CampaignNative.sol";
import "../campaigns/CampaignToken.sol";


/**
 * @title пока совсем черновик 
 * @notice 
 */
abstract contract FactoryCore is PlatformStorage {  
    
    
    event CampaingCreated(); //добавить аргументы

    //пока заглушка
    function _createCampaing(bool eth) internal returns(ICampaign){ //аргуметны и модификаторы функции после разработки шаблона кампании
        
        ICampaign newCampaign = campaings[counter++];
        if(eth) {
            newCampaign = new CampaignNative(); //добавить аргументы
        }
        else {
            newCampaign = new CampaignNative(); //добавить аргументы
        }

        emit CampaingCreated();

    }
    
}
