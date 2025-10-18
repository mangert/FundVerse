// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICampaign} from "../interfaces/ICampaign.sol";
import  {CampaignNative} from "./campaigns/CampaignNative.sol";
import {CampaignToken} from "./campaigns/CampaignToken.sol";
import {IFactoryCore} from "../interfaces/IFactoryCore.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";

/// @title Модуль создания кампаний
/// @author mangert
/// @notice содержит функционал создания кампаний
contract FactoryCore is IFactoryCore{          

    // solhint-disable immutable-vars-naming
    /// @notice ссылка на контракт-шаблон кампании в нативной валюте
    address public immutable implementationNative;
    
    /// @notice ссылка на контракт-шаблон кампании в токенах ERC20
    address public immutable implementationToken;
    // solhint-enable immutable-vars-naming 

    /// @notice в конструкторе определяются адреса имплементации контрактов кампаний    
    constructor() {        
        implementationNative = address(new CampaignNative());
        implementationToken = address(new CampaignToken());
    }   
   
    /// @notice внутренняя функция создания кампании 
    /// @param _founder создатель кампании
    /// @param _index глобальный индекс кампании
    /// @param _goal целевая сумма сбора
    /// @param _deadline срок действия кампании
    /// @param _campaignMeta данные кампании (имя, описание, ссылка на документы)
    /// @param _platformFee размер комиссии в промилле
    /// @param _token валюта сбора (address(0) для нативной валюты)
    /// @param _campaignStatusDispatcher адрес контракта диспетчера для автоперевода статуса
    /// @return address адрес созданного контракта-кампании
    function createCampaign(        
        address _founder,
        uint32 _index,
        uint128 _goal, 
        uint32 _deadline, 
        string calldata _campaignMeta, 
        uint128 _platformFee, 
        address _token,
        address _campaignStatusDispatcher
        ) external override returns(address) { 

        address payable newCampaign = payable(Clones.clone(
          (_token == address(0) ?  implementationNative : implementationToken)
        ));
          //инициализируем        
        ICampaign(newCampaign).initialize(
            msg.sender,       
            _founder,
            _index,
            _goal,
            _deadline,
            _campaignMeta,
            _platformFee,
            _token,
            _campaignStatusDispatcher
        );             
        
        return newCampaign;
    }        
}
