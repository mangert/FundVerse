// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./abstract/FeeLogic.sol";
import "./interfaces/ICampaign.sol";

/**
 * @title Главный контракт краудфандинговой платформы  
 * @notice обеспечивает функционирование самой платформы
 */
contract Platform is 
    Initializable, 
    AccessControlUpgradeable, 
    UUPSUpgradeable,     
    FeeLogic {    

    bytes32 public constant UPGRADER_ROLE = keccak256(bytes("UPGRADER")); //по-идее, уже должна быть определена где-то

    function initialize(address defaultAdmin, address upgrader) public initializer {       
        
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(UPGRADER_ROLE, upgrader);        
    }

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

}
