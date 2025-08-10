// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { PlatformStorageLib } from "../core/storage/PlatformStorageLib.sol";
import { IPlatformCommon } from "../interfaces/IPlatformCommon.sol";
import { ICampaign } from "../interfaces/ICampaign.sol";

using PlatformStorageLib for PlatformStorageLib.Layout;

abstract contract DepositLogic is IPlatformCommon {
    
    /// @notice регистрирует залог
    /// @dev следует вызывать после деплоя новой кампании
    /// @dev функция не проверяет достаточность залога, только регистрирует факт поступления
    /// @param founder адрес фаундера    
    /// @param amount сумма залога
    /// @param campaign адрес кампании, обеспечиваемой залогом
    function _lockDeposit(address founder, uint256 amount, ICampaign campaign) internal {        
        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();        
        // сохраняем залог
        s.totalDeposit += amount;
        s.depositsByCompaigns[address(campaign)] = amount;

        emit FundVerseDepositLocked(founder, amount, address(campaign));
    }

    /// @notice возвращает залог фаундеру
    /// @dev может вызываться только фаундером    
    /// @param campaign адрес кампании
    function returnDeposit(ICampaign campaign) external {
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();

        address founder = msg.sender;
        require((campaign.creator()) == founder, FundVerseNotCampaignFounder());
        // проверяем, что этот залог можно вернуть
        require(_isCampaignFinished(campaign), FundVerseDepositNotYetReturnable());                   

        uint256 amount = s.depositsByCompaigns[address(campaign)];
        require(amount > 0, FundVerseZeroWithdrawnAmount());

        // обнуляем, чтобы не вернуть дважды
        s.depositsByCompaigns[address(campaign)] = 0;
        s.totalDeposit -= amount;
        
        (bool success, ) = payable(founder).call{value: amount}("");
        require(success, FundVerseTransferFailed(founder, amount, address(0)));

        emit FundVerseDepositReturned(founder, amount, address(campaign));
    }

    /// @notice функция по установке суммы залога    
    /// @notice действует глобально для всех пользователей, создающих кампании после установки нового значения
    /// @notice depositAmount новое значение суммы залога
    /// @dev следует переопределить с установкой роли
    function _setRequiredDeposit(uint256 depositAmount) internal {        
        PlatformStorageLib.Layout storage s = PlatformStorageLib.layout();        
        s.requiredDeposit = depositAmount;
        emit FundVersePlatformParameterUpdated("depositAmount", depositAmount, msg.sender);
    }

    //геттеры
    
    /// @notice Получить информацию о сумме залога, требуемой платформой
    function getRequiredDeposit() external view returns (uint256) {
        return PlatformStorageLib.layout().requiredDeposit;
    }    
    
    // служебные функции
    /// @notice служебная функция - возвращает истину, если кампания тем или иным образом завершена 
    /// @param campaign aдрес кампании
    function _isCampaignFinished(ICampaign campaign) internal view virtual returns (bool) {
        ICampaign.Status status = campaign.status();
        return (
            status == ICampaign.Status.Successful ||
            status == ICampaign.Status.Cancelled ||
            status == ICampaign.Status.Failed
        );
    }

}
