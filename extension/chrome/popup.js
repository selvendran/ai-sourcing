// Works unmodified in Chrome, Edge, and Firefox: `browser` is the standard
// promise-based API (Firefox natively, Chrome/Edge via this fallback).
const api = typeof browser !== 'undefined' ? browser : chrome;

const WORKER_URL = 'https://sourcing-engine.sourcing-engine.workers.dev';

const keyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveKey');
const scrapeBtn = document.getElementById('scrapeBtn');
const jdInput = document.getElementById('jdText');
const statusEl = document.getElementById('status');
const registerPanel = document.getElementById('registerPanel');
const registerBtn = document.getElementById('registerBtn');

// Show the one-time registration panel if we don't have a key yet;
// otherwise restore the previously issued/pasted key.
api.storage.local.get(['ingestApiKey']).then(({ ingestApiKey }) => {
  if (ingestApiKey) {
    keyInput.value = ingestApiKey;
    registerPanel.style.display = 'none';
  } else {
    registerPanel.style.display = 'block';
  }
});

registerBtn.addEventListener('click', async () => {
  const email = document.getElementById('regEmail').value.trim();
  const name = document.getElementById('regName').value.trim();
  const company = document.getElementById('regCompany').value.trim();
  const mobile = document.getElementById('regMobile').value.trim();
  const consent = document.getElementById('regConsent').checked;

  if (!email || !name || !company) {
    statusEl.textContent = 'Email, name, and company are required.';
    return;
  }
  if (!consent) {
    statusEl.textContent = 'Please check the consent box to continue.';
    return;
  }

  statusEl.textContent = 'Registering...';
  try {
    const res = await fetch(`${WORKER_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, company, mobile, consent }),
    });
    const data = await res.json();

    if (res.status === 429) {
      statusEl.textContent = 'Too many attempts — wait a moment and try again.';
      return;
    }
    if (!res.ok) {
      statusEl.textContent = `Registration failed: ${data.error || res.status}`;
      return;
    }

    await api.storage.local.set({ ingestApiKey: data.api_key });
    keyInput.value = data.api_key;
    registerPanel.style.display = 'none';
    statusEl.textContent = '✅ Registered! You can now scrape and search.';
  } catch (err) {
    statusEl.textContent = `Network error: ${err.message}`;
  }
});

saveBtn.addEventListener('click', async () => {
  await api.storage.local.set({ ingestApiKey: keyInput.value.trim() });
  registerPanel.style.display = 'none';
  statusEl.textContent = 'API key saved.';
});

scrapeBtn.addEventListener('click', async () => {
  const { ingestApiKey } = await api.storage.local.get(['ingestApiKey']);
  if (!ingestApiKey) {
    statusEl.textContent = 'Save an ingest-scoped API key first (see the "Ingest API Key" field above).';
    return;
  }

  statusEl.textContent = 'Reading current tab...';

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusEl.textContent = 'Could not find the active tab.';
    return;
  }

  let injectionResults;
  try {
    injectionResults = await api.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (err) {
    // Common cause: the active tab is a browser-internal page (chrome://,
    // about:, the extension's own popup) that scripts can't be injected into.
    statusEl.textContent = `Could not read this tab: ${err.message}`;
    return;
  }

  const profiles = injectionResults?.[0]?.result || [];
  if (profiles.length === 0) {
    statusEl.textContent = 'No LinkedIn profile links found on this page. Make sure you\'re on a Google or LinkedIn search results page.';
    return;
  }

  statusEl.textContent = `Found ${profiles.length} profile(s). Ingesting...`;

  const query = jdInput.value.trim() || tab.title || 'Untitled search';

  try {
    const res = await fetch(`${WORKER_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ingestApiKey },
      body: JSON.stringify({ query, profiles }),
    });
    const data = await res.json();

    if (res.status === 401) {
      statusEl.textContent = 'Invalid or revoked API key.';
      return;
    }
    if (res.status === 429) {
      statusEl.textContent = 'Rate limit exceeded — wait a moment and try again.';
      return;
    }
    if (!res.ok) {
      statusEl.textContent = `Ingest failed: ${data.error || res.status}`;
      return;
    }

    statusEl.textContent = `✅ Ingested ${data.ingested} of ${data.total} profiles.`;
  } catch (err) {
    statusEl.textContent = `Network error: ${err.message}`;
  }
});

// --- Generate Search (JD -> multi-platform boolean X-ray queries) ---

const jdParseInput = document.getElementById('jdParseInput');
const generateSearchBtn = document.getElementById('generateSearchBtn');
const generateResult = document.getElementById('generateResult');
const platformSelect = document.getElementById('platformSelect');
const queryOutput = document.getElementById('queryOutput');
const openGoogleBtn = document.getElementById('openGoogleBtn');
const openBingBtn = document.getElementById('openBingBtn');

let currentQueries = {}; // platformKey -> { label, query }

generateSearchBtn.addEventListener('click', async () => {
  const { ingestApiKey } = await api.storage.local.get(['ingestApiKey']);
  if (!ingestApiKey) {
    statusEl.textContent = 'Register or save an API key first.';
    return;
  }
  const jd = jdParseInput.value.trim();
  if (jd.length < 20) {
    statusEl.textContent = 'Paste a fuller job description (at least 20 characters).';
    return;
  }

  statusEl.textContent = 'Parsing job description...';
  generateResult.style.display = 'none';

  try {
    const res = await fetch(`${WORKER_URL}/generate-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ingestApiKey },
      body: JSON.stringify({ jd }),
    });
    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = `Could not generate search: ${data.error || res.status}`;
      return;
    }

    currentQueries = data.queries;
    platformSelect.innerHTML = '';
    for (const [key, val] of Object.entries(currentQueries)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = val.label;
      platformSelect.appendChild(opt);
    }
    platformSelect.value = 'linkedin';
    queryOutput.value = currentQueries.linkedin?.query || '';
    generateResult.style.display = 'block';
    statusEl.textContent = `Parsed: "${data.title}"${data.location ? ' · ' + data.location : ''}`;
  } catch (err) {
    statusEl.textContent = `Network error: ${err.message}`;
  }
});

platformSelect.addEventListener('change', () => {
  queryOutput.value = currentQueries[platformSelect.value]?.query || '';
});

openGoogleBtn.addEventListener('click', () => {
  const q = queryOutput.value.trim();
  if (!q) return;
  api.tabs.create({ url: `https://www.google.com/search?q=${encodeURIComponent(q)}` });
});

openBingBtn.addEventListener('click', () => {
  const q = queryOutput.value.trim();
  if (!q) return;
  api.tabs.create({ url: `https://www.bing.com/search?q=${encodeURIComponent(q)}` });
});
