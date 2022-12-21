const { expect, assert } = require("chai")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("NftMarketplace testing", () => {
          let deployer, nftMarketplace, player, basicNft
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async () => {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              player = accounts[1]

              await deployments.fixture(["all"])

              nftMarketplace = await ethers.getContract("NftMarketplace", deployer)
              basicNft = await ethers.getContract("BasicNft", deployer)
              // minting of nft :: here, DEPLOYER is calling .mintNft() and .approve(....)
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
              // Remember, NftMarketplace can't call APPROVE becoz it doesn't own any NFT
          })

          describe("listItem fn testing", () => {
              it("Reverts when price<= 0", async () => {
                  await expect(
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, 0)
                  ).to.be.revertedWith("NftMarketplace__PriceMustBeAboveZero")
              })

              it("emits an event when Item is listed", async () => {
                  await expect(
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.emit("ItemListed")
              })

              it("Need approval to list the item", async () => {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) // nftMarketplace -> not approved
                  ).to.be.revertedWith("NftMarketplace__NotApprovedForMarketplace")
              })

              // Modifier testing
              it("Only owner is allowed to list the Item", async () => {
                  nftMarketplace = nftMarketplace.connect(player) // ????????
                  await basicNft.approve(player.address, TOKEN_ID) // ????????
                  await expect(
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE) // player is not the OWNER
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })

              // modifier testing
              it("Only adds items that haven't been listed", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const error = `AlreadyListed(${basicNft.address}, ${TOKEN_ID})`
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })

              it("Updates listing with seller and price", async () => {
                  await basicNft.approve(nftMarketplace.address, TOKEN_ID)
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)

                  const price = await nftMarketplace.getListing(basicNft.address, TOKEN_ID).price
                  const seller = await nftMarketplace.getListing(basicNft.address, TOKEN_ID).seller

                  assert.equal(price.toString(), "0.1")
                  assert.equal(seller.toString(), deployer.address)
              })
          })

          describe("cancelListing testing", () => {
              it("reverts if NFT is not present", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const error = `NotListed("${basicNft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, 1)
                  ).to.be.revertedWith(error)
              })

              it("reverts if someone but the owner tries to remove NFT", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplace.connect(player)
                  await basicNft.approve(player.address, TOKEN_ID)

                  await expect(
                      nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })

              it("emits an event when listing is canceled", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )

                  const price = await nftMarketplace.getListing(basicNft.address, TOKEN_ID).price
                  assert.equal(price.toString(), "0")
              })
          })

          describe("updateListing Testing", () => {
              it("Price can only be updated by the owner && NFT should be listed", async () => {
                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotListed")

                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplace.connect(player)

                  await expect(
                      nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NftMarketplace__NotOwner")
              })

              it("Updates the price of the item", async () => {
                  const newPrice = ethers.utils.parseEther("1")
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, newPrice) // ********
                  expect(
                      await nftMarketplace.updateListing(basicNft.address, TOKEN_ID, updatedPrice)
                  ).to.emit("ItemListed")

                  const curentPrice = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                      .price
                  assert.equal(curentPrice.toString(), newPrice.toString())
              })
          })

          describe("buyItem Testing", async () => {
              it("reverts if NFT is not listed", async () => {
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NftMarketplace__NotListed")
              })

              it("reverts if the price isn't met", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("PriceNotMet")
              })

              it("Update the proceeds of the seller &&  transfer NFT to the buyer", async () => {
                  await nftMarketplace.listItem(basicNft, TOKEN_ID, PRICE)
                  //   await nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                  nftMarketplace = nftMarketplace.connect(user)
                  await expect(
                      await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                  ).to.emit("ItemBought")

                  const newOwner = await basicNft.ownerOf(TOKEN_ID)
                  const deployerProceeds = await nftMarketplace.getProceeds(TOKEN_ID)

                  assert(newOwner.toString() == user.address)
                  assert(deployerProceeds.toString() == PRICE.toString())
              })
          })

          describe("withdrawProceeds testing", async () => {
              it("revert if proceed is <= 0", async () => {
                  await expect(await nftMarketplace.withdrawProceeds()).to.be.revertedWith(
                      "NftMarketplace__NoProceeds"
                  )
              })

              it("Paying back the seller", async () => {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  nftMarketplace = nftMarketplace.connect(player)
                  await nftMarketplace.buyItem(basicNft, TOKEN_ID, { value: PRICE })
                  nftMarketplace = nftMarketplace.connect(deployer)

                  const proceedsCollected = await nftMarketplace.getProceeds(deployer.address)
                  const prevBalanceOfSeller = await deployer.getBalance() // ***
                  const txResponse = await nftMarketplace.withdrawProceeds()
                  const txReceipt = await txResponse.wait(1)

                  const { gasUsed, effectiveGasPrice } = txReceipt
                  const totalGasCost = gasUsed.mul(effectiveGasPrice)
                  const currentBalanceOfSeller = await deployer.getBalance() // ***

                  assert(
                      currentBalanceOfSeller.sub(proceedsCollected).toString() ==
                          prevBalanceOfSeller.sub(totalGasCost).toString()
                  )
              })
          })
      })
