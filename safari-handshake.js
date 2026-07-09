import { exec } from 'child_process';
import fs from 'fs';
import fetch from 'node-fetch';
import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function waitForEnter() {
  return new Promise((resolve) => {
    console.log('Press ENTER in the terminal after Safari loads the search results...');
    rl.once('line', () => resolve());
  });
}

async function scrapeSafariTab() {
  const script = `
import sys, json, subprocess, re, time
from bs4 import BeautifulSoup

cmd = '''
tell application "Safari"
    set currentTab to front document
    set htmlContent to source of currentTab
    return htmlContent
end tell
'''
try:
    result = subprocess.run(['osascript', '-e', cmd], capture_output=True, text=True, check=True)
    html = result.stdout
    time.sleep(2)
    soup = BeautifulSoup(html, 'html.parser')
    
    links = set()
    for a in soup.find_all('a', href=True):
        href = a['href']
        if 'linkedin.com/in/' in href and '/jobs/' not in href and '/posts/' not in href:
            if href.startswith('/url?q='):
                href = href.split('/url?q=')[1].split('&')[0]
            links.add(href)
    
    if len(links) < 3:
        raw_links = re.findall(r'https?:\/\/(www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+', html)
        for raw_link in raw_links:
            links.add(raw_link)

    print(json.dumps(list(links)[:20]))
except Exception as e:
    print(json.dumps([]))
`;
  fs.writeFileSync('/tmp/safari_scraper.py', script);
  return new Promise((resolve) => {
    exec('python3 /tmp/safari_scraper.py', (error, stdout) => {
      try {
        resolve(JSON.parse(stdout));
      } catch { resolve([]); }
    });
  });
}

async function run() {
  const searchString = process.argv[2];
  if (!searchString) {
    console.error('Please provide a search string as an argument.');
    console.error('Example: node safari-handshake.js "site:linkedin.com/in \\"Engineer at Google\\" -jobs -dir"');
    rl.close();
    return;
  }
  
  const url = `https://www.google.com/search?q=${encodeURIComponent(searchString)}`;
  exec(`open -a Safari "${url}"`);
  await waitForEnter();

  const profiles = await scrapeSafariTab();
  if (profiles.length === 0) {
    console.log('No LinkedIn profiles found. Did you solve the CAPTCHA?');
    return;
  }

  const ingestData = profiles.map(p => ({
    id: p.split('/in/')[1]?.split('/')[0] || `profile-${Date.now()}`,
    name: p.split('/in/')[1]?.split('/')[0]?.replace(/-/g, ' ') || 'LinkedIn Profile',
    title: 'Engineer',
    url: p,
    company: '',
    location: '',
    years: 0,
    source: 'linkedin',
    skills: [],
    impact_score: 0,
    text: p
  }));

  const API_KEY = process.env.SOURCING_API_KEY;
  if (!API_KEY) {
    console.error('Set SOURCING_API_KEY in your environment before running this script.');
    rl.close();
    return;
  }

  const workerUrl = 'https://sourcing-engine.sourcing-engine.workers.dev/ingest';
  
  // 🔥 FIXED: Added error handling and a debug log
  console.log(`Sending ${profiles.length} profiles to /ingest...`);
  const resp = await fetch(workerUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-api-key': API_KEY
    },
    body: JSON.stringify({ query: searchString, profiles: ingestData })
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    console.error(`❌ Ingest failed with status ${resp.status}: ${errorText}`);
    rl.close();
    return;
  }

  const result = await resp.json();
  console.log(`✅ Ingested ${result.ingested} profiles into D1 database.`);
  rl.close();
}

run().catch(console.error);
