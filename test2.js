const { ethers } = require('ethers');
const axios = require('axios');
require("dotenv").config();

const config = {
  providerUrl: "https://mainnet.base.org",
  contractAddress: '0x712f43B21cf3e1B189c27678C0f551c08c01D150',
  apiEndpoint: 'https://backend.eggs.name/',
  ethAddress: "",
  authToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbThvaDl4YmgwMmZ4cnFiN2wxZGptcnJ0IiwiaWF0IjoxNzQzMzA4Nzg4fQ.eO3gPjfPJqzL2Cvg3JBM8f3r4yzXHvkVXPPrm5IlXPs",
  mnemonic: "iron monster endorse neutral borrow palace sport lesson soccer tide bid shield"
};

async function fetchClaimableEggs() {
  try {

    // const getserial = await axios.post(config.apiEndpoint, {"operationName":"getMyData","query":"query getMyData {\n  getMe {\n    serialId\n    id\n    avatar\n    totalDailyYield\n    unclaimedEggs\n    totalJackpotTicketsClaimed\n    shouldDisplayJackpotPreviewData\n    hens {\n      id\n      serialId\n      name\n      dailyYield\n      level\n    }\n    didClaimCurrentJackpot\n    isAirdropUser\n    getJackpotTicketsCount\n    claimStreak {\n      claimedToday\n      claimNumber\n    }\n    getJackpotTickets {\n      type\n      amount\n    }\n  }\n}","variables":{}}
    // , {
    //   headers: {
    //     'Authorization': config.authToken,
    //     'Content-Type': 'application/json'
    //   }
    // });
    // const serialId = getserial.data.data.getMe.hens[0].serialId;
    
    const response = await axios.post(config.apiEndpoint, {
      "query":"query MyQuery{getMe{hens{userId}}}",
      "operationName":"MyQuery"
    }, 
        {
      headers: {
        'Authorization': config.authToken,
        'Content-Type': 'application/json'
      }
    });
    console.log(response.data.data.getMe.hens)
    return response.data;
  } catch (error) {
    console.error('API Error:', error.response?.data || error.message);
    return [];
  }
}

async function levelUpChicken(claimData) {
  try {
    const provider = new ethers.JsonRpcProvider(config.providerUrl);
    const wallet = ethers.Wallet.fromPhrase(config.mnemonic).connect(provider);
    console.log(claimData)
    const contract = new ethers.Contract(config.contractAddress, [
      "function levelUpChicken(bytes memory data, bytes32 r, bytes32 vs) external"
    ], wallet);

    const data = ethers.getBytes(claimData.encodedData);
    const tx = await contract.levelUpChicken(data, claimData.r, claimData.vs);
    console.log(`Tx sent: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Chicken ${claimData.serialId} leveled up successfully`);
  } catch (error) {
    console.error(`Error leveling up chicken ${claimData.serialId}:`, error.message);
  }
}

async function processClaims() {
    const wallet = ethers.Wallet.fromPhrase(config.mnemonic); // Create wallet from mnemonic
    config.ethAddress = wallet.address; // Derive ethAddress from mnemonic
  console.log(`Processing claims for ${config.ethAddress}...`);
  const claims = await fetchClaimableEggs();
  
    await levelUpChicken(claims.data.generateChickenLevelUpgrade);
    await new Promise(res => setTimeout(res, 2000));
}

processClaims();
