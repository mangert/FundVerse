// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;


/// @title ETHSender - только для тестов!!!
/// @author mangert
/// @notice хелпер-контракт, который просто перечисляет эфиры от юзера на адрес платформы
/// чтобы можно было тестировать функционал вывода 
contract ETHSender {
    //solhint-disable comprehensive-interface
    //solhint-disable gas-custom-errors
        
    /// @notice функция принимает эфир и весь передает по адресу
    /// @param target адрес, куда будут перечисляться эфиры (в тестах - адрес платформы)
    function sendTo(address payable target) external payable {
        (bool ok, ) = target.call{value: msg.value}("");
        require(ok, "transfer failed");
    }
}