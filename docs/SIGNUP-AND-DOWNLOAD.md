# Signup, confirmation email, and download link

## Flow

1. **User submits the form** → Browser sends POST to `/.netlify/functions/signup` with `email`, `primary_stack`, `priority_lab`, `terms_accepted`.
2. **Serverless function** (`netlify/functions/signup.js`):
   - Validates and sanitizes input.
   - Inserts a row into Supabase `signups` (stored profile).
   - Sends a **confirmation email** to the signee via Resend.
   - Returns success or error to the page.
3. **Later (you)** — Send the app **download link** to signees (see below).

---

## Setup

### 1. Supabase

- Create a project at [supabase.com](https://supabase.com).
- In **SQL Editor**, run the contents of `supabase/schema.sql` to create the `signups` table.
- In **Settings → API**: copy **Project URL** → `SUPABASE_URL`, and **service_role** (secret) → `SUPABASE_SERVICE_ROLE_KEY`. Never expose the service role key in the frontend.

### 2. Resend

- Sign up at [resend.com](https://resend.com), create an API key.
- For production: add and verify your domain so you can send from e.g. `hello@yourdomain.com`.
- For testing you can use `onboarding@resend.dev` as the “from” address (Resend allows this on free tier).
- Set `RESEND_API_KEY` and `CONFIRMATION_FROM_EMAIL` in Netlify.

### 3. Netlify

- Deploy the repo (connect Git or drag-and-drop).
- **Site settings → Environment variables**: add all variables from `.env.example` (no quotes needed in the UI for values).
- Redeploy after changing env vars so the function picks them up.

---

## Stored profile (Supabase `signups`)

| Column             | Description |
|--------------------|-------------|
| `id`               | UUID, primary key |
| `email`            | Signee email (unique) |
| `primary_stack`    | e.g. "Cisco IOS / IOS-XE" or null |
| `priority_lab`     | true if they use GNS3/EVE-NG |
| `terms_accepted_at`| When they accepted terms |
| `created_at`       | Signup time |
| `confirmed_at`     | Optional: set when they confirm (e.g. double opt-in) |
| `download_sent_at` | When you sent the download link (null until sent) |

---

## Sending the download link

When you’re ready to ship the app:

**Option A — Manual**

1. In Supabase **Table Editor → signups**, export or filter signees (e.g. where `download_sent_at` is null).
2. Use your email tool (Resend dashboard, Mailchimp, etc.) to send a message that includes the download link. Optionally set `download_sent_at` in Supabase for each row after sending so you don’t double-send.

**Option B — Resend broadcast + script**

1. Create a one-off script or Netlify/Cloudflare scheduled job that:
   - Reads from Supabase all signups where `download_sent_at` is null.
   - Sends each one an email via Resend with the download URL.
   - Updates each row: `download_sent_at = now()`.
2. Keep the download URL and message in env vars or a config file, not in the repo if it’s private.

**Option C — Second serverless function**

- Add e.g. `netlify/functions/send-download.js` protected by a secret header or API key, that:
  - Accepts a list of IDs or “send to all unsent”,
  - Sends the email with the link via Resend,
  - Sets `download_sent_at` in Supabase.
- Call it from a cron job or from an internal admin page so only you can trigger it.

---

## Confirmation email content

The function sends a short HTML email. To change the text, edit the `html` variable in `netlify/functions/signup.js` (around the “You're on the list” section). You can add your logo, link to safety terms, or unsubscribe link there.
