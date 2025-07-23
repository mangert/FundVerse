// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;


abstract contract FeeLogic {
    // Платформа получает комиссию в промилле (например, 50 = 5.0%)
    uint128 internal _platformFee;
    address internal _feeRecipient;

    event PlatformFeeChanged(uint256 newFee);
    event FeeRecipientChanged(address newRecipient);

    // Устанавливается при инициализации платформы
    function _initializeFeeLogic(uint128 initialFee, address recipient) internal {
        require(recipient != address(0), "Invalid fee recipient");
        require(initialFee <= 1000, "Fee too high"); // макс 100%
        _platformFee = initialFee;
        _feeRecipient = recipient;
    }

    function platformFee() public view returns (uint256) {
        return _platformFee;
    }

    function feeRecipient() public view returns (address) {
        return _feeRecipient;
    }

    // Можно переопределить в Platform с модификатором onlyRole(ADMIN_ROLE)
    function _setPlatformFee(uint128 newFee) internal {
        require(newFee <= 1000, "Fee too high");
        _platformFee = newFee;
        emit PlatformFeeChanged(newFee);
    }

    function _setFeeRecipient(address newRecipient) internal {
        require(newRecipient != address(0), "Invalid address");
        _feeRecipient = newRecipient;
        emit FeeRecipientChanged(newRecipient);
    }

    // Возвращает кортеж: комиссия, оставшаяся сумма
    function _splitFee(uint256 amount) internal view returns (uint256 fee, uint256 rest) {
        fee = (amount * _platformFee) / 1000;
        rest = amount - fee;
    }
}
