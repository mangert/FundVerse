// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../../interfaces/ICampaign.sol"; //интерфейс
import "./CampaignBase.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @title Контракт кампании (разновидность для токенов по стандарту ERC20) 
 * @notice обеспечивает сбор денег на конкретную цель
 */

contract CampaignToken is ICampaign, CampaignBase {
        constructor(        
        address  _platformAddress,
        address _creator,        
        uint32 _id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee,
        address _token
    ) CampaignBase (
        _platformAddress,
        _creator,        
        _id,
        _goal,
        _deadline,
        _campaignMeta,
        _platformFee,
        _token
    ) {}    

    // Основные функции взаимодействия
    
    /// @notice Делает взнос в кампанию указанным количеством токенов.
    /// @dev Зачисляется только та часть `_amount`, которая не превышает оставшуюся сумму до цели.
    ///      Остаток средств (`_amount - accepted`) не списывается с пользователя, но логируется событием CampaignRefunded.
    ///      Пользователь должен предварительно вызвать `approve` на сумму `_amount`.
    /// @param _amount Объем средств, который пользователь хочет внести в кампанию (в токенах).
    function contribute(uint128 _amount) external nonReentrant checkState {
        
        address contributor = msg.sender;

        require(_amount > 0, CampaignZeroDonation(contributor)); //проверяем, что не ноль
        
        uint128 accepted = goal - raised; //проверяем, сколько осталось до цели

        uint256 refund; //переменная для возвратов
        uint256 contribution; //сумма к зачислению       

        //в этом блоке смотрим, сколько из взноса зачислим, а сколько вернем излишков
        if (_amount > accepted) {
            refund = _amount - accepted;
            contribution = accepted;
        } else {
            refund = 0;
            contribution = _amount;
        }

        //получаем токены
        // External call before state changes: safe because transferFrom doesn't invoke reentrant logic
        // and state changes follow after successful receipt.
        // slither-disable-next-line reentrancy-no-eth
        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, msg.sender, address(this), contribution)
        );
        require(success && (returndata.length == 0 || abi.decode(returndata, (bool))) 
            ,CampaignTokenReceiptFailed(contributor, _amount));
        
        //зачисляем взнос
        donates[contributor] += contribution;
        raised += uint128(contribution);
        
        if(raised >= goal) { //если после зачисления достигли цели
            status = Status.Successful; //Актуализируем статус
            emit CampaignStatusChanged(Status.Live, status, block.timestamp); // timestamp manipulation not critical here
        }        
        
        //если есть, что возвращать
        if (refund > 0) {                       
            emit CampaignRefunded(contributor, refund, token);
        }

        emit CampaignContribution(contributor, contribution);
    }

   /// @notice Внести средства (неиспользуемая перегрузка)
    function contribute() external payable {
        revert CampaignIncorrertFunction();        
    }     

    ///@notice затребовать "зависшие" средства    
    function claimPendingFunds() external override nonReentrant {
        address recipient = msg.sender;
        
        uint256 amount = pendingWithdrawals[recipient]; //смотрим, сколько у пользователя "зависло" средств
        require(amount > 0, CampaignZeroWithdraw(recipient)); //проверка, что невыведенные средства больше нуля

        pendingWithdrawals[recipient] = 0; //обнуляем баланс

        emit PendingFundsClaimed(recipient, amount);               

        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount)
        );
        require(success && (returndata.length == 0 || abi.decode(returndata, (bool))),
            CampaignPendingWithdrawFailed(recipient, amount, token)
        );
    }
    
    /**
     * @notice служебная функция перевода средств
     * @dev используется для рефандов и переводов
     * @dev не использовать при клейме зависших средств!
     * @dev Внешний вызов безопасен — состояние не меняется до него.
     * Запись в pendingWithdrawals происходит ТОЛЬКО при неудаче отправки.
     * Вызов обёрнут в external функцию с модификатором nonReentrant. 
     */
    function _transferTo(address recipient, uint256 amount) internal override returns (bool) {               
        
        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount)
        );
        bool result = success && (returndata.length == 0 || abi.decode(returndata, (bool)));
        if (!result) {
            pendingWithdrawals[recipient] += amount;
            emit CampaignTransferFailed(msg.sender, amount, token);
        }
        return result;
    }     

}