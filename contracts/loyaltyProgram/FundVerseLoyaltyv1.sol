// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.4.0
pragma solidity ^0.8.30;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IPlatformMinimal } from "../interfaces/IPlatformMinimal.sol"; 
import { ICampaign } from "../interfaces/ICampaign.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

contract FundVerseLoyaltyv1 is ERC721, Ownable {

    //метадата
    //выложено на ipfs
    string private constant _TOKEN_URI = "ipfs://bafkreih7bcghnbpsdx3ln4tsxrz7jcao5wnlqgfnqf3jji72eapo7osnde";
    
    /// @notice ссылка на адрес платформы
    address public platform;    

    //cчетчик для Id
    //считать будем с единицы, чтобы проверять удобнее было
    uint256 private counter;

    /// @notice получатели NFT
    /// @dev если NFT быд выдан, то при передаче в списке остается старый владелец
    mapping (address founder => uint256 tokenId) foundersTokens;

    /// @notice скидка, зафиксированная при минте
    mapping (uint256 tokenId => uint16 discountAtMint) private tokenDiscount;


    /// @notice размер дисконта
    uint16 public feeDiscount;

    //события
    
    /// @notice событие порождается при изменении размера дисконта
    /// @param oldValue старое значение дисконта
    /// @param newValue новое значение дисконта
    /// @param author автор изменений    
    event FeeDiscountChanged(uint16 oldValue, uint16 newValue, address author);

    /// @notice событие порождается при адреса платформы
    /// @param oldValue старый адрес
    /// @param newValue новый адрес
    /// @param author автор изменений    
    event PlatformAddressChanged(address oldValue, address newValue, address author);    

    //ошибки
    
    /// @notice ошибка при попытке повоторного запроса NFT фаундером, который уже получал NFT ранее
    /// @param founder адрес фаундера, запрашивающего NFT
    /// @param tokenId идентификатор выданного ранее NFT
    error RepeatNFTRequest(address founder, uint256 tokenId);

    /// @notice ошибка показывает, что пользователь не может получить NFT (нет успешно закончившихся кампаний)
    /// @param founder адрес фаундера, запрашивающего NFT    
    error NotEligibilable(address founder);

    /// @notice ошибка при попытке указать некорректное значение скидки
    /// @param feeDiscount устанавливаемое значение скидки    
    error UnacceptableFeeDiscount(uint16 feeDiscount);

    /// @notice ошибка при попытке указать некорректный aдрес платформы
    /// @param platformAddr устанавливаемый адрес
    error UnacceptablePlatformAddress(address platformAddr);

    
    constructor(address initialOwner, address _platform) 
        ERC721("FundVerse Loyalty v1", "FVC") 
        Ownable(initialOwner)
    {
        //начальные установки
        feeDiscount = 5; //в вычитаемых промилле
        platform = _platform;
    }

    function safeMint(address to) external {
        //проверяем, что наш получатель соответствует условиям
        require(_validateMintEligibility(to), NotEligibilable(to));        
        
        //минтим
        _safeMint(to, ++counter);
        //и включаем его в список
        foundersTokens[to] = counter;
        // сохраняем скидку для этого NFT
        tokenDiscount[counter] = feeDiscount;
    
    }

    /// @notice функция возвращает ссылку json-файл с метаданными
    function tokenURI(uint256) public pure override returns (string memory) {
        return _TOKEN_URI;
    }
    

    /// @notice функция возвращает размер скидки фаундера (в вычитаемых из размера комиссии промилле)
    /// @param founder адрес фаундера, для которого возвращаем скидку
    function getFounderDiscount(address founder) external view returns(uint16) {        

        uint256 tokenId = foundersTokens[founder];
        if (tokenId != 0 && _ownerOf(tokenId) == founder) {
            return tokenDiscount[tokenId]; // скидка зафиксирована в момент минта
        }
        return 0;
    }

    /// @notice внутренняя функция проверки, может ли фаундер получить NFT
    /// @param founder адрес фаундера
    function validateMintEligibility(address founder) external view returns (bool) {
        return _validateMintEligibility(founder);
    }
    
    //функции установки настроек    
    
    /// @notice функция позволяет установить адрес платформы
    /// @param platformAddr новый адрес
    function setPlatformAddress(address platformAddr) external onlyOwner() {
        require(platformAddr != address(0), UnacceptablePlatformAddress(address(0)));
        
        emit PlatformAddressChanged(platform, platformAddr, msg.sender);        
        platform = platformAddr;
    }

    /// @notice функция позволяет установить новое значение дисконта
    /// @param newFeeDiscount новое значение дисконта
    function setFeeDiscount(uint16 newFeeDiscount) external onlyOwner() {
        require(newFeeDiscount <= 1000 &&
            newFeeDiscount <= IPlatformMinimal(platform).getBaseFee()
            , UnacceptableFeeDiscount(newFeeDiscount));
        
        emit FeeDiscountChanged(feeDiscount, newFeeDiscount, msg.sender);        
        feeDiscount = newFeeDiscount;
    }

    //служебные функции
    
    /// @notice внутренняя функция проверки, может ли фаундер получить NFT
    /// @param founder адрес фаундера
    function _validateMintEligibility(address founder) internal view returns(bool){
        //сначала проверим - если раньше уже получал - не может, даже если продал
        if(foundersTokens[founder] != 0) {
            return false;
        }
        
        //uint256 tokenId = foundersTokens[founder];        
        //require(tokenId == 0, RepeatNFTRequest(founder, tokenId));
        
        //теперь проверим, какие у него есть кампании
        //и сначал получим их количество
        uint32 countCampaigns = IPlatformMinimal(platform).getCampaignsCountByFounder(founder);
        //пробежимся по всем
        for(uint32 i = 0; i != countCampaigns; ++i) {            
            //и проверим статус
            address campaign = IPlatformMinimal(platform).getCampaignOfFounderByIndex(founder,i);
            if(ICampaign(campaign).status() == ICampaign.Status.Successful){
                return true; //если закончилась успехом - сразу возвращаемся
            } 
        }
        return false; //если не вернулиcь - возвращаем false
    }
}
