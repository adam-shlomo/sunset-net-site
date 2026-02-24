/**
 * Cloudflare Pages Function: GET /api/admin/signups
 * Returns all signups from Supabase, ordered by created_at desc.
 * Protected by Authorization: Bearer <ADMIN_SECRET>
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET
 */

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
}

function jsonResponse(status, data, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      ...SECURITY_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}

/** Constant-time string comparison to prevent timing attacks */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

function authorize(request, env) {
  const secret = env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  return timingSafeEqual(token, secret);
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '*';

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...corsHeaders(origin), ...SECURITY_HEADERS },
      });
    }

    if (request.method !== 'GET') {
      return jsonResponse(405, { error: 'Method not allowed' }, origin);
    }

    if (!authorize(request, env)) {
      // Deliberate 1s delay on failed auth to throttle brute-force attempts
      await new Promise(function(r) { setTimeout(r, 1000); });
      return jsonResponse(401, { error: 'Unauthorized' }, origin);
    }

    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing env vars:', {
        hasUrl: !!SUPABASE_URL,
        hasKey: !!SUPABASE_SERVICE_ROLE_KEY,
        hasSecret: !!env.ADMIN_SECRET,
      });
      return jsonResponse(500, { error: 'Server configuration error' }, origin);
    }

    const url = SUPABASE_URL.replace(/\/+$/, '') +
      '/rest/v1/signups?select=id,email,primary_stack,priority_lab,created_at,approved_at,invite_sent_at&order=created_at.desc';

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Supabase error:', res.status, errText);
      return jsonResponse(500, { error: 'Failed to fetch signups' }, origin);
    }

    const signups = await res.json();
    return jsonResponse(200, { signups: signups }, origin);
  } catch (e) {
    console.error('Admin signups unhandled error:', e && e.stack ? e.stack : e);
    return jsonResponse(500, { error: 'Internal server error' }, origin);
  }
}
