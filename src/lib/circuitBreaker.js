// src/lib/circuitBreaker.js

// Uses KV to store failure counts and last failure timestamps.
// Each service (d1, r2) gets its own key.

const KV_PREFIX = 'cb:';

export async function recordFailure(env, service) {
  const key = `${KV_PREFIX}${service}`;
  const now = Date.now();

  try {
    const entry = await env.KV.get(key);
    let data = entry ? JSON.parse(entry) : { failures: 0, lastFailure: 0, openUntil: 0 };

    data.failures += 1;
    data.lastFailure = now;

    // If we've failed 3 times in a row within 60 seconds, open the circuit for 120 seconds.
    if (data.failures >= 3 && (now - data.lastFailure < 60000)) {
      data.openUntil = now + 120000; // 2 minutes
    } else if (now - data.lastFailure > 60000) {
      // Reset failure count if it's been more than 60 seconds since the last failure
      data.failures = 1;
    }

    await env.KV.put(key, JSON.stringify(data));
    return data;
  } catch (err) {
    // If KV fails, we assume the circuit is closed (optimistic).
    return { failures: 0, openUntil: 0 };
  }
}

export async function recordSuccess(env, service) {
  const key = `${KV_PREFIX}${service}`;
  try {
    await env.KV.put(key, JSON.stringify({ failures: 0, lastFailure: 0, openUntil: 0 }));
  } catch (err) {
    // Non-blocking: just log and continue.
  }
}

export async function isCircuitOpen(env, service) {
  const key = `${KV_PREFIX}${service}`;
  try {
    const entry = await env.KV.get(key);
    if (!entry) return false;

    const data = JSON.parse(entry);
    return Date.now() < data.openUntil;
  } catch (err) {
    return false; // If we can't read, assume the circuit is closed.
  }
}
