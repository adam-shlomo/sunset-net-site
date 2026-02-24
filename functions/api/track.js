/**
 * Cloudflare Pages Function: POST /api/track
 * Lightweight page view tracking. No cookies, no IPs stored.
 * Body: { path, referrer? }
 * Country and device type extracted from Cloudflare headers.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export async function onRequest(context) {
  var request = context.request;
  var env = context.env;
  var origin = request.headers.get('Origin') || '*';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405 });
  }

  var SUPABASE_URL = env.SUPABASE_URL;
  var SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Silently fail — tracking should never break the user experience
    return new Response('ok', { status: 200, headers: corsHeaders(origin) });
  }

  var body;
  try {
    body = await request.json();
  } catch (_) {
    return new Response('ok', { status: 200, headers: corsHeaders(origin) });
  }

  var path = typeof body.path === 'string' ? body.path.slice(0, 500) : '/';
  var referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 1000) : null;

  // Extract country from Cloudflare headers (no PII)
  var country = null;
  try {
    country = (request.cf && request.cf.country) || request.headers.get('CF-IPCountry') || null;
  } catch (_) {}

  // Simple device detection from User-Agent
  var device = 'desktop';
  var ua = (request.headers.get('User-Agent') || '').toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) {
    device = /ipad|tablet/.test(ua) ? 'tablet' : 'mobile';
  } else if (/bot|crawl|spider|slurp|lighthouse/i.test(ua)) {
    // Don't track bots
    return new Response('ok', { status: 200, headers: corsHeaders(origin) });
  }

  // Fire and forget — don't slow down the response
  try {
    var baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    await fetch(baseUrl + '/rest/v1/page_views', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        path: path,
        referrer: referrer || null,
        country: country,
        device: device,
      }),
    });
  } catch (_) {
    // Silent fail
  }

  return new Response('ok', { status: 200, headers: corsHeaders(origin) });
}
