const { ethers } = require('ethers');
const axios = require('axios');
const fs = require('fs');

// Read configurations from data.txt
function readConfigs() {
  try {
    const data = fs.readFileSync('data.txt', 'utf8').trim();
    const lines = data.split('\n');

    return lines.map(line => {
      const parts = line.trim().split(' - ');
      if (parts.length !== 3) {
        throw new Error(`Invalid line format. Expected: "NAME - MNEMONIC - AUTH_TOKEN"\nGot: "${line}"`);
      }
      
      const wallet = ethers.Wallet.fromPhrase(parts[1]); // Create wallet from mnemonic

      return {
        name: parts[0],
        mnemonic: parts[1],
        ethAddress: wallet.address, // Derive ethAddress from mnemonic
        authToken: parts[2]
      };
    });
  } catch (error) {
    console.error('Error reading data.txt:', error.message);
    process.exit(1);
  }
}

// Main configuration
const baseConfig = {
  providerUrl: "https://mainnet.base.org",
  contractAddress: '0x712f43B21cf3e1B189c27678C0f551c08c01D150',
  apiEndpoint: 'https://backend.eggs.name/'
};

async function fetchClaimableEggs(config) {
  try {
    const response = await axios.post(config.apiEndpoint, {
      query: `mutation claimAllEggs {
        claimAllEggs(ethAddress:"${config.ethAddress}") {
          address amount createdAt id message r serialId signature updatedAt used userId vs
        }
      }`,
      operationName: "claimAllEggs",
      extensions: {}
    }, {
      headers: {
        'Authorization': config.authToken,
        'Content-Type': 'application/json'
      }
    });

    return response.data.data.claimAllEggs;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    throw error;
  }
}

async function redeemTicket(config, claimData) {
    try {
        const provider = new ethers.JsonRpcProvider(config.providerUrl);
        const wallet = ethers.Wallet.fromPhrase(config.mnemonic).connect(provider);
      
        const contractABI = [
          "function redeemTicket(bytes memory data, bytes32 r, bytes32 vs) external",
          "event TicketRedeemed(address indexed user, uint256 ticketId, uint256 amount)"
        ];
      
        const contract = new ethers.Contract(config.contractAddress, contractABI, wallet);
      
        try {
          // Prepare transaction
          const data = ethers.getBytes(claimData.message);
          const r = claimData.r;
          const vs = claimData.vs;
          
          // Convert amount to wei string to avoid floating point issues
          const amountWei = ethers.parseEther(claimData.amount.toString()).toString();
          
          console.log(`\nProcessing ticket ${claimData.serialId} for ${claimData.amount} ETH (${amountWei} wei)...`);
      
          // Estimate gas with fallback
          let gasEstimate;
          try {
            gasEstimate = await contract.redeemTicket.estimateGas(data, r, vs);
            console.log(`Gas estimate: ${gasEstimate.toString()}`);
          } catch (e) {
            console.log('Using default gas estimate');
            gasEstimate = ethers.toBigInt(300000);
          }
      
          // Get current gas prices
          const feeData = await provider.getFeeData();
          const tx = {
            to: config.contractAddress,
            data: contract.interface.encodeFunctionData("redeemTicket", [data, r, vs]),
            gasLimit: gasEstimate * 2n,
            maxFeePerGas: feeData.maxFeePerGas ?? ethers.parseUnits("0.0025", "gwei"),
            maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? ethers.parseUnits("0.0025", "gwei"),
            chainId: (await provider.getNetwork()).chainId
          };
      
          // Send transaction
          const txResponse = await wallet.sendTransaction(tx);
          console.log(`Tx sent: ${txResponse.hash}`);
          console.log(`BaseScan: https://basescan.org/tx/${txResponse.hash}`);
      
          const receipt = await txResponse.wait();
          console.log(`Confirmed in block ${receipt.blockNumber}`);
      
          // Check for success
          if (receipt.status === 1) {
            console.log(`✅ Successfully redeemed ticket ${claimData.serialId}`);
            return true;
          } else {
            console.log(`❌ Ticket redemption failed for ${claimData.serialId}`);
            return false;
          }
      
        } catch (error) {
          console.error(`Error redeeming ticket ${claimData.serialId}:`, error.message);
          
          if (error.info?.error?.message.includes("execution reverted")) {
            console.log('Reason:', error.info.error.message);
          }
          
          return false;
        }
    } catch (error) {
        console.error('Error redeeming ticket:', error.message);
        return false;
    }
}

async function processClaimsForConfig(config) {
  try {
    console.log(`\n=== Processing claims for ${config.name} (${config.ethAddress}) ===`);
    const claims = await fetchClaimableEggs(config);
    
    if (!claims || claims.length === 0) {
      console.log('No claimable eggs found');
      return;
    }

    console.log(`Found ${claims.length} claimable eggs`);
    
    // Process each claim sequentially
    for (const claim of claims) {
      if (claim.used) {
        console.log(`Skipping already used ticket ${claim.serialId}`);
        continue;
      }

      await redeemTicket(config, claim);
      
      // Small delay between transactions
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`Finished processing for ${config.name}`);
  } catch (error) {
    console.error(`Process failed for ${config.name}:`, error.message);
  }
}

async function main() {
  const configs = readConfigs();

  
  if (configs.length === 0) {
    console.log('No configurations found in data.txt');
    return;
  }

  console.log(`Found ${configs.length} configurations in data.txt`);
  
  // Process each configuration sequentially
  for (const userConfig of configs) {
    const config = { ...baseConfig, ...userConfig };
    await processClaimsForConfig(config);
    
    // Small delay between different accounts
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('\nAll configurations processed');
}

// Run the complete process
main();