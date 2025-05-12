require("dotenv").config();
const axios = require('axios');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function chat(config) {
  try {
    const response = await axios.post('https://client.warpcast.com/v2/feed-items', {
      "feedKey": "trending",
      "feedType": "default",
      "castViewEvents": [],
      "updateState": true,
      "sortMode": { "type": "reverse-chron" }
    }, {
      headers: {
        'Authorization': `Bearer ${config.bearerWC}`,
        'Content-Type': 'application/json'
      }
    });

    const items = response.data.result.items.slice(0, 10); // Batas aman
    for (const item of items) {
      try {
        const recastRes = await axios.put('https://client.warpcast.com/v2/recasts', {
          "castHash": item.cast.hash
        }, {
          headers: {
            'Authorization': `Bearer ${config.bearerWC}`,
            'Content-Type': 'application/json'
          }
        });

        console.log("Recast success:", recastRes.data.result.castHash);

        // Delay untuk menjaga batas rate limit
        await sleep(6500); // 6 detik
      } catch (err) {
        console.error("Recast error:", err.response?.data || err.message);
      }
    }
  } catch (error) {
    console.error('Chat API Error:', error.response?.data || error.message);
  }
}

async function main() {
  const configs = JSON.parse(process.env.config);
  
  if (configs.length === 0) {
    console.log('No configurations found in data.txt');
    return;
  }

  console.log(`Found ${configs.length} configurations in data.txt`);
  
  // Process each configuration sequentially
  for (const userConfig of configs) {
    const config = {  ...userConfig };
    await chat(config);
    
    // Small delay between different accounts
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('\nAll configurations processed');
}
// Run the complete process
main();