// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";
/**
 * @title Абстрактный контракт для кампаний
 * @notice содержит общую часть (хранилище, типы, модификаторы) 
 */
abstract contract CampaignBase is ICampaign {    
    
    //хранилище данных 
    /// @notice адрес платформы краудфандинга (для получения комиссии)
    address internal immutable platformAddress;
    
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

    constructor(
        address payable _platformAddress,        
        address _creator,
        string memory _campaignName,
        uint32 _Id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee, 
        address _token
    ) {
        platformAddress= _platformAddress;
        creator = _creator;
        campaignName = _campaignName;
        Id = _Id;
        goal = _goal;
        deadline = _deadline;
        campaignMeta = _campaignMeta;
        platformFee = _platformFee;

        status = Status.Live; //для ясности - можно убрать
        token = _token; // address(0) — для ETH, иначе — адрес ERC20 токена
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
    function getContribution(address investor) external view returns(uint256) {
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
    //общие функции по выводу средств
    /// @notice затребовать взнос с провалившейстя или отмененной кампании
    function claimContribution() updateStatusIfNeeded external override {
        
        address recipient = msg.sender;
        
        require(status == Status.Failed || status == Status.Cancelled,
            CampaingInvalidStatus(status, Status.Failed));
        uint256 contiribution = donates[recipient];
        
        require(contiribution > 0, CampaingZeroWithdraw(recipient));
        donates[recipient] = 0;
        
        if(_transferTo(recipient, contiribution)){
            emit CampaignContributionClaimed(recipient, contiribution);    
        } else {
            emit CampaignContributionDeffered(recipient, contiribution);
        }
    }
    /// @notice функция для владельца    
    /// @notice Забрать средства фаундером (если условия выполнены)
    function withdrawFunds() external updateStatusIfNeeded onlyCreator {
        //сначала проверяем статус
        require(status == Status.Successful, CampaingInvalidStatus(status, Status.Successful));
        //проверям, есть ли фонды, которые можно перевести
        uint256 fund = raised;
        require(fund > 0, CampaingZeroWithdraw(msg.sender));
        
        uint256 fee = ((fund * 1000) * platformFee) / (1000_000);
        uint256 withdrawnAmount = fund - fee;

        //обнуляем баланс
        raised = 0;
        //переводим сначала комиссию
        if(_transferTo(platformAddress, fee)){
            emit CampaignFeePayed(platformAddress, fee);
        }
        else{
            emit CampaignFeeDeffered(platformAddress, fee);
        }

        //теперь переводим себе
        if(_transferTo(creator, withdrawnAmount)){
            emit CampaignFundsClaimed(creator, fund);
        }
        else{
            emit CampaignFundsDeffered(creator, fund);
        }
    }

    /// @notice функция для владельца    
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

    //служебные функции

    /**
     * @notice служебная функция перевода средств
     * @dev реализация зависит от валюты, обязательно переопределять в наследниках
     * @param recipient получатель
     * @param amount сумма перевода
     */
    function _transferTo(address recipient, uint256 amount) internal virtual returns (bool);

}