const { VERIFICATION_BLOCK_CONFIRMATIONS } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
require("dotenv").config()

const { network } = require("hardhat")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts()
    const { deploy, log } = deployments

    const args = []

    const nftMarketplace = await deploy("NftMarketplace", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: VERIFICATION_BLOCK_CONFIRMATIONS,
    })

    // VERIFICATION : if not deployed on LocalHost
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying......")
        await verify(nftMarketplace.address, args)
    }

    log("------------------------------------------------------------------------------")
}

module.exports.tags = ["all", "nftMarketPlace"]
