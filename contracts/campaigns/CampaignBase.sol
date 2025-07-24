// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";
/**
 * @title Абстрактный контракт для кампаний
 * @notice содержит общую часть (хранилище, типы, модификаторы) 
 */
abstract contract CampaignBase is ICampaign {    
    
    //хранилище данных 
    /// @notice создатель, он же владелец
    address public immutable creator;
    /// @notice 0x0 для ETH (для совместимости)
    address public immutable token; 
    
    /// @notice цель - wei / decimals   
    uint128 public immutable goal; 
    /// @notice комиссия платформы в промилле
    uint128 public immutable platformFee; 
    
    /// @notice срок
    uint32 public immutable deadline;
    /// @notice идентификатор
    uint32 public immutable Id; 

    /// @notice Текущий собранный баланс
    uint128 public raised; //собрано - wei / decimals
    
    /// @notice статус кампании
    Status public status; 
    /// @notice имя
    string public campaignName;
    /// @notice JSON-метаданные (описание + документы/IPFS)   
    string public campaignMeta; 

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
            emit CampaignStatusChanged(Status.Live, status, block.timestamp);
        }
    _;
    }

    //общие для обеих версий геттеры        
    
    /// @notice Получить сводку о кампании
    function getSummary()
        external
        view
        virtual
        returns (
            address _creator,
            string memory _campaignName,
            uint32 _Id,
            address _token, // 0x0 для ETH
            uint128 _goal,
            uint128 _raised,
            uint32 _deadline,
            string memory _campaignMeta,
            Status _status            
        ){
            return(
                creator, 
                campaignName, 
                Id,
                token, // 0x0 для ETH
                goal,
                raised,
                deadline,
                campaignMeta,
                status
            );        
    }
    
    /// @notice узнать сумму взносов инвестора
    function getUserContribute(address investor) external view returns(uint256) {
        return donates[investor];
    }
    
    /// @notice узнать сумму "зависших" средств
    function getPendingFunds(address recipient) external view returns(uint256) {
        return pendingWithdrawals[recipient];
    }
    
    /// @notice техническая функция - расшифровывает значение статуса словами
    function getStatusName(Status _status) external pure virtual returns(string memory) {
        
        string [5] memory  statuses = [
            "Live",
            "Stopped",
            "Cancelled",    
            "Failed",       
            "Successful"    
        ];
        uint8 index = uint8(_status);
        require(statuses.length > index, CampaignUnknownStatus(_status));
        return statuses[index];
    } 
    
    /// @notice установить новый статус
    function setCampaignStatus(Status newStatus) external onlyCreator {
        Status oldStatus = status; //запоминаем текущий статус        
        
        require(
            oldStatus < Status.Cancelled && //статус менять можем только у живых и приостановленных кампаний
            oldStatus != newStatus, //проверяем, что новый и старый статусы не совпадают
            CampaingInvalidChandgedStatus(newStatus)
        );

        //переменная для сохранения валидности смены статус
        bool valid;

        //цепочка проверяет, можем ли мы установить запрашиваемый статус в зависимости от текущего состояния контракта
        //и сохраняет результат в переменную valid
        if (newStatus == Status.Successful) {
            valid = (raised >= goal); // полностью собранные кампании можем объявлять успешными досрочно
        } else if (newStatus == Status.Cancelled || newStatus == Status.Stopped) {
            valid = (block.timestamp < deadline && raised < goal);
        } else if (newStatus == Status.Failed) {
            valid = (block.timestamp >= deadline && raised < goal);
        } else if (newStatus == Status.Live) {
            valid = (block.timestamp < deadline && raised < goal);
        }

        require(valid, CampaingInvalidChandgedStatus(newStatus));
        
        status = newStatus;
        emit CampaignStatusChanged(oldStatus, newStatus, block.timestamp);
    }   

}