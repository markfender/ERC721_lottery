import dotenv from 'dotenv'
dotenv.config();

import "@nomiclabs/hardhat-truffle5";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-web3";

import "solidity-coverage";

/**
 * @type import('hardhat/config').HardhatUserConfig
 */

const {
  INFURA_KEY,
  INFURA_KEY_KOVAN,
  ALCHEMY_KEY,
  MNEMONIC,
  ETHERSCAN_API_KEY,
  PRIVATE_KEY,
  PRIVATE_KEY_TESTNET
} = process.env;

const accountsTestnet = PRIVATE_KEY_TESTNET
  ? [PRIVATE_KEY_TESTNET]
  : {mnemonic: MNEMONIC};

const accountsMainnet = PRIVATE_KEY
  ? [PRIVATE_KEY]
  : {mnemonic: MNEMONIC};

module.exports = {
  solidity: "0.8.10",

  networks: {
    hardhat: {
      forking: {
        url: `https://eth-rinkeby.alchemyapi.io/v2/${ALCHEMY_KEY}`, //move key to alchemy
        blockNumber: 9779277
      }
    },
    /*mainnet: {
        url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    },*/
    rinkeby: {
        url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
        accounts: accountsTestnet,
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_KEY_KOVAN}`,
      accounts: accountsTestnet,
    }
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY
  }
};
