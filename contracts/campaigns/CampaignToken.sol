// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "../interfaces/ICampaign.sol";
import "./CampaignBase.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

/**
 * @title пока совсем черновик - будет контракт кампании в токене ERC20 
 * @notice 
 */
contract CampaignToken is ICampaign, CampaignBase {
        constructor(        
        address  _platformAddress,
        address _creator,
        string memory _campaignName,
        uint32 _id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee,
        address _token
    ) CampaignBase (
        _platformAddress,
        _creator,
        _campaignName,
        _id,
        _goal,
        _deadline,
        _campaignMeta,
        _platformFee,
        _token
    ) {}    

    // Основные функции взаимодействия

    /// @notice Внести средства - неиспользуемая перегрузка
    function contribute(uint128 _amount) external {
        
        address contributor = msg.sender;

        require(_amount > 0, CampaingZeroDonation(contributor)); //проверяем, что не ноль        
        //проверить, кто у нас тут msg.sender
        (bool success, ) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), _amount)
        );
        require(success, "Failed"); //todo - ошибку сделать

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
        
        //зачисляем взнос
        donates[contributor] += contribution;
        raised += uint128(contribution);
        
        if(raised >= goal) { //если после зачисления достигли цели
            status = Status.Successful; //Аетуализируем статус
            emit CampaignStatusChanged(Status.Live, status, block.timestamp); // timestamp manipulation not critical here
        }

        //если есть, что возвращать
        if (refund > 0) {            
           if(_transferTo(payable(contributor), refund)) {
            emit CampaignRefunded(contributor, refund, address(0));
           }
        }

        emit CampaignContribution(contributor, contribution);
    }

   /// @notice Внести средства (ETH - cчитаем в wei)
    function contribute() external payable nonReentrant checkState {
        revert CampaingIncorrertFunction();        
    }     

    ///@notice затребовать "зависшие" средства    
    function claimPendingFunds() external override nonReentrant {
        address recipient = msg.sender;
        
        uint256 amount = pendingWithdrawals[recipient]; //смотрим, сколько у пользователя "зависло" средств
        require(amount > 0, CampaingZeroWithdraw(recipient)); //проверка, что невыведенные средства больше нуля

        pendingWithdrawals[recipient] = 0; //обнуляем баланс

        emit PendingFundsClaimed(recipient, amount);               

        //проверить, кто у нас тут msg.sender
        IERC20(token).approve(address(this), amount);
        (bool success, ) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", address(this), recipient, amount)
        );
        require(success, CampaignPendingWithdrawFailed(recipient, amount, token));
    }
    
    /**
     * @notice служебная функция перевода средств
     * @dev используется для рефандов и переводов
     * @dev не использовать при клейме зависших средств!
     */
    function _transferTo(address recipient, uint256 amount) internal override returns (bool) {       
        
        //проверить, кто у нас тут msg.sender
        IERC20(token).approve(address(this), amount);
        (bool success, ) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", address(this), recipient, amount)
        );        
        if (!success) {
            pendingWithdrawals[recipient] += amount;
            emit CampaignTrasferFailed(msg.sender, amount, address(0));
        }
        return success;
    } 

    receive() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, "");
    }

    fallback() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, msg.data);
    } 

}