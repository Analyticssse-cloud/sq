# SolarSquare Quality Systems — React + Netlify

The QA audit dashboard, rebuilt as a real **Vite + React** app with a **Netlify Functions**
backend that reads/writes your existing **Google Sheet**. Same UI and scoring as the Apps
Script version; now on a stack you can grow.

- **Frontend:** Vite + React (`src/`)
- **Backend:** Netlify Functions (`netlify/functions/`)
- **Database:** your Google Sheet (tabs: `EmployeeMaster`, `Audits`) via a service account
- **Auditor identity:** Google Sign-In (auto-detected), with a manual-email fallback

The two things you fixed earlier are preserved:
- **LRM auto-fill** comes from `EmployeeMaster` (header matching is whitespace/case-tolerant).
- **Auditor email** auto-detects from Google Sign-In; if disabled, the form asks for it.

---

## 0. What you need first
- [Node.js 18+](https://nodejs.org) installed.
- A **GitHub** account (for auto-deploy).
- Access to the **Google Sheet** that holds `EmployeeMaster` + `Audits`.
- A **Google Cloud** project (free) to create the service account + OAuth client.

---

## 1. Run it locally (5 min)
```bash
npm install
cp .env.example .env      # then fill in the values (see steps 2-3)
npm run dev               # http://localhost:5173  (UI only; uses mock data if no backend)
```
To run the **functions** locally too:
```bash
npm i -g netlify-cli
netlify dev               # serves the UI AND /api/* together
```
If the backend isn't configured yet, the UI still loads using built-in mock data.

---

## 2. Let the backend read your Sheet (service account)
1. Go to **console.cloud.google.com** → create/select a project.
2. **APIs & Services → Library** → search **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account.** Name it
   `qa-dashboard`, click **Done**.
4. Open the service account → **Keys → Add key → Create new key → JSON**. A file downloads.
5. From that JSON, copy into your `.env` (and later into Netlify):
   - `client_email`  → **GOOGLE_SA_EMAIL**
   - `private_key`   → **GOOGLE_SA_KEY** (paste the whole value, keep the `\n` sequences)
6. Copy your Sheet's ID from its URL → **SHEET_ID**.
7. **Share the Sheet** with the `GOOGLE_SA_EMAIL` address as **Editor** (just like sharing
   with a teammate). This is what authorizes the functions.

> Sheet tabs must be named `EmployeeMaster` and `Audits` with the same headers as the Apps
> Script version. If you're migrating, your existing Sheet already has them.

Test it: `netlify dev`, then open `http://localhost:8888/api/employees` — you should see your
LRM list as JSON. The LRM autocomplete now works against real data.

---

## 3. Auditor auto-detect (Google Sign-In)
1. In Google Cloud → **APIs & Services → Credentials → Create credentials → OAuth client ID.**
2. Application type **Web application**. Under **Authorized JavaScript origins** add:
   - `http://localhost:8888` (local `netlify dev`)
   - your Netlify URL, e.g. `https://your-site.netlify.app`
3. Copy the **Client ID** → set **VITE_GOOGLE_CLIENT_ID** in `.env` (and Netlify).
4. Set **ALLOWED_DOMAIN** + **VITE_ALLOWED_DOMAIN** to `solarsquare.in` to only accept your
   Workspace accounts.

A "Sign in with Google" button appears bottom-left. After sign-in, the auditor's name/email
auto-fill and are verified server-side on every save. **Leave `VITE_GOOGLE_CLIENT_ID` blank
to skip this** — the form then shows the manual-email field instead.

---

## 4. Push to GitHub
```bash
git init
git add .
git commit -m "QA dashboard: React + Netlify"
git branch -M main
git remote add origin https://github.com/<you>/qa-dashboard.git
git push -u origin main
```

---

## 5. Deploy on Netlify
1. In Netlify: **Add new project → Import an existing project → Deploy with GitHub** →
   pick the repo.
2. Build settings (auto-detected from `netlify.toml`, confirm them):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
3. Click **Deploy**.
4. **Site configuration → Environment variables → Add a variable** and add ALL of these
   (same values as your `.env`): `SHEET_ID`, `GOOGLE_SA_EMAIL`, `GOOGLE_SA_KEY`,
   `ALLOWED_DOMAIN`, `VITE_GOOGLE_CLIENT_ID`, `VITE_ALLOWED_DOMAIN`.
5. **Trigger a redeploy** (Deploys → Trigger deploy → Deploy site) so the build picks up the
   `VITE_*` vars.
6. Add your `*.netlify.app` URL to the OAuth client's **Authorized JavaScript origins**
   (step 3.2) if you haven't.

Done — share the Netlify URL with your auditors.

---

## Project structure
```
index.html                 Vite entry (theme tokens live here)
vite.config.mjs
netlify.toml               build + /api/* redirect
src/
  globals.js               exposes window.React/ReactDOM for the ported files
  main.jsx                 import order (globals -> data -> api -> ui -> views -> app)
  data.js                  scoring + framework + mock data (unchanged)
  api.js                   data layer -> calls /api/* (mock fallback for offline dev)
  auth.js                  optional Google Sign-In
  ui.jsx audit.jsx analytics.jsx performance.jsx app.jsx   (UI, unchanged)
  tweaks-panel.jsx
netlify/functions/
  _sheets.js               shared Google Sheets helper (service account)
  employees.js             GET /api/employees
  audits.js                GET/POST /api/audits  (scoring + verified auditor + append)
```

## Not yet wired (intentional)
- **Email dispatch.** The Apps Script version emailed the scored report via `MailApp`.
  Netlify Functions can't send mail directly — add a provider (e.g. Resend or SendGrid) in
  `sendReport()` inside `audits.js`. The save works without it.
- **Sidebar user.** The sidebar still shows a placeholder name; wire it to the signed-in
  `session` when you want it dynamic.

## Troubleshooting
- **LRM list empty / 500 on `/api/employees`** → Sheet not shared with `GOOGLE_SA_EMAIL`, or
  `SHEET_ID` wrong, or Sheets API not enabled.
- **Auditor not detected** → `VITE_GOOGLE_CLIENT_ID` missing, or the site origin isn't in the
  OAuth client's Authorized origins, or you didn't redeploy after adding the var.
- **Build fails on `GOOGLE_SA_KEY`** → keep it wrapped in quotes with literal `\n`, exactly
  as in the JSON.
