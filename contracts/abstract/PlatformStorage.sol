// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";

/**
 * @title Абстрактный контракт PlatformStorage
 * @notice хранилищце данных для главного контракта платформы
 */
abstract contract PlatformStorage is ICampaign{
   
    //подумать, храним ли счетчик. Или сделать мэппинг по владельцам? Подумать
    mapping(uint32 id => ICampaign) Campaigns; //паблик? Или приватный?
    uint32 counter;
}
