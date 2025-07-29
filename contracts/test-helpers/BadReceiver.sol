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
        
        (bool success, ) = campaign.call(abi.encodeCall(ICampaign.claimPendingFunds, ()));
        require(success, "Withdraw error");        
    }
    /*
    /**
     * @notice функция для вывода дохода владельцем
     * @param auction - адрес контракта
     * @param amount - сумма вывода
     
    function callWithdrawIncome(address auction, uint64 amount) external payable {
        
        (bool success, ) = auction.call(abi.encodeCall(Auction.withdrawIncomes, (amount)));
        require(success, "Withdraw error");        
    }
    */
    
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

    /*

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
