// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;


/// @title интерфейс ICampaign для контрактов-кампаний 
/// @author mangert
/// @notice содержит описания функций, событий, ошибок и типов контрактов-кампаний
interface ICampaign {
    
    //типы
   
    /// @notice перечисление статусов кампаний    
    enum Status {
        Live,         // идет сбор
        Stopped,      // временно приостановлена
        Cancelled,    // отменена фаундером (возврат средств)
        Failed,       // не собрала нужное → неуспешна
        Successful    // достигла цели и финализирована
    }
    
    // События
    // solhint-disable gas-indexed-events
    
    /// @notice сообщает о поступившем и зачисленном взносе
    /// @param contributor вноситель
    /// @param amount зачисленная сумма    
    event CampaignContribution(address indexed contributor, uint256 amount); 
    
    /// @notice сообщает об успешном рефанде
    /// @dev применяется в функциях рефанда взносов или в функциях взноса при рефанде излишков
    /// @param donor адрес вкладчика (он же получатель рефанда)
    /// @param amount сумма возврата
    /// @param token валюта возврата (address(0) для нативной валюты)    
    event CampaignRefunded(address indexed donor, uint256 amount, address indexed token);
    
    /// @notice порождается, когда контракт не может перевести пользователю деньги 
    ///(при рефанде излишков, вкладов или истребовании средств фаундером)
    /// @param recipient адрес получателя
    /// @param amount сумма неудавшегося перевода
    /// @param token адрес токена, который переводился (для эфира address(0))    
    event CampaignTransferFailed(address indexed recipient, uint256 amount, address indexed token);    
    
    /// @notice порождается при изменении статуса
    /// @param oldStatus исходный статус кампании      
    /// @param newStatus новый статус кампании      
    /// @param timeStamp время финализации    
    event CampaignStatusChanged(Status oldStatus, Status newStatus, uint256 timeStamp);
    
    /// @notice порождается, когда инвестор успешно получил с контракта средства
    /// @param recipient адрес получателя
    /// @param amount полученная сумма    
    event CampaignContributionClaimed(address indexed recipient, uint256 amount);
    
    /// @notice порождается, когда инвестор запросил с контракта средства, 
    /// но перевод "завис" (перешел в pendingWithdraw)
    /// @param recipient адрес получателя
    /// @param amount запросшенная сумма    
    event CampaignContributionDeffered(address indexed recipient, uint256 amount);
    
    /// @notice порождается, когда фаундер успешно получил с контракта средства
    /// @param recipient адрес получателя
    /// @param amount полученная сумма    
    event CampaignFundsClaimed(address indexed recipient, uint256 amount);
    
    /// @notice порождается, когда фаудер запросил с контракта средства, но перевод "завис" (перешел в pendingWithdraw)
    /// @param recipient адрес получателя
    /// @param amount запросшенная сумма    
    event CampaignFundsDeffered(address indexed recipient, uint256 amount);
    
    /// @notice порождается, когда фаундер успешно отправил комиссию платформы
    /// @param recipient адрес получателя
    /// @param amount полученная сумма    
    event CampaignFeePayed(address indexed recipient, uint256 amount);
    
    /// @notice порождается, когда фаудер отправил платформе комиссию, но перевод "завис" (перешел в pendingWithdraw)
    /// @param recipient адрес получателя
    /// @param amount запросшенная сумма    
    event CampaignFeeDeffered(address indexed recipient, uint256 amount);
    
    /// @notice порождается, когда пользователь успешно забрал "зависшие" средства
    /// @param recipient адрес получателя
    /// @param amount забранная сумма    
    event PendingFundsClaimed(address indexed recipient, uint256 amount);

    //ошибки    
    
    /// @notice индицирует попытку доступа к функциям кампании не владельцем
    /// @param account адрес, с которого вызывалась функция    
    error CampaignUnauthorizedAccount(address account);
    
    /// @notice индицирует вызов функции при некорректном статусе кампании
    /// @param actual фактический статус
    /// @param needed требуемый статус    
    error CampaignInvalidStatus(Status actual, Status needed);
    
