// contracts/mocks/TestToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestTokenERC20   
/// @author mangert
/// @notice хелпер - токен для теста функциональности контракта-кампании 
contract TestTokenERC20 is ERC20 {
    //solhint-disable gas-custom-errors
    
    /// @notice переключатель для возможности перевода transfer    
    bool public transferSwitch = true; //так переводы принимаются
    
    /// @notice делаем сразу минт на деплоера
    constructor() ERC20("TestTokenERC20", "TT") {
        _mint(msg.sender, 1_000_000 ether); 
    }

    /// @notice стандартный минт
    /// @param to получатель
    /// @param amount сумма    
    function mint(address to, uint256 amount) external { //solhint-disable-line comprehensive-interface
        _mint(to, amount);
    }

    /// @notice функция устанавилвает переключатель
    /// @param state состояние принимаем / откатываем переводы
    function switchTransfer(bool state) external{ //solhint-disable-line comprehensive-interface
        transferSwitch = state;
    }
    
    /// @notice "испорченная" перегрузка - чтобы можно было симулировать неуспешные переводы
    /// @param to получатель
    /// @param value сумма
    /// @return bool результат трансфера
    function transfer(address to, uint256 value) public virtual override returns (bool) {
        if(!transferSwitch) {
            revert("Transfer disabled");
        }
        return super.transfer(to, value);
    }    
}
