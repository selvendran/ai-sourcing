// src/lib/auth.js
export async function sha256Hex(message) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateRawKey() {
  // Generates a secure 32-character random string for the API key
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const cryptoArray = new Uint8Array(32);
  crypto.getRandomValues(cryptoArray);
  for (let i = 0; i < 32; i++) {
    result += chars[cryptoArray[i] % chars.length];
  }
  return result;
}

export async function authenticate(request, env, requiredPermission) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return { ok: false, error: 'Missing x-api-key header', status: 401 };
  }

  const keyHash = await sha256Hex(apiKey);
  
  try {
    const result = await env.DB.prepare(
      `SELECT * FROM api_keys WHERE key_hash = ? AND revoked = 0`
    ).bind(keyHash).first();

    if (!result) {
      return { ok: false, error: 'Invalid or revoked API key', status: 401 };
    }

    // Check permissions — an 'admin' key can call any route, not just /admin/*
    const permissions = result.permissions.split(',').map(p => p.trim());
    if (!permissions.includes(requiredPermission) && !permissions.includes('admin')) {
      return { ok: false, error: `Insufficient permissions. Required: ${requiredPermission}`, status: 403 };
    }

    return { ok: true, keyRow: result };
  } catch (err) {
    return { ok: false, error: 'Internal authentication error', status: 500 };
  }
}
