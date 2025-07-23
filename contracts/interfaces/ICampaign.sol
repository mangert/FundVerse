// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title пока совсем черновик
 * @author 
 * @notice 
 */
interface ICampaign {
    
    //типы
    /**
     * @notice перечисление статусов кампаний
     */
    enum Status {
        Live,         // идет сбор
        Stopped,      // временно приостановлена
        Cancelled,    // отменена фаундером (возврат средств)
        Failed,       // не собрала нужное → неуспешна
        Successful    // достигла цели и финализирована
    }
    
    // События
    /**
     * @notice сообщает о поступившем и зачисленном взносе
     * @param contributor вноситель
     * @param amount зачисленная сумма
     */
    event CampaignContribution(address indexed contributor, uint256 amount); 

    /**
     * @notice сообщает об успешном рефанде
     * @dev применяется в функциях рефанда взносов или в функциях взноса при рефанде излишков
     * @param donor адрес вкладчика (он же получатель рефанда)
     * @param amount сумма возврата
     * @param token валюта возврата (address(0) для нативной валюты)
     */
    event CampaignRefunded(address indexed donor, uint256 amount, address token);

    event FundsWithdrawn(address indexed recipient, uint256 amount);


    /**
     * @notice порождается, когда контракт не может перевести пользователю деньги 
     * (при рефанде излишков, вкладов или истребовании средств фаундером)
     * @param recipient адрес получателя
     * @param amount сумма неудавшегося перевода
     * @param token адрес токена, который переводился (для эфира address(0))
     */
    event CampaignTrasferFailed(address indexed recipient, uint256 amount, address token);    

    /**
     * @notice порождается при завершении кампании (успешном либо неуспешном)
     * @param status конечный статус кампании
     * @param timeStamp время финализации
     */
    event CampaignFinalized(Status status, uint256 timeStamp);

    /**
     * @notice индицирует попытку доступа к функциям кампании не владельцем
     * @param account адрес, с которого вызывалась функция
     */
    error CampaingUnauthorizedAccount(address account);

    /**
     * @notice индицирует вызов функции при некорректном статусе кампании
     * @param actual фактический статус
     * @param needed требуемый статус
     */
    error CampaingInvalidStatus(Status actual, Status needed);

    /**
     * @notice индицирует вызов некорректиной перегрузки функции
     * @dev использовать для отказа вызовов недействительных перегрузок в функциях
     */
    error CampaingIncorrertFunction();

    /**
     * @notice индицирует нулевую сумму взноса    
     * @param investor адрес вносителя
     */
    error CampaingZeroDonation(address investor);

    // Основные функции взаимодействия

    /**
     * @notice Внести средства (ERC20)
     * @dev перегрузка для токенов ERC20, в версии для "нативной валюты" всегда завершается ошибкой
     * @param amount вносимая сумма
     */
    function contribute(uint128 amount) external;

    /**
     * @notice Внести средства (ETH)
     * @dev перегрузка для нативной валюты, в версии для токенов ERC20 всегда завершается ошибкой
     */
    function contribute() external payable;

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
