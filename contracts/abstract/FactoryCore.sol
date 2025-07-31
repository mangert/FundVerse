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
    
    
    event CampaignCreated(); //добавить аргументы

    //пока заглушка
    /*function _createCampaign(bool eth) internal returns(ICampaign){ //аргуметны и модификаторы функции после разработки шаблона кампании
        
        ICampaign newCampaign = Campaigns[counter++];
        if(eth) {
            newCampaign = new CampaignNative(); //добавить аргументы
        }
        else {
            newCampaign = new CampaignNative(); //добавить аргументы
        }

        emit CampaignCreated();

    }*/
    
}
