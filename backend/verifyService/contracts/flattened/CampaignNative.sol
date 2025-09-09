// Sources flattened with hardhat v2.26.1 https://hardhat.org

// SPDX-License-Identifier: MIT

// File @openzeppelin/contracts/utils/ReentrancyGuard.sol@v5.4.0

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}


// File contracts/interfaces/ICampaign.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.30;


/// @title интерфейс ICampaign для контрактов-кампаний 
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
    
    /// @notice сообщает о поступившем и зачисленном взносе
    /// @param contributor вноситель
    /// @param amount зачисленная сумма    
    event CampaignContribution(address indexed contributor, uint256 amount); 
    
    /// @notice сообщает об успешном рефанде
    /// @dev применяется в функциях рефанда взносов или в функциях взноса при рефанде излишков
    /// @param donor адрес вкладчика (он же получатель рефанда)
    /// @param amount сумма возврата
    /// @param token валюта возврата (address(0) для нативной валюты)    
    event CampaignRefunded(address indexed donor, uint256 amount, address token);

    /// @notice сообщает об успешном выводе фондов из камиании
    /// @param recipient адрес вывода
    /// @param amount сумма вывода  
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    
    /// @notice порождается, когда контракт не может перевести пользователю деньги 
    ///(при рефанде излишков, вкладов или истребовании средств фаундером)
    /// @param recipient адрес получателя
    /// @param amount сумма неудавшегося перевода
    /// @param token адрес токена, который переводился (для эфира address(0))    
    event CampaignTransferFailed(address indexed recipient, uint256 amount, address token);    
    
    /// @notice порождается при изменении статуса
    /// @param oldStatus исходный статус кампании      
    /// @param newStatus новый статус кампании      
    /// @param timeStamp время финализации    
    event CampaignStatusChanged(Status oldStatus, Status newStatus, uint256 timeStamp);
    
    /// @notice порождается, когда инвестор успешно получил с контракта средства
    /// @param recipient адрес получателя
    /// @param amount полученная сумма    
    event CampaignContributionClaimed(address indexed recipient, uint256 amount);
    
    /// @notice порождается, когда инвестор запросил с контракта средства, но перевод "завис" (перешел в pendingWithdraw)
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
    function id() external view returns (uint32);

    /// @notice Общая сумма средств, внесенных в кампанию за всё время.
    /// @dev Значение не уменьшается при возврате вкладов или выводе средств фаундером.
    /// Используется исключительно для определения достижения цели (`goal`) и смены статуса.
    /// Актуальный баланс кампании можно получить через `address(this).balance` для эфира
    /// или `token.balanceOf(address(this))` для токенов.
    function raised() external view returns (uint128);

    /// @notice статус кампании
    function status() external view returns (Status);
    
    /// @notice JSON-метаданные (описание + документы/IPFS)   
    function campaignMeta() external view returns (string memory);    
    
    /// @notice функция-геттер возвращает сводную информацию о кампании    
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
    function getContribution(address investor) external view returns(uint256);
    
    /// @notice функция возращает сумму "зависших" средств (непрошедшие рефанды, неуспешно заклейменные взносы, неуспешно выведенные фонды)
    /// @param recipient aдрес возврата    
    function getPendingFunds(address recipient) external view returns(uint256);
    
    /// @notice техническая функция - расшифровка статуса "словами"
    /// @param numStatus статус, который надо "расшифровать"     
    function getStatusName(Status numStatus) external pure returns(string memory);    

    // Основные функции взаимодействия
    
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
    
    /// @notice функция позволяет затребовать "зависшую" сумму (непрошедший рефанд, неполлученный взнос, фонд кампании, комиссию платформы)    
    function claimPendingFunds()  external;
    
    //функции для владельца    
    
    /// @notice функция вывода фаундером накопленных средств
    /// средства выводятся фаундером за вычетом комиссии платформы
    /// @dev перечисление комиссии платформе производится внутри функции    
    function withdrawFunds() external;
    
    /// @notice функция автоматически актуализирует статус контракта на Failed при истекшем дедлайне
    /// @dev вызывается внутри функции вывода взносов, чтобы вывод не падал если дедлайн истек, а статус не переведен
    /// @dev допускается вызывать снаружи    
    function checkDeadlineStatus() external;    
    
    /// @notice функция вручную устанавливает новый статус     
    /// @dev может быть вызвана только creator'ом, внутри проверяет, какие статусы можно менять         
    function setCampaignStatus(Status newStatus) external;        
}


