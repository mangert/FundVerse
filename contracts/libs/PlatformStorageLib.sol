// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";

/** 
 * @notice хранилищце данных для главного контракта платформы
 */

library PlatformStorageLib {
    bytes32 internal constant STORAGE_SLOT = keccak256("fundverse.platform.storage");

    struct Layout {
        //хранилище кампаний
        //все созданные кампании в разрезе фаундеров
        mapping(address founder => 
            mapping(uint32 id => ICampaign)
        )  campaignsByFounder;
        //счетчик кампаний по фаундерам
        mapping (address founder => uint32 campaignCounter) campaignsCountByFounder;    
        //индекс кампаний
        mapping (uint32 index => ICampaign campaign) campaignIndex;    
        
        uint32 totalCounter;


        //данные для комиссии
        uint16 baseFee;


    
    
        
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
