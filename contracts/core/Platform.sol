// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { ICampaign } from "../interfaces/ICampaign.sol"; //интерфейс кампании
import {IFactoryCore} from "../interfaces/IFactoryCore.sol"; //интерфейс фабрики

import { FactoryCore } from "../modules/FactoryCore.sol"; //модуль создания кампаний

import { Timelock } from "../features/Timelock.sol"; //функционал проверки таймлоков;
import { FeeLogic } from "../features/FeeLogic.sol"; //функционал установки комиссий
import { TokenAllowList } from "../features/TokenAllowList.sol"; //функционал поддержки токенов

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
    Timelock,
    TokenAllowList {         

    /// @notice ошибка индицирует попытку создания кампании со слишком коротким сроком
    error FundVerseErrorDeadlineLessMinimun();    

    /// @notice ошибка индицирует провал операции создания кампании
    error FundVerseCreateFailed();

    /// @notice ошибка индицирует попытку создания кампании c нулевой целью
    error FundVerseErrorZeroGoal();
    
    /// @notice ошибка индицирует попытку создания кампании в неподдерживаемой валюте
    /// @param token переданный адрес неподдерживаемого токена
    error FundVerseUnSupportedToken(address token);

    /// @notice событие порождается при создании новой кампании
    /// @param NewCampaignAddress адрес контратка созданной кампании
    /// @param founder адрес фаундера
    /// @param token адрес токена валюты кампании (для ETH - address(0))
    /// @param goal целевая сумма сбора     
    event FundVerseCampaignCreated(
        ICampaign indexed NewCampaignAddress
        , address indexed founder
        , address indexed token
        , uint256 goal
        );     
    
    /// @notice событие порождается при добавлении нового токена в список поддерживаемых    
    /// @param token адрес нового токена валюты кампании (для ETH - address(0))    
    event FundVerseNewTokenAdded(address token);

    
    //роли

    /// @notice роль, позволяющая обновить контракт
    bytes32 public constant UPGRADER_ROLE = keccak256(bytes("UPGRADER"));   
    
    /// @notice роль, позволяющая устанавливать параметры платформы
    bytes32 public constant CONFIGURATOR_ROLE = keccak256("CONFIGURATOR");


    /// @notice инициализатор - вместо конструктора
    function initialize(address _factory) public initializer {       
        
        address owner = msg.sender;
        __AccessControl_init();
        __UUPSUpgradeable_init();

        //устанвливаем роли
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(UPGRADER_ROLE, owner);
        _grantRole(CONFIGURATOR_ROLE, owner);
        
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
        ) external {            
            require(_goal > 0, FundVerseErrorZeroGoal()); //проверяем, что цель не нулевая
            require(isAllowedToken(_token), FundVerseUnSupportedToken(_token));
            
            PlatformStorageLib.Layout storage s = PlatformStorageLib.layout(); //ссылка на хранилище            
            
            require(_deadline > (s.minLifespan + block.timestamp)
                , FundVerseErrorDeadlineLessMinimun()); //проверяем, что дедлайн не слишком маленький
            
            address founder = msg.sender;
            require(!_isLocked(founder), FundVerseErrorTimeLocked(s.timelocks[founder]));

            //TODO - залоги
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
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.delay = newDelay;
    }

    /// @notice функция по установке минимального срока действия кампаний
    /// @notice позволяет устанавливать минимальный срок действия кампаний взамен установленного ранее
    /// @notice действует глобально для всех кампаний, создаваемых после установки нового значения    
    function setMinDeadline(uint32 _lifespan) external onlyRole(CONFIGURATOR_ROLE) {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.minLifespan = _lifespan;
    }    

    function addTokenToAllowed (address token, bytes6 ticker) external onlyRole(CONFIGURATOR_ROLE) {

        _addTokenToAllowed(token, ticker);
        emit FundVerseNewTokenAdded(token);
    }
    

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE){}

}
