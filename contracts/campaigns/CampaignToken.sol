// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";
import "./CampaignBase.sol";

/**
 * @title пока совсем черновик - будет контракт кампании в токене ERC20
 * @author 
 * @notice 
 */
contract CampaignToken is ICampaign, CampaignBase {
    // Основные функции взаимодействия

    /// @notice Внести средства (ETH или ERC20 — зависит от реализации)
    function contribute(uint128 amount) external {}

    function contribute() external payable {
        revert CampaingIncorrertFunction();
    }

    /// @notice Забрать средства фаундером (если условия выполнены)
    function withdrawFunds() external {}

    function claimContribution() external override {}

    function claimPendingFunds() external override {}
}