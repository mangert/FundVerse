// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControlUpgradeable } from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import { ICampaign } from "./interfaces/ICampaign.sol"; //интерфейс кампании
import { FactoryCore } from "./abstract/FactoryCore.sol"; //модуль создания кампаний
import { Timelock } from "./abstract/Timelock.sol"; //модуль проверки таймлоков;
import { FeeLogic } from "./abstract/FeeLogic.sol";

import {PlatformStorageLib} from "./libs/PlatformStorageLib.sol"; //хранилище данных

using PlatformStorageLib for PlatformStorageLib.Layout;

/**
 * @title Главный контракт краудфандинговой платформы  
 * @notice обеспечивает функционирование самой платформы
 */
contract Platform is 
    Initializable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable,    
    FactoryCore,
    Timelock {         

    /// @notice ошибка индицирует попытку создания кампании со слишком коротким сроком
    error FundVerseErrorDeadlineLessMinimun();    

    /// @notice ошибка индицирует попытку создания кампании c нулевой целью
    error FundVerseErrorZeroGoal();    
    
    /// @notice роль, позволяющая обновить контракт
    bytes32 public constant UPGRADER_ROLE = keccak256(bytes("UPGRADER"));   
    
    /// @notice роль, позволяющая устанавливать параметры платформы
    bytes32 public constant CONFIGURATOR_ROLE = keccak256("CONFIGURATOR");


    /// @notice инициализатор - вместо конструктора
    function initialize() public initializer {       
        
        address owner = msg.sender;
        __AccessControl_init();
        __UUPSUpgradeable_init();

        //устанвливаем роли
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(UPGRADER_ROLE, owner);
        _grantRole(CONFIGURATOR_ROLE, owner);
        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        //устанавливаем стандартную продолжительность таймлока        
        s.delay = 60 * 60 * 24 * 2; //двое суток
        //устанавливаем минимальный дедлайн для кампаний
        s.minDeadline = 60 * 60 * 24;
        
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
            
            PlatformStorageLib.Layout storage s = PlatformStorageLib.layout(); //ссылка на хранилище
            
            require(_deadline < s.minDeadline, FundVerseErrorDeadlineLessMinimun()); //проверяем, что дедлайн не слишком маленький
            address founder = msg.sender;
            require(!_isLocked(founder), FundVerseErrorTimeLocked(s.timelocks[founder]));

            //TODO - залоги
            uint128 _platformFee = 0; //TODO - функция из FeeLogic
            _createCampaign(_goal, _deadline, _campaignMeta, _platformFee, _token);
            
            _setLockTime(founder); //устанавливаем новый таймлок

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
    function setMinDeadline(uint32 _minDeadline) external onlyRole(CONFIGURATOR_ROLE) {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();
        s.minDeadline = _minDeadline;
    }

    
    

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE){}

}
