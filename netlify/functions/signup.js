/**
 * Netlify serverless function: signup
 * POST body: { email, name?, terms_accepted?: boolean }
 * - Validates email, inserts into Supabase signups table
 * - Sends confirmation email via Resend
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, CONFIRMATION_FROM_EMAIL, SITE_URL
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CONFIRMATION_FROM_EMAIL = process.env.CONFIRMATION_FROM_EMAIL || 'Sunset Net <onboarding@resend.dev>';
const SITE_URL = process.env.URL || process.env.SITE_URL || 'https://sunset-net.example.com';

// Simple email validation
function isValidEmail(s) {
  if (typeof s !== 'string' || s.length > 254) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(s.trim());
}

// Sanitize optional string (max length, trim)
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

exports.handler = async (event, context) => {
  const origin = event.headers.origin || event.headers.Origin || '*';

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON' }),
    };
  }

  const email = sanitize(body.email, 254);
  if (!email || !isValidEmail(email)) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Valid work email is required' }),
    };
  }

  const name = sanitize(body.name, 100);
  const terms_accepted = Boolean(body.terms_accepted);
  if (!terms_accepted) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'You must accept the Safety Terms' }),
    };
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // Insert into Supabase
  const row = {
    email: email.toLowerCase(),
    name: name || null,
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
      return {
        statusCode: 409,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'This email already has an account' }),
      };
    }
    console.error('Supabase error', supabaseRes.status, errText);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Could not save signup' }),
    };
  }

  // Send confirmation email (best-effort; don't fail the request if Resend fails)
  if (RESEND_API_KEY) {
    const html = `
      <p>Welcome to Sunset Net.</p>
      <p>Your free trial is ready. Log in to get started.</p>
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
          subject: 'Welcome to Sunset Net',
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

  return {
    statusCode: 201,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, message: 'Account created.' }),
  };
};