// File contracts/modules/campaigns/CampaignBase.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.30;
/**
 * @title Абстрактный контракт для кампаний
 * @notice содержит общую часть (хранилище, типы, модификаторы, функции, которые не зависят от валюты) 
 */
abstract contract CampaignBase is ICampaign, ReentrancyGuard {    
    
    //хранилище данных 
    /// @notice адрес платформы краудфандинга (для получения комиссии)
    address internal immutable platformAddress;
    
    /// @notice создатель, он же владелец
    address public immutable creator;

    /// @notice 0x0 для ETH (для совместимости)
    address public immutable token; 
    
    /// @notice цель - wei / decimals   
    uint128 public immutable goal; 
    
    /// @notice комиссия платформы в промилле
    uint128 public immutable platformFee; 
    
    /// @notice срок
    uint32 public immutable deadline;
    
    /// @notice идентификатор
    uint32 public immutable id; 

    /// @notice Общая сумма средств, внесённых в кампанию за всё время.
    /// @dev Значение не уменьшается при возврате вкладов или выводе средств фаундером.
    uint128 public raised; //собрано - wei / decimals
    
    /// @notice статус кампании
    Status public status; 

    /// @notice внутренний флаг, что фаундер еще не выводил средства
    bool internal founderWithdrawn;

    /// @notice флаг для nonReentrancy
    bool private _inCall;
       
    /// @notice JSON-метаданные (описание + документы/IPFS)   
    string public campaignMeta; 

    mapping(address investor => uint256 value) internal donates; //хранилище для вкладов участников
    mapping (address recipient => uint256 value) internal pendingWithdrawals; //хранилище для "зависших" сумм
    
    /**
     * @dev модификатор применяется к функциям, которые может вызвать только фаундер
     */
    modifier onlyCreator() {
        require(msg.sender == creator, CampaignUnauthorizedAccount(msg.sender)); 
        _;
    }

    /**
     * @dev модификатор применяется к функциям, которые могут вызываться только на "живых" кампаниях
     */
    modifier checkState() {                        
        require(status == Status.Live, CampaignInvalidStatus(status, Status.Live));
        // slither-disable-next-line timestamp
        require(block.timestamp < deadline, CampaignTimeExpired(deadline, block.timestamp));
        _;
    }   

    constructor(
        address _platformAddress,        
        address _creator,        
        uint32 _id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee, 
        address _token
    ) {
        platformAddress= _platformAddress;
        creator = _creator;        
        id = _id;
        goal = _goal;
        deadline = _deadline;
        campaignMeta = _campaignMeta;
        platformFee = _platformFee;

        status = Status.Live; //для ясности - можно убрать
        token = _token; // address(0) — для ETH, иначе — адрес ERC20 токена
    }

    //общие для обеих версий геттеры        
    
    /// @notice Получить сводку о кампании
    function getSummary()
        external
        view
        virtual
        returns (
            address _creator,            
            uint32 _id,
            address _token, // 0x0 для ETH
            uint128 _goal,
            uint128 _raised,
            uint32 _deadline,
            string memory _campaignMeta,
            Status _campaignStatus            
        ){
            return(
                creator,                 
                id,
                token, // 0x0 для ETH
                goal,
                raised,
                deadline,
                campaignMeta,
                status
            );       
    }
    
    /// @notice узнать сумму взносов инвестора
    function getContribution(address investor) external view returns(uint256) {
        return donates[investor];
    }
    
    /// @notice узнать сумму "зависших" средств
    function getPendingFunds(address recipient) external view returns(uint256) {
        return pendingWithdrawals[recipient];
    }
    
    /// @notice техническая функция - расшифровывает значение статуса словами
    function getStatusName(Status numStatus) external pure virtual returns(string memory) {
        
        string [5] memory  statuses = [
            "Live",
            "Stopped",
            "Cancelled",    
            "Failed",       
            "Successful"    
        ];
        uint8 index = uint8(numStatus);
        require(statuses.length > index, CampaignUnknownStatus(numStatus));
        return statuses[index];
    } 

    //общие функции по выводу средств
    /// @notice затребовать взнос с провалившейся или отмененной кампании
    function claimContribution()  external nonReentrant override {

        checkDeadlineStatus(); //актуализируем статус по дедлайну, если необходимо      
        address recipient = msg.sender;
        
        require(status == Status.Failed || status == Status.Cancelled,
            CampaignInvalidStatus(status, Status.Failed));
        uint256 contiribution = donates[recipient];
        
        require(contiribution > 0, CampaignZeroWithdraw(recipient));
        donates[recipient] = 0;
        
        if(_transferTo(recipient, contiribution)){
            emit CampaignContributionClaimed(recipient, contiribution);    
        } else {
            emit CampaignContributionDeffered(recipient, contiribution);
        }
    }
    /// @notice функция для владельца    
    /// @notice Забрать средства фаундером (если условия выполнены)
    function withdrawFunds() external nonReentrant onlyCreator {
        
        //сначала проверяем статус
        require(status == Status.Successful, CampaignInvalidStatus(status, Status.Successful));
        //проверяем, есть ли фонды, которые можно перевести
        uint256 fund = raised;
        //теперь проверим, не повторный ли это вывод
        require(!founderWithdrawn, CampaignTwiceWithdraw(msg.sender));
        founderWithdrawn = true;
        
        uint256 fee = ((fund * 1000) * platformFee) / (1000_000);
        uint256 withdrawnAmount = fund - fee;

        //переводим сначала комиссию
        if(_transferTo(platformAddress, fee)){
            emit CampaignFeePayed(platformAddress, fee);
        }
        else{
            emit CampaignFeeDeffered(platformAddress, fee);
        }

        //теперь переводим себе
        if(_transferTo(creator, withdrawnAmount)){
            emit CampaignFundsClaimed(creator, withdrawnAmount);
        }
        else{
            emit CampaignFundsDeffered(creator, withdrawnAmount);
        }
    }

    /// @notice функция для владельца    
    /// @notice установить новый статус
    function setCampaignStatus(Status newStatus) external onlyCreator {
        Status oldStatus = status; //запоминаем текущий статус        
        
        require(
            oldStatus < Status.Cancelled && //статус менять можем только у живых и приостановленных кампаний
            oldStatus != newStatus, //проверяем, что новый и старый статусы не совпадают
            CampaignInvalidChandgedStatus(newStatus)
        );

        //переменная для сохранения валидности смены статуса        
        // slither-disable-next-line uninitialized-local
        bool valid;

        //цепочка проверяет, можем ли мы установить запрашиваемый статус в зависимости от текущего состояния контракта
        //и сохраняет результат в переменную valid
        // timestamp manipulation not critical here
        if (newStatus == Status.Successful) {
            valid = (raised >= goal); // полностью собранные кампании можем объявлять успешными досрочно
        } else if (newStatus == Status.Cancelled || newStatus == Status.Stopped) {
            // slither-disable-next-line timestamp
            valid = (block.timestamp < deadline && raised < goal); 
        } else if (newStatus == Status.Failed) {
            // slither-disable-next-line timestamp
            valid = (block.timestamp >= deadline && raised < goal);
        } else if (newStatus == Status.Live) {
            // slither-disable-next-line timestamp
            valid = (block.timestamp < deadline && raised < goal);
        }

        require(valid, CampaignInvalidChandgedStatus(newStatus));
        
        status = newStatus;
        emit CampaignStatusChanged(oldStatus, newStatus, block.timestamp); 
    }   

    //служебные функции
     /**
     * @notice функция автоматически актуализирует статус контракта при истекшем дедлайне
     * @dev вызывается внутри функции вывода взносов, но может быть вызвана снаружи
     */
    function checkDeadlineStatus() public virtual {
    
        Status previous = status;
        // slither-disable-next-line timestamp
        if ((status == Status.Live || status == Status.Stopped) &&                        
            block.timestamp >= deadline
            ) {
                status = raised >= goal ? Status.Successful : Status.Failed;
                emit CampaignStatusChanged(previous, status, block.timestamp); 
        }
    }
    /**
     * @notice служебная функция перевода средств
     * @dev реализация зависит от валюты, обязательно переопределять в наследниках
     * @param recipient получатель
     * @param amount сумма перевода
     */
    function _transferTo(address recipient, uint256 amount) internal virtual returns (bool);  
    
    receive() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, "");
    }

    fallback() external payable {
        revert CampaignIncorrectCall(msg.sender, msg.value, msg.data);
    } 

}


