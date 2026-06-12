# Deploy the QA Dashboard on Vercel (free, no credit card)

This is the **Vercel** build of the dashboard. It's the same app as the Netlify version —
React + Vite frontend, plus a serverless API that reads/writes your Google Sheet — but the
backend functions live in **`/api`** (Vercel's format) instead of `netlify/functions`.

> Use **this** folder for Vercel. Ignore the Netlify-specific "Deploy on Netlify" section in
> `README.md`; everything else there (Google Cloud service account, the Sheet tabs, the auth
> gate) still applies exactly the same.

Vercel's **Hobby** plan is free forever and needs no credit card. It runs both the static site
and the `/api/*` serverless functions.

---

## What changed vs. the Netlify version
| | Netlify | Vercel (this folder) |
|---|---|---|
| Backend functions | `netlify/functions/*.js` | `api/*.js` |
| Handler format | `exports.handler = (event) => {...}` | same code + a tiny `api/_adapter.js` wrapper |
| Config file | `netlify.toml` | `vercel.json` |
| API URL | `/api/*` (via redirect) | `/api/*` (native — file = route) |

The function **logic is identical**. `api/_adapter.js` converts Vercel's `(req, res)` into the
`event` object the ported handlers expect, so nothing else had to be rewritten. Files in `/api`
that start with `_` (`_adapter.js`, `_sheets.js`, `_auth.js`) are private helpers, not routes.

---

## One-time setup (5 minutes, all in the browser)

### 1. Get the code onto GitHub
You need this `vercel-app` folder in a GitHub repo (Vercel deploys from GitHub). If you don't
have Git installed, the easiest path:
1. Create a new repo at **github.com/new** (e.g. `qa-dashboard-vercel`), keep it **Private**.
2. On the new repo page, click **uploading an existing file**.
3. Drag in the contents of this `vercel-app` folder (or upload the zip's extracted files,
   keeping the folder structure: `api/`, `src/`, `index.html`, `package.json`, `vercel.json`,
   etc.). **Do not** upload `node_modules` or any `.env` file.
4. Commit.

### 2. Import into Vercel
1. Go to **vercel.com**, sign in **with GitHub** (free, no card).
2. **Add New… → Project → Import** your `qa-dashboard-vercel` repo.
3. Framework preset auto-detects **Vite**, which sets Build Command `npm run build` and Output
   Directory `dist` automatically. Leave them as detected. (Functions in `/api` are also
   auto-detected — no config file needed.)
4. **Before clicking Deploy**, open **Environment Variables** and add all of these (same
   values as your Netlify `.env` — see `.env.example`):
   - `SHEET_ID`
   - `GOOGLE_SA_EMAIL`
   - `GOOGLE_SA_KEY`  *(paste the whole key incl. the `\n` sequences, in quotes)*
   - `ALLOWED_DOMAIN`  → `solarsquare.in`
   - `ALLOWED_EMAILS`  *(your admin allowlist, or blank for anyone on the domain)*
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_ALLOWED_DOMAIN`  → `solarsquare.in`
   - `VITE_ALLOWED_EMAILS`
   - *(optional)* `GMAIL_SENDER` if you wired report emails
5. Click **Deploy**. You'll get a URL like `https://qa-dashboard-vercel.vercel.app`.

### 3. Allow the new URL to sign in with Google
In **Google Cloud → APIs & Services → Credentials →** your OAuth **Web** client →
**Authorized JavaScript origins**, add your Vercel URL:
- `https://qa-dashboard-vercel.vercel.app`
(and your custom domain later, if you add one). Save.

### 4. Verify
- Open `https://<your-app>.vercel.app/api/config` → should show `{"enabled":true, ...}`.
- Open `https://<your-app>.vercel.app/api/meetings` (signed in) → each row should now include
  **`meetingStatus`**, **`meetingDoneDate`**, and **`meetingDoneISO`** — confirming the new
  *Meeting Done Date* support is live.
- Open the app URL, sign in, and the dashboard loads against your real Sheet.

---

## Updating it later
Every push to the GitHub repo's main branch auto-deploys. To change an environment variable,
edit it in **Vercel → Project → Settings → Environment Variables**, then **redeploy**
(Deployments → ⋯ → Redeploy) so the build picks up any `VITE_*` change.

## Local dev (optional)
```bash
npm install
npm i -g vercel      # the Vercel CLI
vercel dev           # serves the UI AND /api/* together on http://localhost:3000
```
Plain `npm run dev` runs the frontend only (uses built-in mock data if the API isn't running).

## Notes
- **Free tier limits** (Hobby): generous for an internal tool — 100 GB bandwidth/month and
  plenty of function invocations. No card required.
- **Function size:** `googleapis` is bundled into each `/api` function; well within Vercel's
  limits.
- **Secrets:** never commit `.env`. `.gitignore` already excludes it.
