// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";
/**
 * @title Абстрактный контракт для кампаний
 * @notice содержит общую часть (хранилище, типы, модификаторы) 
 */
abstract contract CampaignBase is ICampaign {

    /**
     * @notice перечисление статусов кампаний
     */
    enum Status {
        Live,         // идет сбор
        Stopped,      // временно приостановлена
        Cancelled,    // отменена фаундером (возврат средств)
        Failed,       // не собрала нужное → неуспешна
        Successful    // достигла цели и финализирована
    }
    
    //хранилище данных 
    address public immutable creator; //пока паблик, там подумаю.
    address public immutable token; // 0x0 для ETH (для совместимости)    
    
    uint128 public immutable goal; //цель - wei / decimals   
    
    uint32 public immutable deadline; //срок
    uint32 public immutable Id; //идентификатор

    uint128 public raised; //собрано - wei / decimals
    Status public status; //статус кампании    
    
    string public campaignName; //имя
    string public campaignMeta; // JSON-метаданные (описание + документы/IPFS)   

    //модификаторы 
    modifier onlyCreator() {
        require(msg.sender == creator, "Not creator"); //ошибку сделать
        _;
    }

    modifier isLive() {
        require(status == Status.Live, "Not live"); //ошибку сделать
        _;
    }   

}