// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../../interfaces/ICampaign.sol";

/** 
 * @notice хранилищце данных платформы
 */

library PlatformStorageLib {
    bytes32 internal constant STORAGE_SLOT = keccak256("fundverse.platform.storage");

    struct Layout {
        
         // Адрес фабрики
        address factory;
        //хранилище кампаний
        //все созданные кампании в разрезе фаундеров
        mapping(address founder => 
            mapping(uint32 id => address)
        ) campaignsByFounder;
        //счетчик кампаний по фаундерам
        mapping (address founder => uint32 campaignCounter) campaignsCountByFounder;    
        //индекс кампаний
        mapping (uint32 index => address campaign) campaignIndex;    
        //список зарегистрированных кампаний
        mapping (address campaign => bool) registeredCampaigns;            
        //общий счетчик кампаний
        uint32 totalCounter;

        //переменные для залогов
        //требуемая сумма залога
        uint256 requiredDeposit;
        //общая сумма накопленных депозитов
        uint256 totalDeposit;
        //хранилище депозитов в разрезе кампаний
        mapping(address campaign => uint256 deposited) depositsByCompaigns;
        
        //хранилище timelock
        mapping(address founder => uint32 timelock) timelocks;
        uint32 delay;

        //другие общие установки
        // минимальная продолжительность (кампании с нулевым периодом сбора не имеют смысла)
        uint32 minLifespan;         
        
        //мэппинг для информации о поддерживаемых токенах
        mapping (address token => bool allowed) allowedTokens;        
        

        //данные для комиссии
        uint16 baseFee;  

        //адрес коллекции NFT
        address discountNFT;
        
        
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
