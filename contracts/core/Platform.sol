// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";

import { ICampaign } from "../interfaces/ICampaign.sol"; //интерфейс кампании
import {IFactoryCore} from "../interfaces/IFactoryCore.sol"; //интерфейс фабрики
import { IPlatformCommon } from "../interfaces/IPlatformCommon.sol"; //события и ошибки

import { Timelock } from "../features/Timelock.sol"; //функционал проверки таймлоков;
import { FeeLogic } from "../features/FeeLogic.sol"; //функционал установки комиссий
import { TokenAllowList} from "../features/TokenAllowList.sol"; //функционал поддержки токенов
import { DepositLogic} from "../features/DepositLogic.sol"; //функционал залогов

import {PlatformStorageLib} from "./storage/PlatformStorageLib.sol"; //хранилище данных

using PlatformStorageLib for PlatformStorageLib.Layout;

/**
 * @title Главный контракт краудфандинговой платформы  
 * @notice обеспечивает функционирование самой платформы
 */
contract Platform is 
    Initializable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable,    
    IPlatformCommon,
    Timelock,
    TokenAllowList,
    DepositLogic {                
    
    //роли
    /// @notice роль, позволяющая обновить контракт
    bytes32 public constant UPGRADER_ROLE = keccak256(bytes("UPGRADER"));   
    
    /// @notice роль, позволяющая устанавливать параметры платформы
    bytes32 public constant CONFIGURATOR_ROLE = keccak256("CONFIGURATOR");
    
    /// @notice роль, позволяющая забирать с контракта средства
    bytes32 public constant TREASURE_ROLE = keccak256("TREASURE");

    /// @notice флаг для nonReentrancy
    bool private _inWithdrawal;

    /// @notice модификатор для функций вывода
    modifier NonReentrancy() {
        require(!_inWithdrawal, FundVerseReentrancyDetected());
        _inWithdrawal = true;
        _;
        _inWithdrawal = false;        
    }
    

    /// @notice инициализатор - вместо конструктора
    function initialize(address _factory) public initializer {       
        
        address owner = msg.sender;
        __AccessControl_init();
        __UUPSUpgradeable_init();

        //устанавливаем роли
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(UPGRADER_ROLE, owner);
        _grantRole(CONFIGURATOR_ROLE, owner);
        _grantRole(TREASURE_ROLE, owner);
        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.factory = _factory;
        //устанавливаем стандартную продолжительность таймлока        
        s.delay = 60 * 60 * 24 * 2; //двое суток
        //устанавливаем минимальную продолжительность для кампаний
        s.minLifespan = 60 * 60 * 24;        
    }

    /// @notice функция создает новую кампанию
    /// @param _goal целевая сумма сбора
    /// @param _deadline срок действия кампании
    /// @param _campaignMeta данные кампании (имя, описание, ссылка на документы)    
    /// @param _token валюта сбора (address(0) для нативной валюты)        
    function createCompaign(
            uint128 _goal,
            uint32 _deadline,
            string calldata _campaignMeta,            
            address _token
        ) external payable {            
            require(_goal > 0, FundVerseErrorZeroGoal()); //проверяем, что цель не нулевая
            require(isAllowedToken(_token), FundVerseUnsupportedToken(_token)); //проверяем, что валюта кампании поддерживается
                        
            PlatformStorageLib.Layout storage s = PlatformStorageLib.layout(); //ссылка на хранилище            

            //проверяем, что залог перечислен
            uint256 deposit = msg.value;
            require(deposit >= s.requiredDeposit, FundVerseInsufficientDeposit(deposit, s.requiredDeposit));
            
            require(_deadline > (s.minLifespan + block.timestamp)
                , FundVerseErrorDeadlineLessMinimun()); //проверяем, что дедлайн не слишком маленький
            
            address founder = msg.sender;
            require(!_isLocked(founder), FundVerseErrorTimeLocked(s.timelocks[founder]));            
            
            uint128 _platformFee = 0; //TODO - функция из FeeLogic            
            ICampaign newCampaign = IFactoryCore(s.factory).createCampaign(
                founder, 
                s.totalCounter, 
                _goal, 
                _deadline, 
                _campaignMeta, 
                _platformFee, 
                _token
                );    
            //проверим на всякий случай, что то-то вернулось
            require(address(newCampaign).code.length != 0, FundVerseCreateFailed());

            if(deposit > 0) { //если вдруг у нас платформа не требует залога, не будем нули регистрировать
                _lockDeposit(founder, deposit, newCampaign); //регистрируем залог
            }          

            _registerCampaign(founder, newCampaign); //записываем данные в хранилище
            _setLockTime(founder); //устанавливаем новый таймлок
            
            emit FundVerseCampaignCreated(newCampaign, founder, _token, _goal);       

    }

    //геттеры
    /// @notice Получить общее количество всех кампаний на платформе
    function getTotalCampaigns() external view returns (uint32) {
        return PlatformStorageLib.layout().totalCounter;
    }

    /// @notice Получить кампанию по глобальному индексу
    function getCampaignByIndex(uint32 index) external view returns (address) {
        return address(PlatformStorageLib.layout().campaignIndex[index]);
    }

    /// @notice Получить количество кампаний, созданных конкретным фаундером
    function getCampaignsCountByFounder(address founder) external view returns (uint32) {
        return PlatformStorageLib.layout().campaignsCountByFounder[founder];
    }

    /// @notice Получить кампанию фаундера по его локальному индексу
    function getCampaignOfFounderByIndex(address founder, uint32 index) external view returns (address) {
        return address(PlatformStorageLib.layout().campaignsByFounder[founder][index]);
    }

    //служебные функции
    /// @notice Регистрируем кампанию в хранилище
    function _registerCampaign(address founder, ICampaign newCampaign) internal {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();

        uint32 index = s.totalCounter;
        s.totalCounter++;

        s.campaignIndex[index] = newCampaign;
        s.campaignsByFounder[founder][s.campaignsCountByFounder[founder]++] = newCampaign;
    }

    //функции настройки параметров платформы
    
    /// @notice функция по установке срока таймлоков
    /// @notice позволяет устанавливать длительность лока взамен установленного ранее
    /// @notice действует глобально для всех пользователей, создающих кампании после установки нового значения    
    function setDelay(uint32 newDelay) external onlyRole(CONFIGURATOR_ROLE) {
        _setDelay(newDelay);
    }
    
    /// @notice функция по установке суммы залога    
    /// @notice действует глобально для всех пользователей, создающих кампании после установки нового значения
    /// @notice depositAmount новое значение суммы залога    
    function setRequiredDeposit(uint256 depositAmount) external onlyRole(CONFIGURATOR_ROLE) {
        _setRequiredDeposit(depositAmount);
    }

    /// @notice функция по установке минимального срока действия кампаний
    /// @notice позволяет устанавливать минимальный срок действия кампаний взамен установленного ранее
    /// @notice действует глобально для всех кампаний, создаваемых после установки нового значения    
    function setMinLifespan(uint32 _lifespan) external onlyRole(CONFIGURATOR_ROLE) {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.minLifespan = _lifespan;
        emit FundVersePlatformParameterUpdated("minLifespan", _lifespan, msg.sender);
    }    

    /// @notice функция добавляет токен в список поддерживаемых платформой
    /// @dev нативную валюту добавить нельзя
    /// @param token адрес добавляемого токена    
    function addTokenToAllowed (address token) external onlyRole(CONFIGURATOR_ROLE) {
        _addTokenToAllowed(token);        
    }

    /// @notice функция убирает токен из поддерживаемых платформой    
    /// @dev нативную валюту убрать нельзя
    /// @param token адрес убираемого токена    
    function removeTokenFromAllowed (address token) external onlyRole(CONFIGURATOR_ROLE) {
        _removeTokenFromAllowed(token);        
    }

    //функции вывода средств
    /// @notice функция позволяет вывести средства в нативной валюте
    /// @param amount сумма вывода
    /// @param recipient адрес вывода
    function withdrawIncomes(address payable recipient, uint256 amount) 
        external onlyRole(TREASURE_ROLE) NonReentrancy {
        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        //можем выводить весь баланс за минусом залогов фаундеров
        uint256 availableValue = address(this).balance - s.totalDeposit;
        
        //рассчитываем доступные средства
        require(amount <= availableValue,  FundVerseInsufficientFunds(amount, availableValue, address(0)));

        (bool success, ) = recipient.call{value: amount}("");
        require(success, FundVerseTransferFailed(recipient, amount, address(0)));
        
        emit FundVerseWithdrawn(amount, recipient, address(0));
    }   
    /// @notice функция позволяет вывести средства в токенах
    /// @param amount сумма вывода
    /// @param recipient адрес вывода
    /// @param token валюта вывода 
    function withdrawIncomes(address payable recipient, uint256 amount, address token) 
        external onlyRole(TREASURE_ROLE) NonReentrancy {        
        
        // смотрим доступные средства
        uint256 availableValue = IERC20(token).balanceOf(address(this));
        require(amount <= availableValue,  FundVerseInsufficientFunds(amount, availableValue, token));

        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount)
        );
        bool result = success && (returndata.length == 0 || abi.decode(returndata, (bool)));
        require(result, FundVerseTransferFailed(recipient, amount, token));
        
        emit FundVerseWithdrawn(amount, recipient, token);
    }                   

    /// @notice пустой receive — для автоматического приёма комиссий и любых входящих переводов
    receive() external payable {}


    /// @notice функция аварийного получения зависших средств из кампании
    /// @dev используется только в случае сбоев/кривых токенов, когда комиссия или средства не пришли
    /// @param campaign адрес кампании, из которой нужно вытащить зависшие средства    
    function claimCampaignPending(address campaign) external onlyRole(TREASURE_ROLE) {
        ICampaign(campaign).claimPendingFunds();
        emit FundVerseCampaignPendingClaimed(campaign);
    }
    

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE){}
}