// File contracts/modules/campaigns/CampaignNative.sol

// Original license: SPDX_License_Identifier: MIT
pragma solidity ^0.8.30;
    /// @title Контракт кампании (разновидность в нативной валюте) 
/// @notice обеспечивает сбор денег на конкретную цель
contract CampaignNative is ICampaign, CampaignBase {
    constructor(
        address  _platformAddress,
        address _creator,        
        uint32 _id,
        uint128 _goal,
        uint32 _deadline,
        string memory _campaignMeta,
        uint128 _platformFee
    ) CampaignBase (
        _platformAddress,
        _creator,        
        _id,
        _goal,
        _deadline,
        _campaignMeta,
        _platformFee,
        address(0)
    ) {}    

    // Основные функции взаимодействия


   /// @notice Внести средства - неиспользуемая перегрузка
    function contribute(uint128) external pure {
        revert CampaignIncorrertFunction();
    }

   /// @notice Внести средства (ETH - cчитаем в wei)
    function contribute() external payable nonReentrant checkState {
        
        address contributor = msg.sender;

        require(msg.value > 0, CampaignZeroDonation(contributor)); //проверяем, что не ноль

        uint128 accepted = goal - raised; //проверяем, сколько осталось до цели

        uint256 refund; //переменная для возвратов
        uint256 contribution; //сумма к зачислению       

        //в этом блоке смотрим, сколько из взноса зачислим, а сколько вернем излишков
        if (msg.value > accepted) {
            refund = msg.value - accepted;
            contribution = accepted;
        } else {
            refund = 0;
            contribution = msg.value;
        }
        
        //зачисляем взнос
        donates[contributor] += contribution;
        raised += uint128(contribution);
        
        if(raised >= goal) { //если после зачисления достигли цели
            status = Status.Successful; //Аетуализируем статус
            emit CampaignStatusChanged(Status.Live, status, block.timestamp);
        }

        //если есть, что возвращать
        if (refund > 0) {            
           if(_transferTo(payable(contributor), refund)) {
            emit CampaignRefunded(contributor, refund, address(0));
           }
        }

        emit CampaignContribution(contributor, contribution);
    }     

    ///@notice затребовать "зависшие" средства    
    function claimPendingFunds() external override nonReentrant {
        address recipient = payable(msg.sender);
        
        uint256 amount = pendingWithdrawals[recipient]; //смотрим, сколько у пользователя "зависло" средств
        require(amount > 0, CampaignZeroWithdraw(recipient)); //проверка, что невыведенные средства больше нуля

        pendingWithdrawals[recipient] = 0; //обнуляем баланс

        emit PendingFundsClaimed(recipient, amount);

        (bool success, ) = recipient.call{value: amount}("");
        require(success, CampaignPendingWithdrawFailed(recipient, amount, address(0)));
    }          

    //вспомогательные функции
 
    /// @notice служебная функция перевода средств
    /// @dev используется для рефандов и переводов
    /// @dev не использовать при клейме зависших средств!
    /// @dev Внешний вызов безопасен — состояние не меняется до него.
    /// Запись в pendingWithdrawals происходит ТОЛЬКО при неудаче отправки.
    /// Вызов обёрнут в external функцию с модификатором nonReentrant.     
    function _transferTo(address recipient, uint256 amount) internal override returns (bool) {
        (bool success, ) = payable(recipient).call{value: amount}("");
            if (!success) {
                pendingWithdrawals[recipient] += amount;
                emit CampaignTransferFailed(msg.sender, amount, address(0));
            }
        return success;
    } 
}