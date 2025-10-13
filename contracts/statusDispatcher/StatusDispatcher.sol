// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title StatusDispatcher 
/// @author mangert
/// @notice содержит функционал автоперевода статуса контрактов-кампаний
import { IStatusDispatcher } from "../interfaces/IStatusDispatcher.sol";
import { ICampaign } from "../interfaces/ICampaign.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";

contract StatusDispatcher is IStatusDispatcher, AutomationCompatibleInterface {

    //структура для "кучи"
    struct CampaignInfo {
        address campaign;
        uint256 deadline;
    }

    //куча
    CampaignInfo[] private heap; // min-heap: heap[0] — ближайший дедлайн    
    
    /// @notice позиция кампании в куче 
    /// @dev (1-based)
    mapping(address => uint256) private indexOf;
    
    /// @dev счетчик кампаний
    uint256 public totalCampaigns;

    // --- Chainlink Automation ---

    /// @notice функция проверки условия запуска автоматизации
    /// @dev вызывается Chainlink-нодой off-chain
    /// @param null параметр не задействован, требование интерфейса
    /// @return upkeepNeeded признак запуска автоматизации
    /// @return performData данные, передаваемые в автоматизацию
    function checkUpkeep(bytes calldata) external view override 
        returns (bool upkeepNeeded, bytes memory performData) {
        
        if (heap.length == 0) return (false, "");

        CampaignInfo memory next = heap[0];
        if (block.timestamp >= next.deadline) {
            upkeepNeeded = true;
            performData = abi.encode(next.campaign);
        }
    }        
    
    /// @notice функция выполняет автоматизацию
    /// @dev вызывается нодой chainlink, если checkUpkeep вернул true
    /// @param performData данные, с которыми работаем (в нашем случае адрес кампании)    
    function performUpkeep(bytes calldata performData) external override {
        
        address campaignAddr = abi.decode(performData, (address));
        ICampaign campaign = ICampaign(campaignAddr);
        campaign.checkDeadlineStatus(); // сама вызовет unregister()
    }

    // --- Регистрация / удаление кампаний ---
    
    /// @notice функция регистрации кампаний в куче
    /// @dev вызывается контрактом-кампанией
    function registerCampaign() external override {
        
        address campaign = msg.sender;       
        require(indexOf[campaign] == 0, AlreadyRegistered());
        
        uint256 deadline = ICampaign(campaign).deadline;

        //кладем в кучу на последнее место
        heap.push(CampaignInfo({campaign: campaign, deadline: deadline}));
        //увеличиваем счетчик
        totalCampaigns++;

        //считаем индекс в очереди
        uint256 idx = heap.length;        
        indexOf[campaign] = idx;
        //балансируем дерево
        _heapifyUp(idx - 1);

        emit CampaignRegistered(campaign, block.timestamp);
    }

    /// @notice функция исключения кампании из кампаний в кучи
    /// @dev вызывается контрактом-кампанией
    function unregisterCampaign() external override {
        
        address campaign = msg.sender;        
        uint256 idx = indexOf[campaign];
        require(idx != 0, CampaignNotRegistered());

        //выдергиваем кампанию из кучи
        uint256 lastIdx = heap.length - 1;
        if (idx - 1 != lastIdx) {
            //меняем нашу кампанию с последней в очереди
            heap[idx - 1] = heap[lastIdx];
            indexOf[heap[lastIdx].campaign] = idx;
            //балансируем дерево без последнего элемента
            _heapifyDown(idx - 1);
        }
        
        heap.pop(); //обрезаем кучу
        indexOf[campaign] = 0; 
        totalCampaigns--;

        emit CampaignUnregistered(campaign, block.timestamp);
    }

    // --- Куча ---

    /// @notice балансировка дерева при добавлении элемента
    /// @param i граница балансировки (индекс последнего элемента)
    function _heapifyUp(uint256 i) internal {
        while (i > 0) {
            uint256 parent = (i - 1) / 2;
            if (heap[i].deadline >= heap[parent].deadline) break;
            _swap(i, parent);
            i = parent;
        }
    }
    
    /// @notice балансировка дерева при удалении элемента
    /// @param i граница балансировки (индекс последнего элемента)
    function _heapifyDown(uint256 i) internal {
        uint256 left;
        uint256 right;
        uint256 smallest;

        while (true) {
            left = 2 * i + 1;
            right = 2 * i + 2;
            smallest = i;

            if (left < heap.length && heap[left].deadline < heap[smallest].deadline) {
                smallest = left;
            }

            if (right < heap.length && heap[right].deadline < heap[smallest].deadline) {
                smallest = right;
            }

            if (smallest == i) break;
            _swap(i, smallest);
            i = smallest;
        }
    }

    /// @notice техническая функция обмена значений индексов в мэппинге индексов кампаний
    /// @param indexA индекс массива кучи первого обмениваемого элемента
    /// @param indexB индекс массива кучи второго обмениваемого элемента
    function _swap(uint256 indexA, uint256 indexB) internal {
        (heap[indexA], heap[indexB]) = (heap[indexB], heap[indexA]); //кортежное присваивание
        
        //обновляем позиции элементов в очереди исходя из их индексов в массиве кучи (просто сдвиг на единицу)
        indexOf[heap[indexA].campaign] = indexA + 1; 
        indexOf[heap[indexB].campaign] = indexB + 1;
    }

    // --- Просмотр ---

    /// @notice функция возвращает верхнюю кампанию в куче
    /// @return campaign адрес кампании
    /// @return deadline дедлайн
    function getNextCampaign() external view returns (address campaign, uint256 deadline) {
        if (heap.length == 0) return (address(0), 0);
        CampaignInfo memory next = heap[0];
        return (next.campaign, next.deadline);
    }    
}
