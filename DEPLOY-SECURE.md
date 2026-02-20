# Sunset Net — Secure Deployment Guide

## What You Have

- **Single static page**: `sunset-net-cursor.html` — marketing/landing for Sunset Net (AI network orchestration).
- **External resources**: Google Fonts only (no CDN scripts, no analytics in the file).
- **Form**: Early-access signup (email, stack, checkboxes). **Currently the form does not submit anywhere** — `handleSubmit()` only shows the success message. No data is sent to a server.

---

## 1. Deploy the static site securely

Your site is **static HTML/CSS/JS**. That’s good for security (no server-side code to compromise). Deploy it as a **static site over HTTPS**.

### Recommended hosts (all provide HTTPS by default)

| Platform        | Notes |
|----------------|--------|
| **Cloudflare Pages** | Free, global CDN, HTTPS, optional WAF, easy custom domain. |
| **Netlify**    | Free tier, HTTPS, form handling, `_headers` for security headers. |
| **Vercel**     | Free tier, HTTPS, global CDN. |
| **GitHub Pages** | Free, HTTPS; use a branch or `gh-pages`. |
| **Render (static)** | Free static sites, HTTPS. |

**Security baseline:** Use **HTTPS only** (no mixed content). All of the above do this by default.

---

## 2. Secure the signup form

Right now the form does not send data anywhere. To deploy “securely” you need to:

- **Send submissions to a trusted backend or form service.**
- **Validate and sanitize** input (email format, length, no script injection).
- **Avoid exposing secrets** (no API keys in the HTML/JS; use server-side or serverless).
- **Protect against abuse**: rate limiting, optional CAPTCHA for public forms.

### Option A — Form backend / serverless (most control)

- Add an **API endpoint** (e.g. serverless function on Netlify/Vercel/Cloudflare Workers) that:
  - Accepts POST with email + metadata.
  - Validates and sanitizes input.
  - Writes to a database or sends to your email/CRM.
  - Returns a simple success/error JSON.
- In the page, call this endpoint with `fetch()` from `handleSubmit()` (method POST, `Content-Type: application/json`). Do **not** put API keys or DB credentials in the HTML/JS; keep them in environment variables on the host.

### Option B — Third-party form service (fastest)

- **Netlify Forms**: If you deploy on Netlify, add `netlify` (or `data-netlify="true"`) to the form and a hidden input; Netlify will accept submissions and you can secure with reCAPTCHA.
- **Formspree / Basin / similar**: Post form to their endpoint. They handle validation and storage. Use their recommended JS (no secret in frontend; they use your form’s “action” URL as identifier). Prefer services that support **HTTPS only** and **privacy/GDPR** if you collect emails.

In both cases, **do not** rely only on client-side checks; always validate and sanitize on the server or via the form service.

---

## 3. Security headers

Add HTTP security headers so the host sends them on every response. This reduces risk of clickjacking, XSS, and some MIME-sniffing issues.

### Netlify

Create `_headers` in the same folder as your built site (e.g. project root if you deploy the root):

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
```

### Cloudflare Pages

In **Settings → Functions → Headers**, or in a `_headers` file in the build output:

Same as above.

### Optional: Content-Security-Policy (CSP)

Your page only loads Google Fonts from `fonts.googleapis.com` and `fonts.gstatic.com`. A strict CSP could look like:

```
Content-Security-Policy: default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self';
```

If you add analytics or a form endpoint later, extend `connect-src` and `script-src` as needed. Start in **report-only** if you’re unsure, to avoid breaking the site.

---

## 4. Other security and hygiene

- **No secrets in the repo**: No API keys, tokens, or passwords in HTML/JS or in committed config. Use env vars on the host.
- **Links**: You reference `safety-terms.html`. Create that page or the link will 404. Use `target="_blank"` only where needed (you already do for Safety Terms); consider `rel="noopener"` on such links.
- **Dependencies**: You only use Google Fonts. If you add npm packages later, keep them updated and run `npm audit`.
- **Subresource Integrity (SRI)**: For maximum assurance you could self-host the fonts or use SRI for the font stylesheet. For many sites, using Google Fonts over HTTPS is acceptable.

---

## 5. Pre-launch checklist

- [ ] Deploy static files to a host that forces **HTTPS**.
- [ ] **Form**: Either wire the form to a backend/serverless endpoint (with validation and rate limiting) or to a form service; ensure no secrets in frontend.
- [ ] Add **security headers** (`_headers` or host config): at least `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`.
- [ ] Create **safety-terms.html** (or update the link).
- [ ] Test the form in production (submit once, check it reaches your backend or form inbox).
- [ ] Optional: Add CSP in report-only first, then enforce if no violations.

---

## Quick start: Netlify (with headers and form handling)

1. **Rename or use as entry:**  
   Ensure the main page is `index.html` (e.g. copy `sunset-net-cursor.html` to `index.html` or configure the publish directory and index).

2. **Add `_headers`** in the same directory as `index.html` (see section 3).

3. **Form:**  
   Either switch to Netlify Forms (add `data-netlify="true"` and a hidden input, and post to your site) or keep your current button and in `handleSubmit()` use `fetch()` to your own API (e.g. Netlify Function) with the form data.

4. **Deploy:**  
   Connect the repo to Netlify (or drag-and-drop the folder), set build command to none if it’s static, set publish directory to the folder containing `index.html`.

5. **HTTPS:**  
   Netlify will provision a certificate; use “Force HTTPS” in domain settings.

Once the form is connected to a secure backend or form service and headers are in place, your deployment will be in good shape from a security perspective.
