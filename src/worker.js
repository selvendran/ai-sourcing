import { authenticate } from './lib/auth.js';
import { parseJD } from './lib/jdParser.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

// 1. INGESTION: Writes profile to R2 and reference to D1
async function handleIngest(request, env) {
  try {
    const { profiles } = await request.json();
    if (!profiles || !Array.isArray(profiles)) return jsonResponse({ error: 'Payload must be array of profiles' }, 400);

    for (const profile of profiles) {
      const rawId = profile.id || profile.name || 'unknown';
      const cleanId = rawId.split('#')[0].trim();
      const r2Key = `profiles/${cleanId}-${Date.now()}.json`;

      // Save to R2
      await env.PROFILES_BUCKET.put(r2Key, JSON.stringify(profile));

      // Save to D1
      await env.DB.prepare(`
        INSERT INTO profiles (id, name, r2_key, created_at) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET r2_key = excluded.r2_key
      `).bind(cleanId, profile.name || cleanId, r2Key, Date.now()).run();
    }
    return jsonResponse({ message: `Ingested ${profiles.length} profiles` });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// 2. JD PARSER: Generates the Boolean strings
async function handleGenerateSearch(request, env, keyRow) {
  try {
    const { jd, blacklist } = await request.json();
    if (!jd) return jsonResponse({ error: 'Missing JD' }, 400);

    const result = await parseJD(env, jd, keyRow.label, blacklist || []);
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// 3. SEARCH: Fetches from D1
async function handleDynamicSearch(request, env) {
  try {
    const { query } = await request.json();
    if (!query || query.trim() === "") {
      const { results } = await env.DB.prepare("SELECT * FROM profiles LIMIT 50").all();
      return jsonResponse({ results });
    }
    // Your vector search logic here
    return jsonResponse({ results: [] });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    // Authentication check
    const auth = await authenticate(request, env, url.pathname.replace('/', ''));
    if (!auth.ok) return jsonResponse({ error: 'Unauthorized' }, 401);

    if (url.pathname === '/ingest' && method === 'POST') return handleIngest(request, env);
    if (url.pathname === '/generate-search' && method === 'POST') return handleGenerateSearch(request, env, auth.keyRow);
    if (url.pathname === '/search' && method === 'POST') return handleDynamicSearch(request, env);

    return jsonResponse({ error: 'Not Found' }, 404);
  }
};