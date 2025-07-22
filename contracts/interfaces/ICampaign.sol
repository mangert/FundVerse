// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
/**
 * @title пока совсем черновик
 * @author 
 * @notice 
 */
interface ICampaign {
    // События
    event ContributionReceived(address indexed contributor, uint256 amount);
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    event CampaignFinalized(bool successful);

    // Основные функции взаимодействия

    /// @notice Внести средства (ETH или ERC20 — зависит от реализации)
    function contribute(uint256 amount) external payable;

    /// @notice Получить текущий собранный баланс
    function getCurrentBalance() external view returns (uint256);

    /// @notice Забрать средства фаундером (если условия выполнены)
    function withdrawFunds() external;

    /// @notice Отметить кампанию как завершенную (вручную или автоматически)
    function finalizeCampaign() external;

    /// @notice Получить краткие данные о кампании
    function getSummary()
        external
        view
        returns (
            address creator,
            address token,       // 0x0 для ETH
            uint256 goal,
            uint256 raised,
            uint256 deadline,
            bool finalized,
            bool successful
        );

    /// @notice Статус кампании
    function isSuccessful() external view returns (bool);   
    
}
