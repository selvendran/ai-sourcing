// src/lib/rateLimit.js

export async function checkRateLimit(env, keyLabel, limitPerMinute = 60) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000; // start of current minute
  const key = `rl:${keyLabel}:${windowStart}`;

  try {
    // Get current count for this key/minute window
    let count = 0;
    const existing = await env.KV.get(key);
    if (existing) {
      count = parseInt(existing, 10) || 0;
    }

    // Check if limit exceeded
    if (count >= limitPerMinute) {
      return { allowed: false, remaining: 0, resetAt: windowStart + 60000 };
    }

    // Increment and store with TTL (expire after 70 seconds to be safe)
    await env.KV.put(key, String(count + 1), { expirationTtl: 70 });

    return {
      allowed: true,
      remaining: limitPerMinute - (count + 1),
      resetAt: windowStart + 60000
    };

  } catch (err) {
    // If KV fails, allow the request (fail open to avoid blocking users)
    console.error('Rate limit check failed, allowing request:', err.message);
    return { allowed: true, remaining: 999, resetAt: now + 60000 };
  }
}
