// {"text":"test.","embeds":[]}
// https://client.warpcast.com/v2/casts
// Authorization: Bearer MK-AUDcPWlyz8NRsERjZno1zb+bPJebPFbUNGmt6JvvOUiyLzktVFHM8sfEYcgOr/RyN20/Tt8fjew6gE4bawm+2A==
require("dotenv").config()
const axios = require('axios');
const fs = require("fs")
const { ethers } = require('ethers');


let lastAiResponse = null;
// AIzaSyCl0hGu9Xg0iGNLgMaYUvqsvMRBO_gAdtU
async function generateContent() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyCl0hGu9Xg0iGNLgMaYUvqsvMRBO_gAdtU`;
    const headers = { 'Content-Type': 'application/json' };
  
    // Gabungkan prompt menjadi satu bagian (tanpa 'system' role)
    const prompt = `
  You are a crypto genius.
  Generate a chat about news of cryptocurrency today in 200 words, 1 paragraphs.
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
        responseText = responseText.split(' ').slice(0, 150).join(' ');
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
    const response = await axios.post('https://client.warpcast.com/v2/casts', {
      text: `${aigen}`,
      embeds: []
    }, {
      headers: {
        'Authorization': `Bearer ${config.bearerWC}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(config.name)
    console.log(response.data.result.cast.hash)
    // console.log(`Chat message sent for ${config.name}:`, response.data);
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