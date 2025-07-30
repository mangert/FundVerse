// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../campaigns/CampaignNative.sol";
import "../interfaces/ICampaign.sol";

/**
 * @title BadReceiver  
 * @notice примитивный контракт, который отклоняет поступления средств - для проведения тестов 
 * на "неуспешные" перечисления средств
 */
contract BadReceiver {

    bool shouldNotRevert; //флаг, определяющий поведение контракта - отклонять или принимать средства

    function getTransfer() external payable{} //функция для пополнения контракта

    function  getBalance() external view returns(uint256) { //возвращаем баланс
        return address(this).balance;
    }    
    
    /**
     * @notice функция для вывода зависшей сдачи с контракта-аукциона
     * @param campaign - адрес контракта
    */
    function callClaimPendingFunds(address campaign) external payable {
        
        (bool success, bytes memory returndata) = campaign.call(abi.encodeCall(ICampaign.claimPendingFunds, ()));
        //require(success, "Withdraw error");        
        if (!success) {
        // Проброс оригинальной ошибки с сохранением типа (включая custom errors!)
            assembly {
                revert(add(returndata, 32), mload(returndata))
            }
        }
    }
    
    /**
    * @notice функция для вывода дохода фаундером
    * @param  campaign адрес контракта 
    */ 
    function callWithdrawFunds(address campaign) external payable {
        
        (bool success, ) = campaign.call(abi.encodeCall(ICampaign.withdrawFunds, ()));
        require(success, "Withdraw error");        
    }    
    
    /**
     * @notice функция для вызова функции отправки взноса
     * @param campaign - адрес кампании
     * @param amount - сумма взноса
    */    
    function callContribute(address campaign, uint256 amount) external {

        (bool success, ) = campaign.call{ value: amount }(
            abi.encodeWithSignature("contribute()")
            );
        require(success, "Donation Error");
    }      

    /**
     * @notice функция для вызова функции клейма взноса
     * @param campaign - адрес кампании     
    */    
    function callClaimContribution(address campaign) external {

        (bool success, ) = campaign.call(
            abi.encodeWithSignature("claimContribution()")
            );
        require(success, "claimContribution Error");
    }      

    /**
     * @notice функция установки возможности получения контрактом средств
     * @param state - устанавливаемое значение флага
     */
    function setRevertFlag(bool state) public {
        shouldNotRevert = state;
    }
    
    receive() external payable { //отклоняем все поступления, если флаг false
        if(!shouldNotRevert) {
            revert("Reject all ETH");
        }        
    }
}
