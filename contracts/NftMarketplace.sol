// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

////////////
// ERRORS //
////////////
error NftMarketplace__PriceMustBeAboveZero();
error NftMarketplace__NotApprovedForMarketplace();
error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketplace__NotOwner();
error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error NftMarketplace__NoProceeds();
error NftMarketplace__TransferFailed();

contract NftMarketplace is ReentrancyGuard {
    struct Listing {
        uint256 price;
        address seller;
    }

    // NFT Contract Address -> NFT TokenId -> Listing(Price of NFT, Seller Address)
    mapping(address => mapping(uint256 => Listing)) private s_listing;
    // To keep track of hom much MONEY people has made by selling NFT (SellerAddress -> Amount_earned)
    mapping(address => uint) private s_proceeds;

    //////////////////////
    // Event Declaration//
    //////////////////////
    event ItemListed(
        address indexed owner,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemBought(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemCanceled(address indexed owner, address indexed nftAddress, uint256 indexed tokenId);

    //////////////
    // Modifiers//
    //////////////
    modifier notListed(
        // to make sure that same item is NOT listed more than ONCE.
        address nftAddress,
        uint256 tokenId,
        address owner
    ) {
        Listing memory listing = s_listing[nftAddress][tokenId];
        if (listing.price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isListed(
        // to make sure demanded NFT is listed
        address nftAddress,
        uint256 tokenId
    ) {
        Listing memory listing = s_listing[nftAddress][tokenId];
        if (listing.price <= 0) {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721 xyz = IERC721(nftAddress);
        address owner = xyz.ownerOf(tokenId);
        if (spender != owner) {
            revert NftMarketplace__NotOwner();
        }
        _;
    }

    ////////////////////
    // Main Functions //
    ////////////////////

    /** ----------------------------------------- 1. listItem function -----------------------------------------
     * @notice Method to list NFT into Marketplace
     * @param nftAddress: Address of the NFT
     * @param tokenId: Token Id of the NFT
     * @param price: Sale Price of the NFT
     * @dev this way people can still hold their NFT when listing. They will just allow marketplace to sell their NFT
     */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        // Have this contract accept payament in a subset of tokens as well
        // Hint: Use Chainlink Pricefeeds to convert the price of the tokens between each other
        notListed(nftAddress, tokenId, msg.sender)
        isOwner(nftAddress, tokenId, msg.sender)
    {
        if (price <= 0) {
            revert NftMarketplace__PriceMustBeAboveZero();
        }
        /**
         * We Need to list NFTs....
         *  -> 1. Send the NFT to the contract. Transfer -> Contract; "Hold" the NFT === Gas Expensive ❌
         *  -> 2. Owners can hold their NFT and give marketplace approval to sell NFT for them. ✅
         */

        /*
        So, Now we need to approve Marketplace to sell NFT on our behalf.
            - We will use "getApproved()" function (in IERC721 interface) to Approve Marketplace
         */

        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }

        s_listing[nftAddress][tokenId] = Listing(price, msg.sender); // Here, msg.sender -> Seller === as he is th one who will call listItem fn
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    /** ----------------------------------------- 2. buyItem function -----------------------------------------
     * @notice Method to BUY NFT from Marketplace
     * @param nftAddress: Address of the NFT
     * @param tokenId: Token Id of the NFT
     * @dev here people can buy items from Marketplace
     */
    function buyItem(
        address nftAddress,
        uint256 tokenId
    ) external payable isListed(nftAddress, tokenId) nonReentrant {
        // Check whether ADEQUATE funds are being transfered or not
        Listing memory listedItems = s_listing[nftAddress][tokenId];
        if (msg.value < listedItems.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listedItems.price);
        }

        // Need to update the Amount seller HAVE after selling the NFT
        s_proceeds[listedItems.seller] = s_proceeds[listedItems.seller] + msg.value;

        // After selling, we need to DELETE the Mapping(corres. to the NFT)
        delete (s_listing[nftAddress][tokenId]);

        // Now we will transfer the NFT to the Buyer || To avoid REENTRANT ATTACK
        IERC721(nftAddress).safeTransferFrom(listedItems.seller, msg.sender, tokenId);

        /* 
        We don't send money to the seller..... (PUSH OVER PULL)

        -> sending the money to the user ❌ 
        -> have them withdraw the money ✅
        */

        emit ItemBought(msg.sender, nftAddress, tokenId, listedItems.price);
    }

    /** ----------------------------------------- 3. cancelListing function -----------------------------------------
     * @notice Method to CANCEL/Pullback NFT from Marketplace BY OWNER
     * @param nftAddress: Address of the NFT
     * @param tokenId: Token Id of the NFT
     * @dev here OWNER can remove their NFT from the Listing
     */
    function cancelListing(
        address nftAddress,
        uint256 tokenId
    ) external isOwner(nftAddress, tokenId, msg.sender) isListed(nftAddress, tokenId) {
        delete (s_listing[nftAddress][tokenId]);
        // emiting an event
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    /** ----------------------------------------- 4. updateListing function -----------------------------------------
     * @notice Method to UPDATE NFT price.
     * @param nftAddress: Address of the NFT
     * @param tokenId: Token Id of the NFT
     * @param newPrice: Price of NFT to be updated.
     * @dev here OWNER can Update the price of thier NFT
     */
    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    ) external isListed(nftAddress, tokenId) isOwner(nftAddress, tokenId, msg.sender) {
        // need to update the price
        s_listing[nftAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
    }

    /** ----------------------------------------- 5. withdrawProceeds function -----------------------------------------
     * @notice Method to WITHDRAW assets.
     * @dev here COUSTOMER is allowed to WITHDRAW thier assest
     */
    function withdrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketplace__NoProceeds();
        }
        // Must Update the balance
        s_proceeds[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NftMarketplace__TransferFailed();
        }
    }

    /////////////////////////
    // View/Pure Functions //
    /////////////////////////

    function getListing(address nftAddress, uint256 tokenId) public view returns (Listing memory) {
        return s_listing[nftAddress][tokenId];
    }

    function getProceeds(address seller) public view returns (uint256) {
        return s_proceeds[seller];
    }
}
