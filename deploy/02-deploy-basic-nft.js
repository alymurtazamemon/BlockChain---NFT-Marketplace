const { VERIFICATION_BLOCK_CONFIRMATIONS } = require("../helper-hardhat-config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts()
    const { deploy, log } = deployments

    const args = []

    const basicNft = await deploy("BasicNft", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: VERIFICATION_BLOCK_CONFIRMATIONS,
    })

    // VERIFICATION : if not deployed on LocalHost
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying......")
        await verify(basicNft.address, args)
    }
}

module.exports.tags = ["all", "basicNft"]
