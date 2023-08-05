// require("@nomiclabs/hardhat-waffle")
require("@nomicfoundation/hardhat-toolbox")
// require("@nomiclabs/hardhat-etherscan")
require("@nomiclabs/hardhat-ethers")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("dotenv").config()

//用于告诉程序按照本地代理链接网络
const { ProxyAgent, setGlobalDispatcher } = require("undici")
const proxyAgent = new ProxyAgent("http://172.26.80.1:7890")
setGlobalDispatcher(proxyAgent)

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: "0.8.19",
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },
        sepolia: {
            chainId: 11155111,
            url: process.env.RPC_URL,
            accounts: [process.env.PRIVATE_KEY],
            blockConfirmations: 6,
        },
    },
    gasReporter: {
        enabled: false,
        outputFile: "gasReport.txt",
        noColors: true,
        currency: "USD",
        coinmarketcap: process.env.COINMARKET_API_KEY,
        token: "ETH",
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY,
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    mocha: {
        setTimeout: 3000000,
    },
}
