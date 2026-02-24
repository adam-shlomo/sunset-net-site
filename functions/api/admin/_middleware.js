/**
 * Cloudflare Pages Middleware: Rate limiting for all /api/admin/* routes.
 * Uses the Cache API to track failed auth attempts per IP.
 * Blocks an IP for 5 minutes after 5 failed attempts.
 */

var MAX_ATTEMPTS = 5;
var WINDOW_SECONDS = 300; // 5 minutes

function getCacheKey(request, ip) {
  var url = new URL(request.url);
  return new Request(url.origin + '/_internal/rate-limit/admin/' + encodeURIComponent(ip));
}

async function getAttemptCount(request, ip) {
  try {
    var cache = caches.default;
    var key = getCacheKey(request, ip);
    var cached = await cache.match(key);
    if (!cached) return 0;
    var data = await cached.json();
    return data.count || 0;
  } catch (_) {
    return 0; // fail open if cache unavailable
  }
}

async function incrementAttempts(request, ip) {
  try {
    var cache = caches.default;
    var key = getCacheKey(request, ip);
    var current = await getAttemptCount(request, ip);
    var resp = new Response(JSON.stringify({ count: current + 1 }), {
      headers: {
        'Cache-Control': 's-maxage=' + WINDOW_SECONDS,
        'Content-Type': 'application/json',
      },
    });
    await cache.put(key, resp);
  } catch (_) {
    // fail open
  }
}

async function resetAttempts(request, ip) {
  try {
    var cache = caches.default;
    var key = getCacheKey(request, ip);
    await cache.delete(key);
  } catch (_) {
    // fail open
  }
}

export async function onRequest(context) {
  var ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  // Check rate limit before processing
  var count = await getAttemptCount(context.request, ip);
  if (count >= MAX_ATTEMPTS) {
    return new Response(JSON.stringify({ error: 'Too many attempts. Try again in 5 minutes.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(WINDOW_SECONDS),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Allow preflight through without rate limit counting
  if (context.request.method === 'OPTIONS') {
    return await context.next();
  }

  // Process the request
  var response = await context.next();

  // If auth failed (401), increment the counter
  if (response.status === 401) {
    await incrementAttempts(context.request, ip);
  }

  // On success, reset the counter for this IP
  if (response.status === 200) {
    await resetAttempts(context.request, ip);
  }

  return response;
}
