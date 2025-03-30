const { ethers } = require('ethers');
const axios = require('axios');
require("dotenv").config()
let cachedEthPrice = null; // Cache harga ETH

// Read configurations from data.txt

const baseConfig = {
  providerUrl: "https://mainnet.base.org",
  contractAddress: '0x712f43B21cf3e1B189c27678C0f551c08c01D150', // Token $EGGS
  destinationWallet: '0xe4106984915b85ee5ca92ffc4db590c05a8939aa',
  usdToLeave: 0.03 // Leave 0.03 USD worth of ETH
};

async function getEthPrice(retries = 3, delayMs = 5000) {
  if (cachedEthPrice !== null) {
    console.log(`Using cached ETH price: $${cachedEthPrice}`);
    return cachedEthPrice;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
      cachedEthPrice = response.data.ethereum.usd;
      console.log(`Fetched ETH price: $${cachedEthPrice}`);
      return cachedEthPrice;
    } catch (error) {
      console.error(`Error fetching ETH price (attempt ${i + 1}):`, error.message);
      
      if (error.response && error.response.status === 429) {
        console.log(`Rate limited. Retrying in ${delayMs / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }

  console.log("Failed to fetch ETH price after retries. Stopping execution to prevent incorrect calculations.");
  process.exit(1);
}

async function transferETH(config) {
  try {
    const provider = new ethers.JsonRpcProvider(config.providerUrl);
    const wallet = ethers.Wallet.fromPhrase(config.mnemonic).connect(provider);
    const balance = await provider.getBalance(wallet.address);
    const ethPrice = await getEthPrice();
    const ethToLeave = ethers.parseEther((config.usdToLeave / ethPrice).toFixed(18));
    const feeData = await provider.getFeeData();
    const gasLimit = ethers.toBigInt(21000);
    const maxFee = gasLimit * (feeData.maxFeePerGas ?? ethers.parseUnits("0.0025", "gwei"));
    
    const amountToSend = balance - ethToLeave - maxFee;
    if (amountToSend <= 0) {
      console.log("Not enough ETH to transfer");
      return;
    }
    
    const tx = await wallet.sendTransaction({
      to: config.destinationWallet,
      value: amountToSend,
      gasLimit,
      maxFeePerGas: feeData.maxFeePerGas,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    });
    console.log(`ETH transferred: https://basescan.org/tx/${tx.hash}`);
    await tx.wait();
  } catch (error) {
    console.error("ETH transfer error:", error.message);
  }
}

async function transferAllEggs(config) {
  try {
    const provider = new ethers.JsonRpcProvider(config.providerUrl);
    const wallet = ethers.Wallet.fromPhrase(config.mnemonic).connect(provider);
    const contractABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)"
    ];
    const contract = new ethers.Contract(config.contractAddress, contractABI, wallet);
    
    // Get balance of $EGGS tokens
    const balance = await contract.balanceOf(wallet.address);
    if (balance <= 0) {
      console.log("No $EGGS tokens to transfer");
      return;
    }
    
    console.log(`Transferring ${ethers.formatUnits(balance, 18)} $EGGS to ${config.destinationWallet}...`);
    const tx = await contract.transfer(config.destinationWallet, balance);
    await tx.wait();
    console.log(`$EGGS transferred: https://basescan.org/tx/${tx.hash}`);
  } catch (error) {
    console.error("$EGGS transfer error:", error.message);
  }
}

async function main() {
  const configs = JSON.parse(process.env.config);
  await getEthPrice(); // Ambil harga ETH sekali sebelum loop

  for (const userConfig of configs) {
    console.log(`Processing wallet: ${userConfig.name}`);
    const config = { ...baseConfig, ...userConfig };
    await transferAllEggs(config);
    await transferETH(config);
  }
  console.log('All wallets processed');
}

main();
