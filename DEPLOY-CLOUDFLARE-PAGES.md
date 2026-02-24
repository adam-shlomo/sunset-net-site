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

## Option B: Deploy with Git + GitHub Action (recommended)

If Cloudflare’s built-in deploy step fails with auth (e.g. error 10000), use the **GitHub Action** in this repo so each push to `main` deploys via Wrangler using a token stored in GitHub.

1. **Add GitHub Secrets** (repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**):
   - `CLOUDFLARE_API_TOKEN` — API token with **Account → Cloudflare Pages → Edit**
   - `CLOUDFLARE_ACCOUNT_ID` — your account ID (e.g. `616291b90aac151bcc9ab892b58a951c`)

2. **Push to `main`** (or merge a PR into `main`). The workflow `.github/workflows/deploy-pages.yml` runs and deploys the repo to your Pages project `sunset-net-site`.

3. **Optional:** In Cloudflare Pages → **Settings** → **Build configuration**, set **Deploy command** to empty or `true` so the Cloudflare build doesn’t run Wrangler (the Action does the deploy instead).

---

## Option C: Deploy with Git (Cloudflare build only)

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
| **“Missing entry-point to Worker script” / build runs `wrangler deploy`** | The project is using the wrong build command. In **Cloudflare Dashboard** → your Pages project → **Settings** → **Builds & deployments** → **Build configuration**: set **Build command** to `exit 0`. Set **Path** (build output directory) to `.`. Leave **Deploy command** empty if possible; if it’s required, use `npx wrangler pages deploy .` (see “Only see Hello World” below). Save and **Retry deployment**. |
| **Only see “Hello World” instead of my site** | Cloudflare is serving the default placeholder because no static files were uploaded. In **Settings** → **Builds & deployments** → **Build configuration**: set **Build command** to `exit 0`, **Path** to `.`, and **Deploy command** to `npx wrangler pages deploy . --project-name=sunset-net-site` (use your actual Pages project name if different). Save and **Retry deployment**. |
| **“Must specify a project name”** when deploy runs | The deploy command must include the project name. In **Settings** → **Builds & deployments** → **Build configuration**, set **Deploy command** to: `npx wrangler pages deploy . --project-name=sunset-net-site` (replace `sunset-net-site` with your exact project name from Workers & Pages). Save and **Retry deployment**. |
| **“Project not found” (8000007) even though the project exists in the dashboard** | Your project was likely created with **Connect to Git**. The deploy API only targets **Direct Upload** projects. Create a **new** Pages project via **Workers & Pages** → **Create application** → **Pages** → **Upload assets** (not “Connect to Git”). Name it e.g. `sunset-net-site` or `sunset-net-live`. Set the secret **CLOUDFLARE_PAGES_PROJECT_NAME** to that new project’s name. The Action will deploy there. You can then point your domain to that project or make it the primary. |
| **“Authentication error [code: 10000]”** on deploy | The API token needs **Pages Write** and the build needs the account ID. (1) Create a **new** API token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens): **Create Custom Token** → add **Account** → **Cloudflare Pages** → **Edit**; restrict to your account. Copy the token. (2) In the Pages project → **Settings** → **Environment variables** (Production): set `CLOUDFLARE_API_TOKEN` to the new token and `CLOUDFLARE_ACCOUNT_ID` to your account ID (e.g. from the error URL: `616291b90aac151bcc9ab892b58a951c`). Retry deployment. |
| 404 on `/` | Ensure `_redirects` is in the same directory as `sunset-net-cursor.html` and that you didn’t set “Build output directory” to a subfolder that doesn’t contain `_redirects`. |
| Form fails (Git deploy) | Check **Settings** → **Environment variables** (SUPABASE_*, RESEND_*). Check **Deployments** → **View build** and **View function logs** for errors. |
| Build “failed” (Git) | For this repo, **Build command** must be empty and **Build output directory** must be `.`. Do not use “Wrangler” or any Workers preset. |

---

## Quick reference

- **Direct Upload:** Dashboard → Workers & Pages → Create → Pages → Upload assets → drag folder or ZIP.
- **Git:** Create → Pages → Connect to Git → choose repo → build command empty, output `.` or (space) → add env vars → deploy.
- **Headers / redirects:** `_headers` and `_redirects` in the **build output** directory (repo root for this project).

That’s it. Once deployed, you have HTTPS, CDN, and optional serverless signup on Cloudflare Pages.
