const { ethers } = require("ethers");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Konfigurasi
const config = {
  BASE_RPC: "https://mainnet.base.org",
  COINGECKO_API: "https://api.coingecko.com/api/v3",
  CACHE_FILE: "price-cache.json",
  CACHE_TTL: 15 * 60 * 1000, // 15 menit
  MIN_BALANCE: 0.01, // Minimum $0.01 untuk ditampilkan
  OUTPUT_FILE: "token-holdings.txt" // File output baru
};

// Baca konfigurasi wallet dari file
function readConfigs() {
  try {
    const data = fs.readFileSync('data.txt', 'utf8').trim();
    const lines = data.split('\n');

    return lines.map(line => {
      const parts = line.trim().split(' - ');
      if (parts.length < 2) {
        throw new Error(`Invalid line format. Expected: "NAME - MNEMONIC"\nGot: "${line}"`);
      }
      
      return {
        name: parts[0],
        mnemonic: parts[1]
      };
    });
  } catch (error) {
    console.error('Error reading data.txt:', error.message);
    process.exit(1);
  }
}

// Load atau inisialisasi cache
function loadCache() {
  try {
    if (fs.existsSync(config.CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(config.CACHE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error("Error loading cache:", error.message);
  }
  return { prices: {}, lastUpdated: 0 };
}

// Simpan cache ke file
function saveCache(cache) {
  try {
    fs.writeFileSync(config.CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.error("Error saving cache:", error.message);
  }
}

// Dapatkan harga dengan cache
async function getCachedPrice(tokenAddress, isEth = false) {
  const cache = loadCache();
  const now = Date.now();
  const cacheKey = isEth ? "ethereum" : tokenAddress.toLowerCase();

  // Jika cache masih valid
  if (cache.prices[cacheKey] && (now - cache.lastUpdated) < config.CACHE_TTL) {
    return cache.prices[cacheKey];
  }

  // Jika cache expired, fetch harga baru
  try {
    let price = 0;
    if (isEth) {
      const response = await axios.get(
        `${config.COINGECKO_API}/simple/price?ids=ethereum&vs_currencies=usd`
      );
      price = response.data.ethereum?.usd || 0;
    } else {
      const response = await axios.get(
        `${config.COINGECKO_API}/simple/token_price/base?contract_addresses=${tokenAddress}&vs_currencies=usd`
      );
      price = response.data[tokenAddress.toLowerCase()]?.usd || 0;
    }

    // Update cache
    cache.prices[cacheKey] = price;
    cache.lastUpdated = now;
    saveCache(cache);

    return price;
  } catch (error) {
    console.error(`Failed to fetch price for ${cacheKey}:`, error.message);
    return cache.prices[cacheKey] || 0; // Fallback ke cache lama jika ada
  }
}

// Format angka kecil
function formatSmallNumber(num) {
  const numStr = num.toString();
  if (numStr.includes('e')) {
    const [base, exponent] = numStr.split('e');
    const exp = parseInt(exponent);
    return num.toFixed(Math.abs(exp) + (base.split('.')[1]?.length || 0));
  }
  return num < 0.0001 ? num.toFixed(10) : num.toFixed(6);
}

// Fungsi untuk menulis output ke file
function writeTokenHoldings(walletName, tokenHoldings,address) {
  const output = [
    `Wallet: ${walletName} (${address})`,
    `Memiliki ${tokenHoldings.length} token:`,
    ...tokenHoldings.map(t => `- ${t.symbol}: ${t.balance}`),
    '────────────────────'
  ].join('\n');

  fs.appendFileSync(config.OUTPUT_FILE, output + '\n', 'utf8');
}

// Scan wallet
async function scanWallet(walletConfig) {
  const provider = new ethers.JsonRpcProvider(config.BASE_RPC);
  const wallet = ethers.Wallet.fromPhrase(walletConfig.mnemonic).connect(provider);
  
  console.log(`\n🔍 Scanning Wallet: ${walletConfig.name}`);
  console.log(`📌 Address: ${wallet.address}`);
  console.log("──────────────────────────────────");

  // 1. Native ETH balance
  const ethBalance = await provider.getBalance(wallet.address);
  const ethBalanceInEth = ethers.formatEther(ethBalance);
  const ethPrice = await getCachedPrice(null, true);
  const ethValue = parseFloat(ethBalanceInEth) * ethPrice;
  
  console.log(`ETH: ${ethBalanceInEth} ($${ethValue.toFixed(2)})`);

  let totalValue = ethValue;
  const tokenHoldings = []; // Untuk menyimpan data token

  // 2. Token balances
  const tokenData = (await axios.get("https://warpslot.fun/api/tokens")).data
  console.log("\n🪙 Token Balances:");
  tokenData.push(	{
		"symbol": "$EGGS",
		"internalSymbol": "EGGS",
		"address": "0x712f43B21cf3e1B189c27678C0f551c08c01D150",
	})  
  for (const token of tokenData) {
    if(token.symbol === "$EGGS"){
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      let balance = await contract.balanceOf(wallet.address);

      // Simpan data token jika memiliki balance
      // Jika balance tidak sama dengan banget
      // get decimal with coingecko
      const decimals = await contract.decimals();
      const balanceInEth = ethers.formatUnits(balance, decimals);
       balance = parseFloat(balanceInEth);
      if(balance !== 0){
        console.log(
          `${token.symbol}: ${balance} `
        );
      tokenHoldings.push({
        symbol: token.symbol,
        balance: balance
      });
    }
    }
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      const balance = await contract.balanceOf(wallet.address);
      const formattedBalance = ethers.formatUnits(balance, token.decimals);
      const balanceNum = parseFloat(formattedBalance);
      
      if (balanceNum > 0) {
        // Gunakan harga dari file jika ada, jika tidak gunakan cache
        const price = token.price || await getCachedPrice(token.address);
        const value = balanceNum * price;
        
        if (value >= config.MIN_BALANCE) {
          console.log(
            `${token.symbol}: ${formattedBalance} ` +
            `(Harga: $${formatSmallNumber(price)} | Nilai: $${value.toFixed(2)})`
          );
          totalValue += value;
          
          // Simpan data token jika memiliki balance
          tokenHoldings.push({
            symbol: token.symbol,
            balance: formattedBalance
          });
        }
      }
    } catch (error) {
      console.error(`Error processing ${token.symbol}:`, error.message);
    }
  }

  // Tulis ke file jika wallet memiliki token selain ETH
  if (tokenHoldings.length > 0) {
    writeTokenHoldings(walletConfig.name, tokenHoldings,wallet.address);
  }
  // tulis ke file jumlah eth juga
  writeTokenHoldings(walletConfig.name, [
    {
      symbol: "ETH",
      balance: ethBalanceInEth + ` ($${ethValue.toFixed(2)})`
    }
  ],wallet.address);

  console.log("──────────────────────────────────");
  console.log(`💰 Total Value: $${totalValue.toFixed(2)}`);
  return totalValue;
}

// ERC20 ABI minimal
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

// Main execution
async function main() {
  // Bersihkan file output sebelumnya jika ada
  if (fs.existsSync(config.OUTPUT_FILE)) {
    fs.unlinkSync(config.OUTPUT_FILE);
  }
  
  const wallets = readConfigs();
  console.log("Starting wallet scan...");
  
  let grandTotal = 0;
  for (const wallet of wallets) {
    grandTotal += await scanWallet(wallet);
    // delay untuk menghindari rate limit
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log("\n💎 Grand Total Across All Wallets: $" + grandTotal.toFixed(2));
  
  // Tambahkan summary ke file output
  if (fs.existsSync(config.OUTPUT_FILE)) {
    const content = fs.readFileSync(config.OUTPUT_FILE, 'utf8');
    fs.writeFileSync(config.OUTPUT_FILE, 
      `Laporan Kepemilikan Token (Non-ETH)\n` +
      `Tanggal: ${new Date().toLocaleString()}\n\n` +
      content +
      `\nTotal Wallet yang Memiliki Token: ${content.split('Wallet:').length - 1}\n`
    );
  } else {
    console.log("\nTidak ada wallet yang memiliki token selain ETH");
  }
}

main().catch(console.error);