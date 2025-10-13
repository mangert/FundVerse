// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ICampaign } from "../../interfaces/ICampaign.sol";
import { IStatusDispatcher } from "../../interfaces/IStatusDispatcher.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CampaignBase - aбстрактный контракт для кампаний
/// @author mangert
/// @notice содержит общую часть (хранилище, типы, модификаторы, функции, которые не зависят от валюты)  
abstract contract CampaignBase is ICampaign, ReentrancyGuard {    
    
    //хранилище данных 
    /// @notice адрес платформы краудфандинга (для получения комиссии)
    address internal immutable platformAddress;
    
    /// @notice адрес контракта-диспетчера для перевода статуса по дедлайну
    address public immutable statusDispatcher;
    
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
    uint32 public immutable id; 

    /// @notice Общая сумма средств, внесённых в кампанию за всё время.
    /// @dev Значение не уменьшается при возврате вкладов или выводе средств фаундером.
    uint128 public raised; //собрано - wei / decimals
    
    /// @notice статус кампании
    Status public status; 

    /// @notice внутренний флаг, что фаундер еще не выводил средства
    bool internal founderWithdrawn;

    /// @notice флаг для nonReentrancy
    bool private _inCall;
       
    /// @notice JSON-метаданные (описание + документы/IPFS)   
    string public campaignMeta; 

    mapping(address investor => uint256 value) internal donates; //хранилище для вкладов участников
    mapping (address recipient => uint256 value) internal pendingWithdrawals; //хранилище для "зависших" сумм
    
    /**
     * @dev модификатор применяется к функциям, которые может вызвать только фаундер
     */
    modifier onlyCreator() {
        require(msg.sender == creator, CampaignUnauthorizedAccount(msg.sender)); 
        _;
    }
    
    /// @dev модификатор применяется к функциям, которые могут вызываться только на "живых" кампаниях    
    modifier checkState() {                        
        require(status == Status.Live, CampaignInvalidStatus(status, Status.Live));
        // slither-disable-next-line timestamp
        require(block.timestamp < deadline, CampaignTimeExpired(deadline, block.timestamp));
        _;
    }   

    /// @notice конструктор
    /// @param _platformAddress адрес платформы
    /// @param _creator создатель кампании
    /// @param _id идентификатор кампании
    /// @param _goal целевая сумма сборов
    /// @param _deadline срок действия кампании
    /// @param _campaignMeta метаданные (название, описание, ссылка на ресурсы и т.д.)
    /// @param _platformFee комиссия платформы    
    /// @param _statusDispatcher адрес контракта диспетчера для автоперевода статуса
    constructor(
        address _platformAddress,        
        address _creator,        
        uint32 _id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee, 
        address _token,
        address _statusDispatcher

    ) {
        platformAddress= _platformAddress;
        creator = _creator;        
        id = _id;
        goal = _goal;
        deadline = _deadline;
        campaignMeta = _campaignMeta;
        platformFee = _platformFee;

        status = Status.Live; //для ясности - можно убрать
        token = _token; // address(0) — для ETH, иначе — адрес ERC20 токена
        statusDispatcher = _statusDispatcher;

        register(); // регистрируем нашу кампанию в диспетчере
    }

    //общие для обеих версий геттеры        
    
    /// @notice Получить сводку о кампании
    function getSummary()
        external
        view
        virtual
        returns (
            address _creator,            
            uint32 _id,
            address _token, // 0x0 для ETH
            uint128 _goal,
            uint128 _raised,
            uint32 _deadline,
            string memory _campaignMeta,
            Status _campaignStatus            
        ){
            return(
                creator,                 
                id,
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
   
    //общие функции по выводу средств
    /// @notice затребовать взнос с провалившейся или отмененной кампании
    function claimContribution()  external nonReentrant override {

        checkDeadlineStatus(); //актуализируем статус по дедлайну, если необходимо      
        address recipient = msg.sender;
        
        require(status == Status.Failed || status == Status.Cancelled,
            CampaignInvalidStatus(status, Status.Failed));
        uint256 contiribution = donates[recipient];
        
        require(contiribution > 0, CampaignZeroWithdraw(recipient));
        donates[recipient] = 0;
        
        if(_transferTo(recipient, contiribution)){
            emit CampaignContributionClaimed(recipient, contiribution);    
        } else {
            emit CampaignContributionDeffered(recipient, contiribution);
        }
    }
    /// @notice функция для владельца    
    /// @notice Забрать средства фаундером (если условия выполнены)
    function withdrawFunds() external nonReentrant onlyCreator {
        
        //сначала проверяем статус
        require(status == Status.Successful, CampaignInvalidStatus(status, Status.Successful));
        //проверяем, есть ли фонды, которые можно перевести
        uint256 fund = raised;
        //теперь проверим, не повторный ли это вывод
        require(!founderWithdrawn, CampaignTwiceWithdraw(msg.sender));
        founderWithdrawn = true;
        
        uint256 fee = ((fund * 1000) * platformFee) / (1000_000);
        uint256 withdrawnAmount = fund - fee;

        //переводим сначала комиссию
        if(_transferTo(platformAddress, fee)){
            emit CampaignFeePayed(platformAddress, fee);
        }
        else{
            emit CampaignFeeDeffered(platformAddress, fee);
        }

        //теперь переводим себе
        if(_transferTo(creator, withdrawnAmount)){
            emit CampaignFundsClaimed(creator, withdrawnAmount);
        }
        else{
            emit CampaignFundsDeffered(creator, withdrawnAmount);
        }
    }   
    
    /// @notice функция отменяет кампанию
    function cancelCampaign() external onlyCreator override {
        require(
            (status == Status.Live || status == Status.Stopped) 
            && block.timestamp < deadline,
            CampaignInvalidChandgedStatus(Status.Cancelled)
        );        

        status = Status.Cancelled;
        emit CampaignStatusChanged(Status.Live, Status.Cancelled, block.timestamp);
        unregister();
    }

    /// @notice функция приостанавливает кампанию
    function stopCampaign() external onlyCreator override {
        require(status == Status.Live && block.timestamp < deadline,
            CampaignInvalidChandgedStatus(Status.Stopped));        

        status = Status.Stopped;
        emit CampaignStatusChanged(Status.Live, Status.Stopped, block.timestamp);
    }

    /// @notice функция запускает приостановленную кампанию
    function resumeCampaign() external onlyCreator override {
        require(status == Status.Stopped && block.timestamp < deadline, 
        CampaignInvalidChandgedStatus(Status.Live));        

        status = Status.Live;
        emit CampaignStatusChanged(Status.Stopped, Status.Live, block.timestamp);
    }


    //служебные функции

    /// @notice функция регистрирует кампанию в диспетчере статусов
    function register() internal virtual {
        if(statusDispatcher != address(0)) {
            IStatusDispatcher(statusDispatcher).registerCampaign();
        }
    }

    /// @notice функция отменяет регистрацию кампании в диспетчере статусов
    function unregister() internal virtual {
        if(statusDispatcher != address(0)) {
            IStatusDispatcher(statusDispatcher).unregisterCampaign();
        }
    }
    
    /// @notice функция автоматически актуализирует статус контракта при истекшем дедлайне
    /// @dev вызывается внутри функции вывода взносов, но может быть вызвана снаружи    
    function checkDeadlineStatus() public virtual {
    
        Status previous = status;
        // slither-disable-next-line timestamp
        if ((status == Status.Live || status == Status.Stopped) &&                        
            block.timestamp >= deadline
            ) {
                status = raised >= goal ? Status.Successful : Status.Failed;
                emit CampaignStatusChanged(previous, status, block.timestamp); 
                unregister(); //пусть здесь останется - тогда можно спокойно вызывать руками тоже
        }
    }
    
    /// @notice служебная функция перевода средств
    /// @dev реализация зависит от валюты, обязательно переопределять в наследниках
    /// @param recipient получатель
    /// @param amount сумма перевода
    /// @return bool результатм перевода
    function _transferTo(address recipient, uint256 amount) internal virtual returns (bool);  
    
    receive() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, "");
    }

    fallback() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, msg.data);
    } 
}