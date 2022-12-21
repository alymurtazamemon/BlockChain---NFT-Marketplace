const { ethers } = require("hardhat")

const PRICE = ethers.utils.parseEther("0.1")

async function mintAndList() {
    const nftMarketplace = await ethers.getContract("NftMarketplace")
    const basicNft = await ethers.getContract("BasicNft")

    console.log("Minting.....")
    const txResponse = await basicNft.mintNft()
    const txReceipt = await txResponse.wait(1)
    const tokenId = txReceipt.events[0].args.tokenId

    console.log("Approving NftMarketplace....")
    const approveResponse = await basicNft.approve(nftMarketplace.address, tokenId)
    await approveResponse.wait(1)

    console.log("Listing NFT....")
    const tx = await nftMarketplace.listItem(basicNft.address, tokenId, PRICE)
    await tx.wait(1)
}

mintAndList()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
