// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ICampaign} from "./ICampaign.sol";

/// @title интерфейс IPlatformCommon - события и ошибки платформы
/// @notice содержит объявления событий и ошибок, кидаемых платформой
interface IPlatformCommon {    

    //события
    /// @notice событие порождается при изменении настроек платформы
    /// @param parameter изменяемый параметр    
    /// @param newValue новое значение
    /// @param updatedBy адрес, изменивший параметр
    event FVPlatformParameterUpdated(
        bytes32 indexed parameter,          
        uint256 newValue,
        address indexed updatedBy
    );
    /// @notice событие порождается при изменении настроек платформы - перегрузка для адресов
    event FVPlatformParameterUpdated(
        bytes32 indexed parameter,          
        address newValue,
        address indexed updatedBy
    );

    /// @notice событие порождается при создании новой кампании
    /// @param NewCampaignAddress адрес контратка созданной кампании
    /// @param founder адрес фаундера
    /// @param token адрес токена валюты кампании (для ETH - address(0))
    /// @param goal целевая сумма сбора     
    event FVCampaignCreated(
        ICampaign indexed NewCampaignAddress
        , address indexed founder
        , address indexed token
        , uint256 goal
        );     
    
    /// @notice событие порождается при добавлении нового токена в список поддерживаемых    
    /// @param token адрес нового токена валюты кампании
    event FVNewTokenAdded(address token);

    /// @notice событие порождается при удалении токена из списока поддерживаемых    
    /// @param token адрес удаляемого токена валюты кампании
    event FVTokenRemoved(address token);

    /// @notice событие индицирует установку фаундеру нового таймлока
    /// @param founder адрес фаундера
    /// @param timelock время истечения таймлока
    event FVSetFounderTimelock(address founder, uint32 timelock);    

    /// @notice событие блокировки залога
    /// @param founder адрес фаундера
    /// @param amount сумма залога
    /// @param campaign адрес кампании, обеспечиваемой залогом
    event FVDepositLocked(address indexed founder, uint256 amount, address indexed campaign);

    /// @notice событие возврата залога    
    /// @param founder адрес фаундера
    /// @param amount сумма залога
    /// @param campaign адрес кампании, обеспечиваемой залогом
    event FVDepositReturned(address indexed founder, uint256 amount, address indexed campaign);    

    /// @notice событие при выводе средств с контракта
    /// @param amount сумма вывода
    /// @param recipient адрес вывода
    /// @param token валюта вывода (для нативной валюты address(0))
    event FVWithdrawn(uint256 amount, address indexed recipient, address indexed token);

    /// @notice событие для фиксации того, что платформа вытянула зависшие средства из кампании
    /// @param campaign адрес кампании, из которой тянули средства
    event FVCampaignPendingClaimed(address indexed campaign);
    
    //ошибки
    /// @notice ошибка индицирует неуспешную попытку исходящего перевода средств
    /// @param recipient получатель платежа
    /// @param amount сумма платежа
    /// @param token валюта платежа (для нативной валюты - address(0))
    error FVTransferFailed(address recipient, uint256 amount, address token);    
    
    /// @notice ошибка индицирует попытку создания кампании со слишком коротким сроком
    error FVErrorDeadlineLessMinimun();    

    /// @notice ошибка индицирует провал операции создания кампании
    error FVCreateFailed();

    /// @notice ошибка индицирует попытку создания кампании c нулевой целью
    error FVErrorZeroGoal();
    
    /// @notice ошибка индицирует попытку создания кампании в неподдерживаемой валюте
    /// @param token переданный адрес неподдерживаемого токена
    error FVUnsupportedToken(address token);

    /// @notice ошибка показывает, что добавление токена не произошло, потому что такой уже есть
    /// @param token адрес токена, который пытались добавить    
    error FVAddingTokenAlreadySupported(address token);

    /// @notice ошибка показывает, что удаление токена не произошло, потому что и так не поддерживается
    /// @param token адрес токена, который пытались удалить    
    error FVRemovingTokenNotSupported(address token);

    
    /// @notice ошибка при недостаточном залоге    
    /// @param sent направленная сумма залога
    /// @param required требуемая сумма залога
    error FVInsufficientDeposit(uint256 sent, uint256 required);

    /// @notice ошибка индицирует попытку создания кампании до истечения таймлока
    /// @param timelock время истечения таймлока
    error FVErrorTimeLocked(uint256 timelock);

    /// @notice ошибка при попытке вернуть чужой залог
    error FVNotCampaignFounder();

    /// @notice ошибка при попытке вернуть залог раньше времени
    error FVDepositNotYetReturnable();

    /// @notice ошибка возникает при недостатке баланса для вывода         
    /// @param amount сумма вывода
    /// @param available сумма располагаемая  
    /// @param token валюта вывода (для нативной валюты address(0))
    error FVInsufficientFunds(uint256 amount, uint256 available, address token);

    /// @notice ошибка возникает при планируемой сумме вывода равной нулю (если нечего выводить или такой вывод запрошен)
    error FVZeroWithdrawnAmount();

    /// @notice ошибка возникает при попытке рекурсивного вызова функции вывода средств
    error FVReentrancyDetected();

    /// @notice ошибка возникает при вызове функций кампании у контракта, который не был создан платформой
    /// @param campaign адрес контракта, к которому обращаемся
    error FundVersNotRegisteredCampaign(address campaign);

    /// @notice ошибка возникает при привязать контракт лояльности, который не знает про нашу платформу
    /// @param loyaltyProgram адрес привязываемого контракта программы лояльности
    error FVUnacceptableLoyaltyProgram(address loyaltyProgram);
}
