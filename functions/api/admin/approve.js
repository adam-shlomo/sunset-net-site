/**
 * Cloudflare Pages Function: POST /api/admin/approve
 * Approves signups and sends invite emails via Resend.
 * Body: { ids: ["uuid", ...] }  (max 50)
 * Protected by Authorization: Bearer <ADMIN_SECRET>
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SECRET, RESEND_API_KEY, CONFIRMATION_FROM_EMAIL
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cache-Control': 'no-store',
};

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    if (request.method !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' }, origin);
    }

    if (!authorize(request, env)) {
      await new Promise(function(r) { setTimeout(r, 1000); });
      return jsonResponse(401, { error: 'Unauthorized' }, origin);
    }

    const SUPABASE_URL = env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
    const RESEND_API_KEY = env.RESEND_API_KEY;
    const CONFIRMATION_FROM_EMAIL = env.CONFIRMATION_FROM_EMAIL || 'Sunset Net <onboarding@resend.dev>';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse(500, { error: 'Server configuration error' }, origin);
    }

    let body;
    try {
      body = await request.json();
    } catch (_) {
      return jsonResponse(400, { error: 'Invalid JSON' }, origin);
    }

    const ids = body && body.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return jsonResponse(400, { error: 'ids must be a non-empty array' }, origin);
    }
    if (ids.length > 50) {
      return jsonResponse(400, { error: 'Max 50 IDs per batch' }, origin);
    }

    // Validate all IDs are UUIDs
    for (var i = 0; i < ids.length; i++) {
      if (typeof ids[i] !== 'string' || !UUID_RE.test(ids[i])) {
        return jsonResponse(400, { error: 'Invalid ID format at index ' + i }, origin);
      }
    }

    var baseUrl = SUPABASE_URL.replace(/\/+$/, '');
    var supabaseHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_ROLE_KEY,
      'Prefer': 'return=representation',
    };

    var results = [];

    for (var j = 0; j < ids.length; j++) {
      var id = ids[j];
      var result = { id: id, approved: false, invited: false, error: null };

      try {
        // Fetch the signup row
        var fetchRes = await fetch(
          baseUrl + '/rest/v1/signups?id=eq.' + encodeURIComponent(id) + '&select=id,email,approved_at,invite_sent_at',
          { method: 'GET', headers: supabaseHeaders }
        );

        if (!fetchRes.ok) {
          result.error = 'Failed to fetch signup';
          results.push(result);
          continue;
        }

        var rows = await fetchRes.json();
        if (!rows || rows.length === 0) {
          result.error = 'Signup not found';
          results.push(result);
          continue;
        }

        var signup = rows[0];
        var now = new Date().toISOString();

        // Set approved_at if not already approved
        if (!signup.approved_at) {
          var approveRes = await fetch(
            baseUrl + '/rest/v1/signups?id=eq.' + encodeURIComponent(id),
            {
              method: 'PATCH',
              headers: supabaseHeaders,
              body: JSON.stringify({ approved_at: now }),
            }
          );

          if (!approveRes.ok) {
            result.error = 'Failed to update approved_at';
            results.push(result);
            continue;
          }
        }

        result.approved = true;

        // Send invite email if not already sent
        if (!signup.invite_sent_at && RESEND_API_KEY) {
          var inviteHtml = [
            '<p>You\'ve been approved for Sunset Net.</p>',
            '<p>Your account is ready. Log in to get started with your free trial.</p>',
            '<p>Welcome aboard.</p>',
            '<p>— Sunset Net</p>',
          ].join('\n');

          try {
            var emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + RESEND_API_KEY,
              },
              body: JSON.stringify({
                from: CONFIRMATION_FROM_EMAIL,
                to: [signup.email],
                subject: "You're approved — Sunset Net",
                html: inviteHtml,
              }),
            });

            if (emailRes.ok) {
              await fetch(
                baseUrl + '/rest/v1/signups?id=eq.' + encodeURIComponent(id),
                {
                  method: 'PATCH',
                  headers: supabaseHeaders,
                  body: JSON.stringify({ invite_sent_at: now }),
                }
              );
              result.invited = true;
            } else {
              var errBody = await emailRes.text();
              console.error('Resend error for', signup.email, emailRes.status, errBody);
              result.error = 'Approved but email send failed';
            }
          } catch (emailErr) {
            console.error('Resend exception for', signup.email, emailErr);
            result.error = 'Approved but email send failed';
          }
        } else if (signup.invite_sent_at) {
          result.invited = true;
        } else if (!RESEND_API_KEY) {
          result.error = 'Approved but RESEND_API_KEY not configured';
        }
      } catch (rowErr) {
        console.error('Approve exception for', id, rowErr);
        result.error = 'Internal error';
      }

      results.push(result);
    }

    return jsonResponse(200, { results: results }, origin);
  } catch (e) {
    console.error('Admin approve unhandled error:', e && e.stack ? e.stack : e);
    return jsonResponse(500, { error: 'Internal server error' }, origin);
  }
}
