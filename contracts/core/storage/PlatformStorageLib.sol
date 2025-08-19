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
        //адрес контракта программы лояльности
        address loyaltyProgram;       

        //общий счетчик кампаний
        uint32 totalCounter;
        // переменная задержки для таймлоков
        uint32 delay;        
        // минимальная продолжительность (кампании с нулевым периодом сбора не имеют смысла)
        uint32 minLifespan;         
        //данные для комиссии
        uint16 baseFee;  
        //переменные для залогов
        //требуемая сумма залога
        uint256 requiredDeposit;
        //общая сумма накопленных депозитов
        uint256 totalDeposit;

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
        //хранилище timelock
        mapping(address founder => uint32 timelock) timelocks;        
        
        //хранилище депозитов в разрезе кампаний
        mapping(address campaign => uint256 deposited) depositsByCampaigns;
        
        //мэппинг для информации о поддерживаемых токенах
        mapping (address token => bool allowed) allowedTokens;        
    }

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
