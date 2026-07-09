// src/lib/logging.js
export function log(level, event, data = {}) {
  const logEntry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  // In production, this goes to Cloudflare's console
  console.log(JSON.stringify(logEntry));
}

export async function recordRequest(env, ctx, data) {
  try {
    const { keyLabel, route, status, durationMs, error = null } = data;
    
    // Only log errors (4xx/5xx) and successful ingest/search
    if (status < 200 || status >= 400) {
      log('info', 'request_recorded', { keyLabel, route, status, durationMs });
    }

    // Write to D1 for observability
    await env.DB.prepare(`
      INSERT INTO request_log (key_label, route, status, duration_ms, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(keyLabel, route, status, durationMs, error, Date.now()).run();
    
  } catch (err) {
    // Non-blocking: just log to console if request logging fails
    log('error', 'request_log_failed', { message: err.message });
  }
}
