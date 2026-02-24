/**
 * Cloudflare Pages Function: GET /api/admin/analytics
 * Returns aggregated page view stats from Supabase.
 * Protected by ADMIN_SECRET (inherits _middleware.js rate limiting).
 * Query params: ?days=30 (default 30, max 90)
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET
 */

var SECURITY_HEADERS = {
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
    status: status,
    headers: Object.assign({}, corsHeaders(origin), SECURITY_HEADERS, {
      'Content-Type': 'application/json',
    }),
  });
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  var maxLen = Math.max(a.length, b.length);
  var result = a.length ^ b.length;
  for (var i = 0; i < maxLen; i++) {
    result |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return result === 0;
}

function authorize(request, env) {
  var secret = env.ADMIN_SECRET;
  if (!secret) return false;
  var auth = request.headers.get('Authorization') || '';
  var token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  return timingSafeEqual(token, secret);
}

export async function onRequest(context) {
  var request = context.request;
  var env = context.env;
  var origin = request.headers.get('Origin') || '*';

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: Object.assign({}, corsHeaders(origin), SECURITY_HEADERS),
      });
    }

    if (request.method !== 'GET') {
      return jsonResponse(405, { error: 'Method not allowed' }, origin);
    }

    if (!authorize(request, env)) {
      await new Promise(function(r) { setTimeout(r, 1000); });
      return jsonResponse(401, { error: 'Unauthorized' }, origin);
    }

    var SUPABASE_URL = env.SUPABASE_URL;
    var SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(500, { error: 'Server configuration error' }, origin);
    }

    var baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    var headers = {
      'Accept': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
    };

    // Parse days param
    var url = new URL(request.url);
    var days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 90);
    var since = new Date(Date.now() - days * 86400000).toISOString();

    // Fetch all page views within the window
    var res = await fetch(
      baseUrl + '/rest/v1/page_views?select=path,referrer,country,device,created_at&created_at=gte.' + encodeURIComponent(since) + '&order=created_at.desc&limit=10000',
      { method: 'GET', headers: headers }
    );

    if (!res.ok) {
      var errText = await res.text();
      console.error('Supabase analytics error:', res.status, errText);
      return jsonResponse(500, { error: 'Failed to fetch analytics' }, origin);
    }

    var views = await res.json();

    // Aggregate in the function (keeps Supabase queries simple)
    var totalViews = views.length;
    var pathCounts = {};
    var countryCounts = {};
    var deviceCounts = {};
    var referrerCounts = {};
    var dailyCounts = {};

    for (var i = 0; i < views.length; i++) {
      var v = views[i];

      // Daily counts
      var day = v.created_at ? v.created_at.slice(0, 10) : 'unknown';
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;

      // Path counts
      var p = v.path || '/';
      pathCounts[p] = (pathCounts[p] || 0) + 1;

      // Country counts
      if (v.country) {
        countryCounts[v.country] = (countryCounts[v.country] || 0) + 1;
      }

      // Device counts
      if (v.device) {
        deviceCounts[v.device] = (deviceCounts[v.device] || 0) + 1;
      }

      // Referrer counts (clean up)
      if (v.referrer) {
        var ref = v.referrer;
        try {
          var refUrl = new URL(ref);
          ref = refUrl.hostname;
        } catch (_) {}
        if (ref && ref !== 'null' && ref !== '') {
          referrerCounts[ref] = (referrerCounts[ref] || 0) + 1;
        }
      }
    }

    // Sort helpers — return top N as array of { name, count }
    function topN(obj, n) {
      return Object.keys(obj)
        .map(function(k) { return { name: k, count: obj[k] }; })
        .sort(function(a, b) { return b.count - a.count; })
        .slice(0, n || 10);
    }

    // Build daily series (fill missing days with 0)
    var dailySeries = [];
    for (var d = 0; d < days; d++) {
      var date = new Date(Date.now() - (days - 1 - d) * 86400000);
      var key = date.toISOString().slice(0, 10);
      dailySeries.push({ date: key, views: dailyCounts[key] || 0 });
    }

    // Today and yesterday for comparison
    var today = new Date().toISOString().slice(0, 10);
    var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    return jsonResponse(200, {
      total_views: totalViews,
      today_views: dailyCounts[today] || 0,
      yesterday_views: dailyCounts[yesterday] || 0,
      daily: dailySeries,
      top_pages: topN(pathCounts, 10),
      top_countries: topN(countryCounts, 10),
      top_referrers: topN(referrerCounts, 10),
      devices: topN(deviceCounts, 5),
      days: days,
    }, origin);
  } catch (e) {
    console.error('Admin analytics unhandled error:', e && e.stack ? e.stack : e);
    return jsonResponse(500, { error: 'Internal server error' }, origin);
  }
}
