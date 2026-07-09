// src/lib/sanitize.js
export async function validateIngestPayload(request) {
  try {
    const body = await request.json();
    
    // Validate basic structure
    if (!body || typeof body !== 'object') {
      return { ok: false, error: 'Invalid JSON payload' };
    }

    const { query, profiles } = body;

    // Validate profiles array
    if (!Array.isArray(profiles)) {
      return { ok: false, error: 'profiles must be an array' };
    }

    if (profiles.length === 0) {
      return { ok: false, error: 'profiles array cannot be empty' };
    }

    if (profiles.length > 50) {
      return { ok: false, error: 'Maximum 50 profiles per ingestion request' };
    }

    // Validate each profile
    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      
      if (!p || typeof p !== 'object') {
        return { ok: false, error: `Profile at index ${i} is not a valid object` };
      }

      // Validate required fields
      if (!p.id || typeof p.id !== 'string' || p.id.length < 4) {
        return { ok: false, error: `Profile at index ${i} must have an id string of at least 4 characters` };
      }

      // Validate optional fields with type checking
      if (p.name && typeof p.name !== 'string') {
        return { ok: false, error: `Profile at index ${i} name must be a string` };
      }

      if (p.text && typeof p.text !== 'string') {
        return { ok: false, error: `Profile at index ${i} text must be a string` };
      }

      if (p.text && p.text.length > 10000) {
        return { ok: false, error: `Profile at index ${i} text exceeds 10,000 character limit` };
      }

      if (p.title && typeof p.title !== 'string') {
        return { ok: false, error: `Profile at index ${i} title must be a string` };
      }

      if (p.source && typeof p.source !== 'string') {
        return { ok: false, error: `Profile at index ${i} source must be a string` };
      }

      // Ensure query is a string if provided
      if (query && typeof query !== 'string') {
        return { ok: false, error: 'query must be a string' };
      }

      // Limit query length to prevent AI prompt injection
      if (query && query.length > 2000) {
        return { ok: false, error: 'query exceeds 2000 character limit' };
      }
    }

    // Strip control characters (keeps normal whitespace) before storing —
    // validation above only checked shape/length, it didn't clean the content.
    const stripControlChars = (s) => typeof s === 'string'
      ? s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim()
      : s;

    const cleanedProfiles = profiles.map(p => ({
      ...p,
      name: stripControlChars(p.name),
      title: stripControlChars(p.title),
      text: stripControlChars(p.text),
      source: stripControlChars(p.source) || 'unknown',
    }));

    // Return validated data
    return { 
      ok: true, 
      query: stripControlChars(query) || '', 
      profiles: cleanedProfiles 
    };

  } catch (err) {
    if (err instanceof SyntaxError) {
      return { ok: false, error: 'Invalid JSON format' };
    }
    return { ok: false, error: 'Internal validation error' };
  }
}