    /// @notice индицирует обращение к функциям кампании после истечения дедлайна
    /// @param deadline срок действия сбора
    /// @param timeStamp время обращения    
    error CampaignTimeExpired(uint32 deadline, uint256 timeStamp);
    
    /// @notice индицирует ошибку изменения статуса
    /// @param newStatus статус, который не удалось присвоить
    error CampaignInvalidChandgedStatus(Status newStatus);
    
    /// @notice Ошибка при попытке расшифровать недопустимый статус
    /// @param invalid статус, который вышел за допустимые пределы    
    error CampaignUnknownStatus(Status invalid);

    /// @notice индицирует вызов некорректиной перегрузки функции
    /// @dev использовать для отказа вызовов недействительных перегрузок в функциях    
    error CampaignIncorrertFunction();
    
    /// @notice индицирует вызов несуществующей фукнции или попытку прямой отправки денег на контракт
    /// @dev используется в receive и fallback функциях
    /// @param caller адрес, инициирующий вызов
    /// @param value отправленная в вызове сумма
    /// @param data данные сообщения    
    error CampaignIncorrectCall(address caller, uint256 value, bytes data);
    
    /// @notice индицирует нулевую сумму взноса    
    /// @param investor адрес вносителя    
    error CampaignZeroDonation(address investor);    
    
    /// @notice индицирует нулевую сумму вывода 
    /// @param recipient адрес вносителя    
    error CampaignZeroWithdraw(address recipient);        
    
    /// @notice индицирует попытку повторного вывода средств фаундером
    /// @param recipient адрес получателя    
    error CampaignTwiceWithdraw(address recipient);    
    
    /// @notice индицирует ошибку вывода "зависших" платежей     
    /// @param recipient адрес получателя
    /// @param amount сумма неудавшегося перевода
    /// @param token адрес токена, который переводился (для эфира address(0))    
    error CampaignPendingWithdrawFailed(address recipient, uint256 amount, address token);    
    
    /// @notice индицирует ошибку перевода взноса в кампанию
    /// @dev amount представляет всю сумму, которую пытался перевести инвестор, включая сдачу
    /// @param investor адрес инвестора
    /// @param amount сумма неудавшегося взноса (полностью)    
    error CampaignTokenReceiptFailed(address investor, uint256 amount);

    /// @notice индицирует попытку повторной инициализации
    error CampaignReInitialization();

    // ----------------- Функции ----------------//

    /// @notice фунция инициализации
    /// @param _platformAddress адрес платформы
    /// @param _creator создатель кампании
    /// @param _id идентификатор кампании
    /// @param _goal целевая сумма сборов
    /// @param _deadline срок действия кампании
    /// @param _campaignMeta метаданные (название, описание, ссылка на ресурсы и т.д.)
    /// @param _platformFee комиссия платформы
    /// @param _token валюта кампании
    /// @param _statusDispatcher адрес контракта диспетчера для автоперевода статуса
    function initialize(
        address _platformAddress,        
        address _creator,        
        uint32 _id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee, 
        address _token,
        address _statusDispatcher) external;
    
    // ----------------- Основные функции взаимодействия ----------------- //      
    
    /// @notice Внести средства (ERC20)
    /// @dev Зачисляется только та часть `_amount`, которая не превышает оставшуюся сумму до цели.
    /// Остаток средств (`_amount - accepted`) не списывается с пользователя, но логируется событием CampaignRefunded.
    /// Пользователь должен предварительно вызвать `approve` на сумму `_amount`.  
    /// @dev перегрузка для токенов ERC20, в версии для "нативной валюты" всегда завершается ошибкой
    /// @param amount вносимая сумма    
    function contribute(uint128 amount) external;
    
    /// @notice Внести средства (ETH)
    /// @dev перегрузка для нативной валюты, в версии для токенов ERC20 всегда завершается ошибкой    
    function contribute() external payable;            
    
    /// @notice функция позволяте инвесторам вернуть взносы, если кампания провалилась или отмненена
    /// @dev при реализации необходимо предусмотреть проверку статуса    
    function claimContribution()  external;    
    
    /// @notice функция позволяет затребовать "зависшую" сумму (непрошедший рефанд, 
    /// неполученный взнос, фонд кампании, комиссию платформы)    
    function claimPendingFunds()  external;
    
