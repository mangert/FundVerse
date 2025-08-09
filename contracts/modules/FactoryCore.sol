// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICampaign} from "../interfaces/ICampaign.sol";
import  {CampaignNative} from "./campaigns/CampaignNative.sol";
import {CampaignToken} from "./campaigns/CampaignToken.sol";
import {IFactoryCore} from "../interfaces/IFactoryCore.sol";

/// @title Модуль создания кампаний 
/// @notice содержит функционал создания кампаний
contract FactoryCore is IFactoryCore{          
   
    /// @notice внутренняя функция создания кампании 
    /// @param _goal целевая сумма сбора
    /// @param _deadline срок действия кампании
    /// @param _campaignMeta данные кампании (имя, описание, ссылка на документы)
    /// @param _platformFee размер комиссии в промилле
    /// @param _token валюта сбора (address(0) для нативной валюты)    
    function createCampaign(        
        address _founder,
        uint32 _index,
        uint128 _goal, 
        uint32 _deadline, 
        string calldata _campaignMeta, 
        uint128 _platformFee, 
        address _token 
        ) external returns(ICampaign) { 
        
        address platform = msg.sender;        
        
        ICampaign newCampaign;
        
        if(_token == address(0)) { //если задан нулевой адрес, будем делать кампанию в нативной валюте
            newCampaign = new CampaignNative(
                platform,       
                _founder,
                _index,
                _goal,
                _deadline,
                _campaignMeta,
                _platformFee                 
            ); 
        }
        else { //если переменная токен содержит ненулевой адрес, выбираем вариант кампании в токенах
            newCampaign = new CampaignToken(
                platform,       
                _founder,
                _index,
                _goal,
                _deadline,
                _campaignMeta,
                _platformFee, 
                _token
            );         
        }              
        return newCampaign;
    }    
    
}
