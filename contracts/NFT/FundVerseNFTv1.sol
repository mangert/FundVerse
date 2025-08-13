// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.4.0
pragma solidity ^0.8.30;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";


contract FundVerseNFTv1 is ERC721 {
    constructor()
        ERC721("FundVerse v1", "FVC")
    {}

    function safeMint(address to, uint256 tokenId) external {
        //здесь должны быть условия проверки политик
        _safeMint(to, tokenId);
    }

    function getFounderDiscount(address founder) external view returns(uint16) {
        //пока заглушка
        return 0;
    }
}
