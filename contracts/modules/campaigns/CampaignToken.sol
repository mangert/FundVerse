// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ICampaign } from "../../interfaces/ICampaign.sol"; //интерфейс
import { CampaignBase } from "./CampaignBase.sol";
import { IERC20 } from "@openzeppelin/contracts/interfaces/IERC20.sol";


/// @title CampaignToken - контракт кампании (разновидность для токенов по стандарту ERC20) 
/// @author mangert
/// @notice обеспечивает сбор денег на конкретную цель
contract CampaignToken is ICampaign, CampaignBase {        
    
    // Основные функции взаимодействия
    
    /// @notice Делает взнос в кампанию указанным количеством токенов.
    /// @dev Зачисляется только та часть `_amount`, которая не превышает оставшуюся сумму до цели.
    /// Остаток средств (`_amount - accepted`) не списывается с пользователя, 
    /// но логируется событием CampaignRefunded.
    /// Пользователь должен предварительно вызвать `approve` на сумму `_amount`.
    /// @param _amount Объем средств, который пользователь хочет внести в кампанию (в токенах).
    function contribute(uint128 _amount) external override nonReentrant checkState {
        
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
        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, msg.sender, address(this), contribution)
        );
        require(success && (returndata.length == 0 || abi.decode(returndata, (bool))) 
            ,CampaignTokenReceiptFailed(contributor, _amount));
        
        //зачисляем взнос
        donates[contributor] += contribution;
        raised += uint128(contribution);
        
        // solhint-disable-next-line gas-strict-inequalities
        if(raised >= goal) { //если после зачисления достигли цели
            status = Status.Successful; //Актуализируем статус
            // solhint-disable-next-line not-rely-on-time
            emit CampaignStatusChanged(Status.Live, status, block.timestamp);
            unregister();
        }        
        
        //если есть, что возвращать
        if (refund > 0) {                       
            emit CampaignRefunded(contributor, refund, token);
        }

        emit CampaignContribution(contributor, contribution);
    }

   /// @notice Внести средства (неиспользуемая перегрузка)
    function contribute() external payable override {
        revert CampaignIncorrertFunction();        
    }     

    ///@notice затребовать "зависшие" средства    
    function claimPendingFunds() external override nonReentrant {
        address recipient = msg.sender;
        
        uint256 amount = pendingWithdrawals[recipient]; //смотрим, сколько у пользователя "зависло" средств
        require(amount > 0, CampaignZeroWithdraw(recipient)); //проверка, что невыведенные средства больше нуля

        pendingWithdrawals[recipient] = 0; //обнуляем баланс

        emit PendingFundsClaimed(recipient, amount);               
        //solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount)
        );
        require(success && (returndata.length == 0 || abi.decode(returndata, (bool))),
            CampaignPendingWithdrawFailed(recipient, amount, token)
        );
    }    
    
    /// @notice служебная функция перевода средств
    /// @param recipient получатель средств
    /// @param amount переводимая сумма
    /// @return bool результат перевода (прошел или провалился)
    /// @dev используется для рефандов и переводов
    /// @dev не использовать при клейме зависших средств!
    /// @dev Внешний вызов безопасен — состояние не меняется до него.    
    /// Запись в pendingWithdrawals происходит ТОЛЬКО при неудаче отправки.
    /// Вызов обернут в external функцию с модификатором nonReentrant.      
    function _transferTo(address recipient, uint256 amount) internal override returns (bool) {               
        // solhint-disable avoid-low-level-calls
        (bool success, bytes memory returndata) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, recipient, amount)
        );
        bool result = success && (returndata.length == 0 || abi.decode(returndata, (bool)));
        if (!result) {
            pendingWithdrawals[recipient] += amount;
            emit CampaignTransferFailed(msg.sender, amount, token);
        }
        // solhint-enable avoid-low-level-calls
        return result;
    }     

}