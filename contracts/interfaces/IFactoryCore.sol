// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;



/// @title интерфейс модуля создания кампаний 
/// @notice содержит функционал создания кампаний
interface IFactoryCore {      

    /// @notice функция создания кампании 
    /// @dev вызывается контрактом краудфандинговой платформы
    /// @param _goal целевая сумма сбора
    /// @param _deadline срок действия кампании
    /// @param _campaignMeta данные кампании (имя, описание, ссылка на документы)
    /// @param _platformFee размер комиссии в промилле
    /// @param _token валюта сбора (address(0) для нативной валюты)
    /// @param _campaignStatusDispatcher адрес контракта диспетчера для автоперевода статуса
    /// @return адрес созданного контракта-кампании  
    function createCampaign(
        address _founder,        
        uint32 _index,
        uint128 _goal, 
        uint32 _deadline, 
        string calldata _campaignMeta, 
        uint128 _platformFee, 
        address _token,
        address _campaignStatusDispatcher

        ) external returns(address); 
}