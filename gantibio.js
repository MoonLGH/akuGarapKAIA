// {"displayName":"Yes","bio":"","location":{"description":"Jakarta, Indonesia","placeId":"ChIJnUvjRenzaS4RoobX2g-_cVM"}}
// PATCH /v2/me HTTP/1.1
// https://client.warpcast.com/v2/me
// Authorization: Bearer MK-r6KZg/EZaqCgFUJ00l1VIp3X/qLzTxdoAFL0sZY9Xpp462Ks2KfwUtSpNmIs+lCYwjH/yPYBsy0RYpnGBbJM6A==

require("dotenv").config()
const axios = require('axios');
const fs = require("fs")
const { ethers } = require('ethers');
function readConfigs() {
  try {
    const data = fs.readFileSync('data.txt', 'utf8').trim();
    const lines = data.split('\n');

    return lines.map(line => {
      const parts = line.trim().split(' - ');
      const wallet = ethers.Wallet.fromPhrase(parts[1]); // Create wallet from mnemonic

      return {
        name: parts[0],
        mnemonic: parts[1],
        ethAddress: wallet.address, // Derive ethAddress from mnemonic
        authToken: parts[2],
        bearerWC: parts[3]
      };
    });
  } catch (error) {
    console.error('Error reading data.txt:', error.message);
    process.exit(1);
  }
}

let lastAiResponse = null;
// AIzaSyCl0hGu9Xg0iGNLgMaYUvqsvMRBO_gAdtU
async function generateContent() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyCl0hGu9Xg0iGNLgMaYUvqsvMRBO_gAdtU`;
    const headers = { 'Content-Type': 'application/json' };
  
    // Gabungkan prompt menjadi satu bagian (tanpa 'system' role)
    const prompt = `
  Describe this day with a beautiful words in 100 words 1 paragraph.
  `;
  
    const data = {
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    };
  
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await axios.post(url, data, { headers });
        const aiResponse = response.data;
  
        let responseText = aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || '';
//   potong responseText menjadi 300 kata
        responseText = responseText.split(' ').slice(0, 30).join(' ');
        if (responseText === lastAiResponse) {
          console.log("⚠️ AI memberikan balasan yang sama, mencoba ulang...");
          continue;
        }
  
        return responseText;
      } catch (error) {
        console.log(`⚠️ Request failed: ${error.response?.data?.error?.message || error.message}`);
        return null;
      }
    }
  
    return null;
  }
  

async function chat(config) {
    const aigen = await generateContent();
  try {

    console.log(aigen)
    const response = await axios.patch('https://client.warpcast.com/v2/me', {
        "displayName": config.name,
        "bio": aigen,
        "location": {
            "description": "Jakarta, Indonesia",
            "placeId": "ChIJnUvjRenzaS4RoobX2g-_cVM"
        }
        }, {
        headers: {
            'Authorization': `Bearer ${config.bearerWC}`,
            'Content-Type': 'application/json'
        }
        });
    console.log(config.name)
    console.log(response.data)
    // console.log(`Chat message sent for ${config.name}:`, response.data);
  } catch (error) {
    console.log(error)
    console.error('Chat API Error:', error.response?.data || error.message);
  }
}

async function main() {
    const configs = readConfigs();
    console.log(configs)
    
    if (configs.length === 0) {
      console.log('No configurations found in data.txt');
      return;
    }
  
    console.log(`Found ${configs.length} configurations in data.txt`);
    
    // Process each configuration sequentially
    for (const userConfig of configs) {
      const config = {...userConfig };
      await chat(config);
      
      // Small delay between different accounts
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  
    console.log('\nAll configurations processed');
  }
  
// Run the complete process
main();