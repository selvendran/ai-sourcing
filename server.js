import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dist')));

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const TEAM_PASSCODE = process.env.TEAM_PASSCODE;

// ---------------------------------------------------------------------------
// 1. THE DUAL-PROVIDER AI ROUTER (With explicit error handling)
// ---------------------------------------------------------------------------
async function callAI(messages) {
  // Try DeepSeek first
  if (DEEPSEEK_KEY) {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${DEEPSEEK_KEY}` 
        },
        body: JSON.stringify({ 
          model: 'deepseek-chat', 
          messages, 
          temperature: 0.1
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
      // If DeepSeek returns an error status, log it clearly
      const errorText = await res.text();
      console.warn(`DeepSeek API returned ${res.status}: ${errorText}`);
    } catch (err) {
      console.warn(`DeepSeek connection error: ${err.message}`);
    }
  }

  // Fallback to Groq if DeepSeek fails
  if (GROQ_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({ 
          model: 'llama-3.3-70b-versatile', 
          messages, 
          temperature: 0.1,
          response_format: { type: "json_object" } 
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
      // If Groq returns an error status, log it clearly
      const errorText = await res.text();
      console.warn(`Groq API returned ${res.status}: ${errorText}`);
    } catch (err) {
      console.warn(`Groq connection error: ${err.message}`);
    }
  }

  // If both fail, throw a detailed error
  throw new Error('Both AI providers failed. Check your API keys and internet connection.');
}

// ---------------------------------------------------------------------------
// 2. THE ADVANCED BOOLEAN GENERATOR
// ---------------------------------------------------------------------------
function generateBooleanString(jdStructure) {
  const title = jdStructure?.titles?.[0] || 'Engineer';
  const loc = jdStructure?.location || '';
  const skills = (jdStructure?.skills || []).slice(0, 4);
  const keywords = (jdStructure?.keywords || []).slice(0, 3);

  let query = `site:linkedin.com/in "${title}"`;
  if (loc) query += ` location:${loc}`;
  if (skills.length > 0) {
    const skillQuery = skills.map(s => `"${s}"`).join(' OR ');
    query += ` AND (${skillQuery})`;
  }
  if (keywords.length > 0) {
    const keywordQuery = keywords.map(k => `"${k}"`).join(' OR ');
    query += ` AND (${keywordQuery})`;
  }
  query += ` -jobs -dir -resume`;
  return query;
}

// ---------------------------------------------------------------------------
// 3. THE "REAL BROWSER" HANDLER
// ---------------------------------------------------------------------------
function waitForEnter() {
  return new Promise((resolve) => {
    console.log('\n⏳ Waiting for you to press ENTER in the terminal...');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
  });
}

function scrapeSafariTab() {
  return new Promise((resolve, reject) => {
    const script = `
import sys
import json
from bs4 import BeautifulSoup
import subprocess

script_cmd = '''
tell application "Safari"
    set currentTab to front document
    set htmlContent to source of currentTab
    return htmlContent
end tell
'''
try:
    result = subprocess.run(['osascript', '-e', script_cmd], capture_output=True, text=True, check=True)
    html = result.stdout
    soup = BeautifulSoup(html, 'html.parser')
    
    links = []
    for a in soup.find_all('a', href=True):
        href = a['href']
        if 'linkedin.com/in/' in href and '/jobs/' not in href and '/posts/' not in href:
            title = a.get_text().strip()
            links.append({'link': href, 'title': title})
    
    seen = set()
    unique_links = []
    for l in links:
        if l['link'] not in seen:
            seen.add(l['link'])
            unique_links.append(l)
    
    print(json.dumps(unique_links[:20]))
except Exception as e:
    print(json.dumps([]))
    `;
    
    fs.writeFileSync('/tmp/safari_scraper.py', script);
    
    exec('python3 /tmp/safari_scraper.py', (error, stdout, stderr) => {
      if (error) {
        console.error('Scrape error:', error);
        resolve([]);
        return;
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch {
        resolve([]);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 4. THE MAIN API ROUTE
// ---------------------------------------------------------------------------
app.post('/api/match', async (req, res) => {
  const { jdText, passcode } = req.body;

  if (!jdText) return res.status(400).json({ error: 'JD Text is required' });
  if (passcode !== TEAM_PASSCODE) return res.status(401).json({ error: 'Unauthorized' });

  res.setHeader('Content-Type', 'application/x-ndjson');
  const send = (data) => { if (!res.writableEnded) res.write(JSON.stringify(data) + '\n'); };

  try {
    send({ type: 'status', message: 'Classifying JD into JSON structure...', percent: 10 });
    const structureRaw = await callAI([{ 
      role: 'user', 
      content: `Classify the following Job Description into a valid JSON object.
For "keywords", look for:
1. Seniority indicators: "Lead", "Principal", "Staff", "Architect", "Senior"
2. Impact verbs: "Architected", "Scaled", "Built", "Designed", "Led", "Managed"
3. Soft skills: "Multi-team", "Pod-based", "Mentorship"

Format: {"titles":[], "skills":[], "keywords":[], "experience_years":0, "location":"", "industry":""}.
JD Text: ${jdText}` 
    }]);
    const jdStructure = JSON.parse(structureRaw);
    if (!jdStructure) throw new Error('Failed to parse JD structure from AI.');

    send({ type: 'status', message: 'Generating X-Ray Boolean...', percent: 25 });
    const query = generateBooleanString(jdStructure);

    send({ type: 'status', message: 'Opening Google in Safari. Please confirm results.', percent: 50 });
    
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    exec(`open -a Safari "${url}"`);

    await waitForEnter();

    send({ type: 'status', message: 'Scraping current Safari tab...', percent: 75 });
    
    const profiles = await scrapeSafariTab();

    if (profiles.length === 0) {
      send({ type: 'status', message: 'No LinkedIn profiles found in Safari. Try a broader search.', percent: 100 });
      return res.end();
    }

    send({ type: 'status', message: `Found ${profiles.length} raw profiles. Ranking with AI...`, percent: 85 });

    const rankPrompt = `Rank these profiles against the JD.
JD Structure: ${JSON.stringify(jdStructure)}
Profiles: ${JSON.stringify(profiles)}
Return ONLY a valid JSON array: [{"name": string, "link": string, "score": int, "reasoning": string}].`;

    const rankedRaw = await callAI([{ role: 'user', content: rankPrompt }]);
    let ranked = JSON.parse(rankedRaw);
    
    if (!Array.isArray(ranked)) {
      if (ranked?.candidates && Array.isArray(ranked.candidates)) ranked = ranked.candidates;
      else if (ranked?.results && Array.isArray(ranked.results)) ranked = ranked.results;
      else ranked = [];
    }

    send({ type: 'status', message: 'Ready!', percent: 100 });
    send({ type: 'result', results: ranked.sort((a,b) => (b.score || 0) - (a.score || 0)) });

  } catch (error) {
    console.error('Critical API Error:', error);
    if (!res.writableEnded) {
      send({ type: 'error', message: `Server error: ${error.message}` });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

const PORT = 3001;
app.listen(PORT, () => console.log(`✅ Sourcer Copilot v4.3 running on http://localhost:${PORT}`));
