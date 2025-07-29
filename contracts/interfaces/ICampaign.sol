// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title интерфейс ICampaign для контрактов-кампаний 
 * @notice содержит описания функций, событий, ошибок и типов контрактов-кампаний
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
     * @notice порождается при изменении статуса
     * @param oldStatus исходный статус кампании      
     * @param newStatus новый статус кампании      
     * @param timeStamp время финализации
     */
    event CampaignStatusChanged(Status oldStatus, Status newStatus, uint256 timeStamp);

    /**
     * @notice порождается, когда инвестор успешно получил с контракта средства
     * @param recipient адрес получателя
     * @param amount полученная сумма
     */
    event CampaignContributionClaimed(address recipient, uint256 amount);

    /**
     * @notice порождается, когда инвестор запросил с контракта средства, но перевод "завис" (перешел в pendingWithdraw)
     * @param recipient адрес получателя
     * @param amount запросшенная сумма
     */
    event CampaignContributionDeffered(address recipient, uint256 amount);

    /**
     * @notice порождается, когда фаундер успешно получил с контракта средства
     * @param recipient адрес получателя
     * @param amount полученная сумма
     */
    event CampaignFundsClaimed(address recipient, uint256 amount);

    /**
     * @notice порождается, когда фаудер запросил с контракта средства, но перевод "завис" (перешел в pendingWithdraw)
     * @param recipient адрес получателя
     * @param amount запросшенная сумма
     */
    event CampaignFundsDeffered(address recipient, uint256 amount);

    /**
     * @notice порождается, когда фаундер успешно отправил комиссию платформы
     * @param recipient адрес получателя
     * @param amount полученная сумма
     */
    event CampaignFeePayed(address recipient, uint256 amount);

    /**
     * @notice порождается, когда фаудер отправил платформе комиссию, но перевод "завис" (перешел в pendingWithdraw)
     * @param recipient адрес получателя
     * @param amount запросшенная сумма
     */
    event CampaignFeeDeffered(address recipient, uint256 amount);

    //ошибки
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
     * @notice индицирует обращение к функциям кампании после истечения дедлайна
     * @param deadline срок действия сбора
     * @param timeStamp время обращения
     */
    error CampaingTimeExpired(uint32 deadline, uint256 timeStamp);

    /**
     * @notice индицирует ошибку изменения статуса
     * @param newStatus статус, который не удалось присвоить     
     */
    error CampaingInvalidChandgedStatus(Status newStatus);

    /**
     * @notice Ошибка при попытке расшифровать недопустимый статус
     * @param invalid статус, который вышел за допустимые пределы
     */
    error CampaignUnknownStatus(Status invalid);

    /**
     * @notice индицирует вызов некорректиной перегрузки функции
     * @dev использовать для отказа вызовов недействительных перегрузок в функциях
     */
    error CampaingIncorrertFunction();

    /**
     * @notice индицирует вызов несуществующей фукнции или попытку прямой отправки денег на контракт
     * @dev используется в receive и fallback функциях
     * @param caller адрес, инициирующий вызов
     * @param value отправленная в вызове сумма
     * @param data данные сообщения
     */
    error CampaignIncorrectCall(address caller, uint256 value, bytes data);

    /**
     * @notice индицирует нулевую сумму взноса    
     * @param investor адрес вносителя
     */
    error CampaingZeroDonation(address investor);    

    /**
     * @notice индицирует нулевую сумму вывода 
     * @param recipient адрес вносителя
     */
    error CampaingZeroWithdraw(address recipient);    
    
    /**
     * @notice индицирует попытку повторного вывода средств фаундером
     * @param recipient адрес получателя
     */
    error CampaingTwiceWithdraw(address recipient);    

    /**
     * @notice индицирует ошибку вывода "зависших" платежей     
     * @param recipient адрес получателя
     * @param amount сумма неудавшегося перевода
     * @param token адрес токена, который переводился (для эфира address(0))
     */
    error CampaignPendingWithdrawFailed(address recipient, uint256 amount, address token);    

    //геттеры    
    
    /// @notice создатель, он же владелец
    function creator() external view returns (address);

    /// @notice 0x0 для ETH (для совместимости)
    function token() external view returns (address);

    /// @notice цель - wei / decimals   
    function goal() external view returns (uint128);

    /// @notice комиссия платформы в промилле
    function platformFee() external view returns (uint128);

    /// @notice срок
    function deadline() external view returns (uint32);

    /// @notice идентификатор
    function Id() external view returns (uint32);

    /// @notice Общая сумма средств, внесённых в кампанию за всё время.
    /// @dev Значение не уменьшается при возврате вкладов или выводе средств фаундером.
    /// Используется исключительно для определения достижения цели (`goal`) и смены статуса.
    /// Актуальный баланс кампании можно получить через `address(this).balance` для эфира
    /// или `token.balanceOf(address(this))` для токенов.
    function raised() external view returns (uint128);

    /// @notice статус кампании
    function status() external view returns (Status);

    /// @notice имя
    function campaignName() external view returns (string memory);

    /// @notice JSON-метаданные (описание + документы/IPFS)   
    function campaignMeta() external view returns (string memory);
    
    /**
     * @notice функция-геттер возвращает сводную информацию о кампании
     */
    function getSummary()
        external
        view        
        returns (
            address _creator,
            string memory _campaignName,
            uint32 _Id,
            address _token, // 0x0 для ETH
            uint128 _goal,
            uint128 _raised,
            uint32 _deadline,
            string memory _campaignMeta,
            Status _status            
        );   
    /**
     * @notice функция возвращает сумму перечисленных инвестором средств
     * @param investor адрес инвестора
     */
    function getContribution(address investor) external view returns(uint256);

    /**
     * @notice функция возращает сумму "зависших" средств (непрошедшие рефанды, неуспешно заклейменные взносы, неуспешно выведенные фонды)
     * @param recipient aдрес возврата
     */
    function getPendingFunds(address recipient) external view returns(uint256);

    /**
     * @notice техническая функция - расшифровка статуса "словами"
     * @param status статус, который надо "расшифровать"
     */ 
    function getStatusName(Status status) external pure returns(string memory);    

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
    
    /**
     * @notice функция позволяте инвесторам вернуть взносы, если кампания провалилась или отмненена
     * @dev при реализации необходимо предусмотреть проверку статуса
     */
    function claimContribution()  external;
    
    /**
     * @notice функция позволяет затребовать "зависшую" сумму (непрошедший рефанд, неполлученный взнос, фонд кампании, комиссию платформы)
     */
    function claimPendingFunds()  external;

    //функции для владельца
    
    /**
     * @notice функция вывода фаундером накопленных средств
     * средства выводятся фаундером за вычетом комиссии платформы
     * @dev перечисление комиссии платформе производится внутри функции
     */
    function withdrawFunds() external;

    /**
     * @notice функция автоматически актуализирует статус контракта на Failed при истекшем дедлайне
     * @dev вызывается внутри функции вывода взносов, чтобы вывод не падал если дедлайн истек, а статус не переведен
     * @dev допускается вызывать снаружи
     */
    function checkDeadlineStatus() external;

    
    /**
     * @notice функция вручную устанавливает новый статус     
     * @dev может быть вызвана только creator'ом, внутри проверяет, какие статусы можно менять     
     */
    function setCampaignStatus(Status status) external;    
    
}
