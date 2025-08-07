// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICampaign} from "../interfaces/ICampaign.sol";
import  {CampaignNative} from "../campaigns/CampaignNative.sol";
import {CampaignToken} from "../campaigns/CampaignToken.sol";
import {PlatformStorageLib} from "../libs/PlatformStorageLib.sol";

using PlatformStorageLib for PlatformStorageLib.Layout;

/// @title Модуль создания кампаний 
/// @notice содержит функционал создания кампаний
abstract contract FactoryCore {      
    
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
    
    /// @notice внутренняя функция создания кампании 
    /// @param _goal целевая сумма сбора
    /// @param _deadline срок действия кампании
    /// @param _campaignMeta данные кампании (имя, описание, ссылка на документы)
    /// @param _platformFee размер комиссии в промилле
    /// @param _token валюта сбора (address(0) для нативной валюты)    
    function _createCampaign(        
        uint128 _goal, 
        uint32 _deadline, 
        string calldata _campaignMeta, 
        uint128 _platformFee, 
        address _token 
        ) internal returns(ICampaign) { 
        //ссылка на хранилище    
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();

        address founder = msg.sender;
        uint32 index = s.totalCounter;
        ICampaign newCampaign;
        
        if(_token == address(0)) { //если задан нулевой адрес, будем делать кампанию в нативной валюте
            newCampaign = new CampaignNative(
                address(this),       
                founder,
                index,
                _goal,
                _deadline,
                _campaignMeta,
                _platformFee                 
            ); 
        }
        else { //если переменная токен содержит ненулевой адрес, выбираем вариант кампании в токенах
            newCampaign = new CampaignToken(
                address(this),       
                founder,
                index,
                _goal,
                _deadline,
                _campaignMeta,
                _platformFee, 
                _token
            ); 
        }
        
        s.totalCounter++; //увеличиваем счетчик
        //записываем данные в хранилище
        s.campaignIndex[index] = newCampaign;
        s.campaignsByFounder[founder][s.campaignsCountByFounder[founder]++] = newCampaign;        

        emit FundVerseCampaignCreated(
            newCampaign,
            founder,
            _token,
            _goal
        );
        return newCampaign;
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

}
