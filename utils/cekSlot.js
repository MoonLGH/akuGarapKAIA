const API_BASE = 'https://www.warpslot.fun/api';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
const REFERER = 'https://www.warpslot.fun/';
const fs = require('fs');

const headers = {
    'User-Agent': UA,
    'Referer': REFERER,
    'Content-Type': 'application/json',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
    'sec-ch-ua-mobile': '?0',
    'Accept': '*/*',
    'Origin': 'https://www.warpslot.fun',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Storage-Access': 'active',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'en-US,en;q=0.9'
};

async function cekKetersediaan(fid) {
    const response = await fetch(`${API_BASE}/user?fid=${fid}`, { headers });
    if (!response.ok) return null;
    return await response.json();
}

async function getCsrfToken(fid) {
    const response = await fetch(`${API_BASE}/csrf-token?fid=${fid}`, { headers });
    if (!response.ok) return null;
    const data = await response.json();
    return data; // Pastikan hanya mengembalikan token
}

async function doSpin(fid) {
    const tokenData = await getCsrfToken(fid);
    if (!tokenData) {
        console.error("Gagal mendapatkan token CSRF");
        return null;
    }
    
    const spinHeaders = { 
        ...headers, 
        'X-SPIN-TOKEN': JSON.stringify(tokenData) // Pastikan format JSON sesuai
    };

    const body = JSON.stringify({"spinToken":tokenData,"visitorId":"64bbd1c4ae5ecaf3658f8c8604fbecb0"});

    const response = await fetch(`${API_BASE}/spin`, {
        method: 'POST',
        headers: spinHeaders,
        body
    });

    if (!response.ok) {
        console.warn("Spin request failed:", await response.text());
        return null;
    }
    return await response.json();
}


function readConfigs() {
  try {
    const data = fs.readFileSync('data2.txt', 'utf8').trim();
    const lines = data.split('\n');

    return lines.map(line => {
      const parts = line.trim().split(' - ');
      if (parts.length !== 2) {
        throw new Error(`Invalid line format. Expected: "NAME - MNEMONIC - AUTH_TOKEN"\nGot: "${line}"`);
      }
      
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



(async () => {
    const configs = readConfigs();

    console.log(`Found ${configs.length} configurations in data.txt`);
    
    // Process each configuration sequentially
    
    // cek ketersediaan 
    for (const userConfig of configs) {
      const { fid } = userConfig;
      const user = await cekKetersediaan(fid);
      const ketersediaan = user.spins_remaining;
      
        // loop sesuai ketersediaan
        if (ketersediaan === 0) {
            console.log(`Tidak ada spin yang tersedia untuk ${userConfig.name} (${fid})`);
            continue;
        }
        console.log(`Ketersediaan spin untuk ${userConfig.name} (${fid}): ${ketersediaan}`);

        // run spin
        for (let i = 0; i < ketersediaan; i++) {
            console.log(`Melakukan spin ke-${i + 1} untuk ${userConfig.name} (${fid})`);
            const result = await doSpin(fid);
            console.log("Hasil spin:", result);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
      await new Promise(resolve => setTimeout(resolve, 5000));

})();