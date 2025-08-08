// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";

/** 
 * @notice хранилищце данных платформы
 */

library PlatformStorageLib {
    bytes32 internal constant STORAGE_SLOT = keccak256("fundverse.platform.storage");

    struct Layout {
        //хранилище кампаний
        //все созданные кампании в разрезе фаундеров
        mapping(address founder => 
            mapping(uint32 id => ICampaign)
        ) campaignsByFounder;
        //счетчик кампаний по фаундерам
        mapping (address founder => uint32 campaignCounter) campaignsCountByFounder;    
        //индекс кампаний
        mapping (uint32 index => ICampaign campaign) campaignIndex;    
        //общий счетчик кампаний
        uint32 totalCounter;

        //хранилище timelock
        mapping(address founder => uint32 timelock) timelocks;
        uint32 delay;

        //другие общие установки
        // минимальная продолжительность (кампании с нулевым периодом сбора не имеют смысла)
        uint32 minLifespan; 
        
        //хранилища для Enumerable
        /*mapping(address owner => mapping(uint256 index => uint256)) private _ownedTokens;    
        mapping(uint256 tokenId => uint256) private _ownedTokensIndex;
        uint256[] private _allTokens;
        mapping(uint256 tokenId => uint256) private _allTokensIndex;
        mapping (address token => bool allowed) allowedTokens;
        mapping (uint32 tokenIndex => address token) tokenIndex;
        uint32 tokenCounter;*/
        

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
