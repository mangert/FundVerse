// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title ETHSender
 * @notice хелпер-контракт, который просто перечисляет эфиры от юзера на адрес платформы
 * чтобы можно было тестировать функционал вывода 
 */
contract ETHSender {

    function sendTo(address payable target) external payable {
        (bool ok, ) = target.call{value: msg.value}("");
        require(ok, "transfer failed");
    }
}