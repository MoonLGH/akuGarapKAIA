const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');

let cachedEthPrice = null; // Cache harga ETH

// Read configurations from data.txt
function readConfigs() {
  try {
    const data = fs.readFileSync('data.txt', 'utf8').trim();
    const lines = data.split('\n');
    
    return lines.map(line => {
      const parts = line.trim().split(' - ');
      if (parts.length !== 3) {
        throw new Error(`Invalid line format in data.txt`);
      }
      return {
        name: parts[0],
        mnemonic: parts[1],
      };
    });
  } catch (error) {
    console.error('Error reading data.txt:', error.message);
    process.exit(1);
  }
}

// Read token list from tokens.json
function readTokenList() {
  try {
    const data = require("./token.json")
    return data
  } catch (error) {
    console.error('Error reading tokens.json:', error.message);
    process.exit(1);
  }
}

const baseConfig = {
  providerUrl: "https://mainnet.base.org",
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

async function transferToken(config, token) {
  try {
    const provider = new ethers.JsonRpcProvider(config.providerUrl);
    const wallet = ethers.Wallet.fromPhrase(config.mnemonic).connect(provider);
    const contractABI = [
      "function balanceOf(address owner) view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)"
    ];
    const contract = new ethers.Contract(token.address, contractABI, wallet);
    
    // Get token balance
    const balance = await contract.balanceOf(wallet.address);
    if (balance <= 0) {
      console.log(`No ${token.symbol} tokens to transfer`);
      return;
    }
    
    console.log(`Transferring ${ethers.formatUnits(balance, token.decimals)} ${token.symbol} to ${config.destinationWallet}...`);
    const tx = await contract.transfer(config.destinationWallet, balance);
    await tx.wait();
    console.log(`${token.symbol} transferred: https://basescan.org/tx/${tx.hash}`);
  } catch (error) {
    console.error(`${token.symbol} transfer error:`, error.message);
  }
}

async function main() {
  const configs = readConfigs();
  const tokens = readTokenList();
  await getEthPrice(); // Get ETH price once before loop

  for (const userConfig of configs) {
    console.log(`\nProcessing wallet: ${userConfig.name}`);
    const config = { ...baseConfig, ...userConfig };
    
    // Transfer all tokens
    for (const token of tokens) {
      await transferToken(config, token);
    }
    
    // Transfer remaining ETH
    await transferETH(config);
  }
  console.log('\nAll wallets processed');
}

main();