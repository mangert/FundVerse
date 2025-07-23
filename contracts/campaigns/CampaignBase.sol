// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";
/**
 * @title Абстрактный контракт для кампаний
 * @notice содержит общую часть (хранилище, типы, модификаторы) 
 */
abstract contract CampaignBase is ICampaign {    
    
    //хранилище данных 
    address public immutable creator; //пока паблик, там подумаю.
    address public immutable token; // 0x0 для ETH (для совместимости)    
    
    uint128 public immutable goal; //цель - wei / decimals   
    uint128 public immutable platformFee; //комиссия платформы в промилле
    
    uint32 public immutable deadline; //срок
    uint32 public immutable Id; //идентификатор

    uint128 public raised; //собрано - wei / decimals
    
    Status public status; //статус кампании    
    
    string public campaignName; //имя
    string public campaignMeta; // JSON-метаданные (описание + документы/IPFS)   

    mapping(address investor => uint256 value) donates; //хранилище для вкладов участников Как лучше назвать? Сделать паблик?
    mapping (address recipient => uint256 value) pendingWithdrawals; //хранилище для "зависших" сумм

    //модификаторы 
    /**
     * @dev модификатор применяется к функциям, которые может вызвать только фаундер
     */
    modifier onlyCreator() {
        require(msg.sender == creator, CampaingUnauthorizedAccount(msg.sender)); 
        _;
    }

    /**
     * @dev модификатор применяется к функциям, которые могут вызываться только на "живых" кампаниях
     */
    modifier isLive() {
        require(status == Status.Live, CampaingInvalidStatus(status, Status.Live));
        _;
    }

    /**
     * @notice актуализирует статус контракта
     * @dev модификатор применяется к фунциям взаимодействия с контрактом до вызова других пользовательских модификаторов
     */
    modifier updateStatusIfNeeded() {
    if (status == Status.Live && block.timestamp >= deadline) {
        if (raised >= goal) {
            status = Status.Successful;
        } else {
            status = Status.Failed;
        }
        emit CampaignFinalized(status, block.timestamp);
    }
    _;
}
   

}