

require("dotenv").config()
const axios = require('axios');
const fs = require("fs")
function readConfigs() {
  try {
    const data = fs.readFileSync('data2.txt', 'utf8').trim();
    const lines = data.split('\n');

    return lines.map(line => {
      const parts = line.trim().split(' - ');

      return {
        name: parts[0],
        fid: parts[1],
      };
    });
  } catch (error) {
    console.error('Error reading data.txt:', error.message);
    process.exit(1);
  }
}

  

async function chat(config) {
  try {
// https://explorer.neynar.com/api/neynar/author?identifier=FID
    const url = `https://explorer.neynar.com/api/neynar/author?identifier=${config.fid}`;

    const response = await axios.get(url);
    console.log(config.name)
    console.log(response.data.author.experimental.neynar_user_score)
  } catch (error) {
    console.log(error)
    console.error('Chat API Error:', error.response?.data || error.message);
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
      const config = {...userConfig };
      await chat(config);
      
      // Small delay between different accounts
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  
    console.log('\nAll configurations processed');
  }
  
// Run the complete process
main();