// contracts/mocks/TestToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice токен для теста функциональности контракта-кампании
 */

contract TestTokenERC20 is ERC20 {
    
    //переключатель для возможности перевода transfer
    bool public transferSwitch = true; //так переводы принимаются
    
    constructor() ERC20("TestTokenERC20", "TT") {
        _mint(msg.sender, 1_000_000 ether); 
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    //переключатель
    function switchTransfer(bool state) external{
        transferSwitch = state;
    }
    
    ///@notice "испорченная" перегрузка - чтобы можно было симулировать неуспешные переводы
    function transfer(address to, uint256 value) public virtual override returns (bool) {
        if(!transferSwitch) {
            revert("Transfer disabled");
        }
        return super.transfer(to, value);
    }

    
}
