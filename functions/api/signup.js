/**
 * Cloudflare Pages Function: POST /api/signup
 * Same behavior as netlify/functions/signup.js
 * POST body: { email, primary_stack?, priority_lab?: boolean, terms_accepted?: boolean }
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CONFIRMATION_FROM_EMAIL, SITE_URL
 */

function isValidEmail(s) {
  if (typeof s !== 'string' || s.length > 254) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(s.trim());
}

function sanitize(s, maxLen = 200) {
  if (s == null) return null;
  return String(s).trim().slice(0, maxLen) || null;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function jsonResponse(status, data, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || request.headers.get('origin') || '*';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' }, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON' }, origin);
  }

  const email = sanitize(body.email, 254);
  if (!email || !isValidEmail(email)) {
    return jsonResponse(400, { error: 'Valid work email is required' }, origin);
  }

  const primary_stack = sanitize(body.primary_stack, 100);
  const priority_lab = Boolean(body.priority_lab);
  const terms_accepted = Boolean(body.terms_accepted);
  if (!terms_accepted) {
    return jsonResponse(400, { error: 'You must accept the Safety Terms' }, origin);
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const CONFIRMATION_FROM_EMAIL = env.CONFIRMATION_FROM_EMAIL || 'Sunset Net <onboarding@resend.dev>';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'Server configuration error' }, origin);
  }

  const row = {
    email: email.toLowerCase(),
    primary_stack: primary_stack || null,
    priority_lab,
    terms_accepted_at: new Date().toISOString(),
  };

  const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/signups`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(row),
  });

  if (!supabaseRes.ok) {
    const errText = await supabaseRes.text();
    if (supabaseRes.status === 409 || errText.includes('duplicate') || errText.includes('unique')) {
      return jsonResponse(409, { error: 'This email is already on the list' }, origin);
    }
    return jsonResponse(500, { error: 'Could not save signup' }, origin);
  }

  if (RESEND_API_KEY) {
    const html = `
      <p>You're on the list.</p>
      <p>We'll send access details and the download link when your slot is ready. In the meantime — keep building.</p>
      <p>— Sunset Net</p>
    `;
    try {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: CONFIRMATION_FROM_EMAIL,
          to: [email],
          subject: "You're on the Sunset Net alpha list",
          html: html.trim(),
        }),
      });
      if (!resendRes.ok) {
        const err = await resendRes.text();
        console.error('Resend error', resendRes.status, err);
      }
    } catch (e) {
      console.error('Resend exception', e);
    }
  }

  return jsonResponse(201, { ok: true, message: "You're on the list." }, origin);
}