    // ----------------- функции для владельца ----------------- //
    
    /// @notice функция вывода фаундером накопленных средств
    /// средства выводятся фаундером за вычетом комиссии платформы
    /// @dev перечисление комиссии платформе производится внутри функции    
    function withdrawFunds() external;
    
    /// @notice функция автоматически актуализирует статус контракта на Failed при истекшем дедлайне
    /// @dev вызывается внутри функции вывода взносов, чтобы вывод не падал если дедлайн истек, а статус не переведен
    /// @dev допускается вызывать снаружи    
    function checkDeadlineStatus() external;    

    /// @notice функция отменяет кампанию
    /// @dev может вызываться только владельцем, при реализации указать модификатор onlyOwner
    function cancelCampaign() external;

    /// @notice функция приостанавливает кампанию
    /// @dev может вызываться только владельцем, при реализации указать модификатор onlyOwner
    function stopCampaign() external; 

    /// @notice функция запускает приостановленную кампанию
    /// @dev может вызываться только владельцем, при реализации указать модификатор onlyOwner
    function resumeCampaign() external;       

    // ----------------- геттеры --------------- //
    /// @notice создатель, он же владелец
    /// @return address фаундер
    function creator() external view returns (address);

    /// @notice адрес контракта-диспетчера, переводящего статус по дедлайну
    /// @return address адрес контракта-диспетчера
    function statusDispatcher() external view returns (address);

    /// @notice 0x0 для ETH (для совместимости)
    /// @return address адрес контракта токена ERC20
    function token() external view returns (address);

    /// @notice получить размер суммы сбора - wei / decimals
    /// @return uint128 целевая сумма сбора
    function goal() external view returns (uint128);

    /// @notice комиссия платформы в промилле
    /// @return uint128 размер комиссии
    function platformFee() external view returns (uint128);

    /// @notice получить дедлайнт
    /// @return uint32 срок действия кампании
    function deadline() external view returns (uint32);

    /// @notice получить идентификатор
    /// @return uint32 уникальный идентификатор кампании
    function id() external view returns (uint32);

    /// @notice Общая сумма средств, внесенных в кампанию за всё время.
    /// @dev Значение не уменьшается при возврате вкладов или выводе средств фаундером.
    /// Используется исключительно для определения достижения цели (`goal`) и смены статуса.
    /// Актуальный баланс кампании можно получить через `address(this).balance` для эфира
    /// или `token.balanceOf(address(this))` для токенов.
    /// @return uint128 собранная сумма средств (wei / decimals)
    function raised() external view returns (uint128);

    /// @notice получить текущий статус кампании
    /// @return Status статус на момент запроса
    function status() external view returns (Status);
    
    /// @notice JSON-метаданные (описание + документы/IPFS)   
    /// @return string метаданные кампании
    function campaignMeta() external view returns (string memory);    
    
    /// @notice функция-геттер возвращает сводную информацию о кампании
    /// @return _creator адрес фаундера            
    /// @return _id идентификатор
    /// @return _token валюта кампании (0x0 для нативной валюты)
    /// @return _goal целевая сумма сбора (wei / decimals)
    /// @return _raised сумма собранных средств (wei / decimals)
    /// @return _deadline срок действия кампании
    /// @return _campaignMeta данные кампании
    /// @return _status статус кампании
    function getSummary()
        external
        view        
        returns (
            address _creator,            
            uint32 _id,
            address _token, // 0x0 для ETH
            uint128 _goal,
            uint128 _raised,
            uint32 _deadline,
            string memory _campaignMeta,
            Status _status            
        );   
    
    /// @notice функция возвращает сумму перечисленных инвестором средств
    /// @param investor адрес инвестора
    /// @return uint256 сумма средств, внесенная инветором
    function getContribution(address investor) external view returns(uint256);
    
    /// @notice функция возращает сумму "зависших" средств (непрошедшие рефанды,     
    /// неуспешно заклейменные взносы, неуспешно выведенные фонды)
    /// @param recipient aдрес возврата
    /// @return uint256 сумма зависших средств инвестора
    function getPendingFunds(address recipient) external view returns(uint256);
}
