// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ICampaign } from "../interfaces/ICampaign.sol";

/// @title BadReceiver
/// @author mangert
/// @notice примитивный контракт, который отклоняет поступления средств - для проведения тестов 
/// на "неуспешные" перечисления средств
contract BadReceiver {
    
    //solhint-disable comprehensive-interface
    //solhint-disable gas-custom-errors
    //solhint-disable avoid-low-level-calls

    /// @notice флаг, определяющий поведение контракта - отклонять или принимать средства
    bool internal shouldNotRevert;

    /// @notice отклоняем все поступления, если флаг false
    receive() external payable {
        if(!shouldNotRevert) {
            revert("Reject all ETH");
        }        
    }

    /// @notice функция для пополнения контракта
    function getTransfer() external payable {} // solhint-disable-line no-empty-blocks
    
    /// @notice функция для вывода зависшей сдачи с контракта-аукциона
    /// @param campaign - адрес контракта
    function callClaimPendingFunds(address campaign) external payable {
        
        (bool success, bytes memory returndata) = campaign.call(abi.encodeCall(ICampaign.claimPendingFunds, ()));
            
        if (!success) {
        // Проброс оригинальной ошибки с сохранением типа (включая custom errors!)
        // solhint-disable-next-line no-inline-assembly
            assembly {
                revert(add(returndata, 32), mload(returndata))
            }
        }
    }   
    
    /// @notice функция для вывода дохода фаундером
    /// @param  campaign адрес контракта     
    function callWithdrawFunds(address campaign) external payable {
        
        (bool success, ) = campaign.call(abi.encodeCall(ICampaign.withdrawFunds, ()));
        require(success, "Withdraw error");        
    }    
    
    /// @notice функция для вызова функции отправки взноса
    /// @param campaign - адрес кампании
    /// @param amount - сумма взноса    
    function callContribute(address campaign, uint256 amount) external {

        (bool success, ) = campaign.call{ value: amount }(
            abi.encodeWithSignature("contribute()")
            );
        require(success, "Donation Error");
    }      

    
    /// @notice функция для вызова функции клейма взноса
    /// @param campaign - адрес кампании         
    function callClaimContribution(address campaign) external {

        (bool success, ) = campaign.call(
            abi.encodeWithSignature("claimContribution()")
            );
        require(success, "claimContribution Error");
    }      

    /// @notice получить баланс нашего bad-receiver
    /// @return uint256 баланс
    function  getBalance() external view returns(uint256) { //возвращаем баланс
        return address(this).balance;
    }
    
    /// @notice функция установки возможности получения контрактом средств
    /// @param state - устанавливаемое значение флага    
    function setRevertFlag(bool state) public {
        shouldNotRevert = state;
    }
}
