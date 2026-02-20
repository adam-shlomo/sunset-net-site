# Deploy Sunset Net to Cloudflare Pages

Step-by-step guide to get your static site (and optional signup API) live on Cloudflare Pages with HTTPS and a global CDN.

---

## What’s already set up

- **`_redirects`** — `/` and `/index.html` serve `sunset-net-cursor.html` (URL stays as `/`).
- **`_headers`** — Security headers (X-Frame-Options, X-Content-Type-Options, etc.) are applied to all responses.
- **Pages Function** (optional) — `functions/api/signup.js` handles form POSTs when you use the “Connect to Git” workflow and add env vars.

---

## Option A: Deploy with Direct Upload (no Git)

Best if you’re not using Git or want a one-off deploy.

### 1. Create a Pages project

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**.
2. Click **Create** → **Pages** → **Upload assets**.
3. Name the project (e.g. `sunset-net`) and click **Create project**.

### 2. Upload your site

1. In the “Deploy your site” step, you can **drag and drop** a folder or a **ZIP** of your site.
2. Your upload must include:
   - `sunset-net-cursor.html`
   - `_redirects` (so `/` works)
   - `_headers` (security headers)
   - If you use the signup API: the `functions/` folder is **not** used in Direct Upload — only **Git** deploys run Functions. So with Direct Upload the form will not submit to a backend unless you add a Worker or external form service later.
3. Upload the folder or ZIP.
4. Cloudflare will deploy and give you a URL like `https://sunset-net.pages.dev`.

### 3. (Optional) Custom domain

1. In the project → **Custom domains** → **Set up a custom domain**.
2. Add your domain and follow DNS instructions (usually add a CNAME to `sunset-net.pages.dev`).
3. Cloudflare will issue an HTTPS certificate automatically.

---

## Option B: Deploy with Git (recommended if you use GitHub/GitLab)

Best if you want automatic deploys on every push and the signup **Pages Function** to work.

### 1. Push your code to Git

1. Create a repo on **GitHub** or **GitLab** and push this project (including `_redirects`, `_headers`, and `functions/api/signup.js` if you use the form).

### 2. Connect the repo to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Choose **GitHub** or **GitLab** and authorize Cloudflare.
3. Select the repository that contains Sunset Net.
4. Configure the build:
   - **Project name:** e.g. `sunset-net`
   - **Production branch:** e.g. `main`
   - **Build command:** leave **empty** (static site, no build).
   - **Build output directory:** ` `. (single space or `.` — the repo root is the “output” with your HTML and assets.)
5. Click **Save and Deploy**.

### 3. Set environment variables (for the signup form)

So the form can write to Supabase and send email:

1. In the Pages project → **Settings** → **Environment variables**.
2. Add (for **Production** and optionally **Preview**):

| Name | Value | Notes |
|------|--------|--------|
| `SUPABASE_URL` | Your Supabase project URL | From Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Keep secret |
| `RESEND_API_KEY` | Your Resend API key | For confirmation emails (optional) |
| `CONFIRMATION_FROM_EMAIL` | e.g. `Sunset Net <onboarding@resend.dev>` | Optional |
| `SITE_URL` | Your live URL, e.g. `https://sunset-net.pages.dev` | Optional, for emails |

3. **Redeploy** after adding/changing variables: **Deployments** → **…** on latest deploy → **Retry deployment**.

### 4. (Optional) Custom domain

Same as Option A: **Custom domains** → **Set up a custom domain** → add your domain and DNS (CNAME to `sunset-net.pages.dev`).

---

## After deploy

- **Root URL:** `https://<project>.pages.dev/` will show your landing page (thanks to `_redirects`).
- **Security headers:** Applied via `_headers`.
- **Form:** If you used **Git** and set the env vars, the signup form posts to `/api/signup` and the function will write to Supabase and optionally send Resend emails.
- **Direct Upload:** Form does not call a backend unless you add a Worker or external form service and point the form there.

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| 404 on `/` | Ensure `_redirects` is in the same directory as `sunset-net-cursor.html` and that you didn’t set “Build output directory” to a subfolder that doesn’t contain `_redirects`. |
| Form fails (Git deploy) | Check **Settings** → **Environment variables** (SUPABASE_*, RESEND_*). Check **Deployments** → **View build** and **View function logs** for errors. |
| Build “failed” (Git) | If build command is empty and output is `.` or one space, build should succeed. If you added a build step, run it locally first and fix any errors. |

---

## Quick reference

- **Direct Upload:** Dashboard → Workers & Pages → Create → Pages → Upload assets → drag folder or ZIP.
- **Git:** Create → Pages → Connect to Git → choose repo → build command empty, output `.` or (space) → add env vars → deploy.
- **Headers / redirects:** `_headers` and `_redirects` in the **build output** directory (repo root for this project).

That’s it. Once deployed, you have HTTPS, CDN, and optional serverless signup on Cloudflare Pages.
