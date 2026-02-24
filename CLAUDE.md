# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sunset Net is an AI network orchestration product landing page with an early-access signup form. It's a static HTML site with optional serverless backend functions for form handling.

## Architecture

**Frontend:** Single self-contained HTML file (`sunset-net-cursor.html`) with all CSS and JS inline. No build step, no bundler, no framework. Uses Google Fonts (DM Serif Display, DM Sans, IBM Plex Mono, Syne).

**Routing:** `index.html` redirects to `sunset-net-cursor.html`. The `_redirects` file rewrites `/` and `/index.html` to the main page with a 200 (transparent rewrite, URL stays as `/`).

**Backend:** Dual serverless implementations with identical business logic:
- `functions/api/signup.js` — Cloudflare Pages Function (ES module, `onRequest` export, env via `context.env`)
- `netlify/functions/signup.js` — Netlify Function (CommonJS, `exports.handler`, env via `process.env`)

Both expose `POST /api/signup` and follow the same flow: validate input → insert into Supabase `signups` table → optionally send confirmation email via Resend → return JSON response.

**Database:** Supabase PostgreSQL. Schema is in `supabase/schema.sql`. The `signups` table uses RLS with service-role-only insert access.

## Deployment

Three deployment options are documented in `DEPLOY-CLOUDFLARE-PAGES.md`:
- **Option A:** Manual upload to Cloudflare Pages (static only, no functions)
- **Option B:** GitHub Actions + Wrangler (`.github/workflows/deploy-pages.yml`) — static deploy on push to `main`
- **Option C:** Cloudflare native Git integration — includes serverless functions, best for full form support

GitHub Actions secrets required: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT_NAME`.

Serverless function env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` (optional), `CONFIRMATION_FROM_EMAIL` (optional), `SITE_URL` (optional).

## Development

No package.json or build system. To develop:
- Edit `sunset-net-cursor.html` directly for any UI/styling/JS changes
- Edit `functions/api/signup.js` for Cloudflare backend changes
- Edit `netlify/functions/signup.js` for Netlify backend changes
- Keep both serverless functions in sync when changing signup logic

Local preview with Wrangler (if installed): `npx wrangler pages dev .`

Security headers are defined in `_headers` (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).

## Signup API Contract

**Endpoint:** `POST /api/signup`

**Request body (JSON):**
```json
{
  "email": "user@example.com",
  "primary_stack": "Cisco IOS",
  "priority_lab": true,
  "terms_accepted": true
}
```

**Responses:** 201 success, 400 validation error, 405 wrong method, 409 duplicate email, 500 server error. All responses include CORS headers.

## Admin System

**Admin Page:** `admin.html` — password-protected dashboard for reviewing signups, approving users, and sending alpha invite emails. Uses `sessionStorage` for auth (cleared on tab close). Not linked from the main site.

**Admin API Endpoints:** Both protected by `Authorization: Bearer <ADMIN_SECRET>` header.

- `GET /api/admin/signups` — returns all signups ordered by `created_at` desc
- `POST /api/admin/approve` — body `{ ids: ["uuid", ...] }` (max 50). Approves signups, sends invite emails via Resend, sets `approved_at` and `invite_sent_at`.

**Admin Env Var:** `ADMIN_SECRET` — strong random string used as the admin dashboard password.

**Database Columns:** `approved_at` (timestamptz) and `invite_sent_at` (timestamptz) on the `signups` table track approval and invite status.
