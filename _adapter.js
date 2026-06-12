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

> Sheet tabs must be named `EmployeeMaster`, `Audits`, and `meeting tracker` with the same
> headers as before. If you're migrating, your existing Sheet already has the first two —
> just add the **meeting tracker** tab (see below).

### The `meeting tracker` tab
This is the master list of every scheduled meeting — it drives the **City & TL Summary**
(Total MS / Pending / coverage) and the **New Audit lead picker**. Columns (read by name, so
order is flexible):

| lead_id | meeting_type | meeting_schedule_date | assigned_lrm_email | assigned_lrm | Combined City, Cluster | Entity id | Lead Link | Recording Link |
|---|---|---|---|---|---|---|---|---|
| LMH172475 | fresh_meeting | 2026-06-10T03:30:00Z | poonam.s@solarsquare.in | poonam ashok sonawane | Nagpur | 69fd92816149dcb7e7205e56 | https://lighthouse.solarsquare.in/#/menu/lead/details/69fd92816149dcb7e7205e56/ | https://…/recording.mp3 |

- **lead_id** must match the Lead ID written into `Audits` — that's the join key for
  "Audits Done" vs "Pending".
- **assigned_lrm_email** is joined to `EmployeeMaster` to resolve the LRM's **Team Lead**.
  Since the **Team Lead is the auditor**, each meeting routes to its LRM's TL, and a TL's
  "My queue" in the picker is their own team's pending meetings.
- City is read straight from **Combined City, Cluster** (bare city or "City, Cluster" both
  work).
- **Entity id** — the lead's record id. Surfaced as a copyable chip on the audit screen.
- **Lead Link** — deep link to the lead in Lighthouse (`#/menu/lead/details/<Entity id>/`).
  The "Lighthouse" button uses this verbatim; if the cell is blank the function rebuilds it
  from **Entity id**.
- **Recording Link** — URL of the call recording. The inline player streams it; a blank cell
  shows "No recording linked".

Test it: `netlify dev`, then open `http://localhost:8888/api/meetings` — you should see the
tracker rows as JSON, each with a resolved `assignedAuditorName` (the TL).

Test it: `netlify dev`, then open `http://localhost:8888/api/employees` — you should see your
LRM list as JSON. The LRM autocomplete now works against real data.

---

## 3. Lock the app to authorized users (Google Sign-In)
When this is configured, signing in becomes **mandatory** — visitors see a login screen and
the app loads nothing (and the `/api/*` endpoints return data to *nobody*) until an authorized
account signs in.

1. In Google Cloud → **APIs & Services → Credentials → Create credentials → OAuth client ID.**
2. Application type **Web application**. Under **Authorized JavaScript origins** add:
   - `http://localhost:8888` (local `netlify dev`)
   - your Netlify URL, e.g. `https://your-site.netlify.app`
3. Copy the **Client ID** → set **VITE_GOOGLE_CLIENT_ID** in `.env` (and Netlify).
4. Set **ALLOWED_DOMAIN** + **VITE_ALLOWED_DOMAIN** to `solarsquare.in` so only your
   Workspace accounts can sign in.

### Restricting to admins only
Domain-only access lets *anyone* at solarsquare.in in. To lock the app to a named list of
admins, set **ALLOWED_EMAILS** (server) and **VITE_ALLOWED_EMAILS** (browser, for the
"not authorized" message) to the same comma-separated list:

```
ALLOWED_EMAILS=asha.q@solarsquare.in, ravi.k@solarsquare.in
VITE_ALLOWED_EMAILS=asha.q@solarsquare.in, ravi.k@solarsquare.in
```

Leave them blank to allow anyone on the domain. The **server** list (`ALLOWED_EMAILS`) is what
actually enforces access on every request — the browser one is only so the login screen can
say "ask an admin" without a round-trip. Adding/removing an admin = edit the env var and
redeploy; no code change.

> **Why both layers?** The login screen alone is not security — the `/api/*` functions verify
> the signed-in user's Google token (domain + allowlist) on **every** call, so the data can't
> be pulled by hitting the URL directly.

### How the gate is configured (runtime, not build-time)
The browser learns whether the gate is on by calling **`/api/config`** at startup, which reads
your env vars **live on the server**. This is on purpose: `VITE_*` variables are otherwise
compiled into the JS at *build* time, and if Netlify doesn't expose them to the build (wrong
**scope** or **deploy context**) the gate would silently turn off. With runtime config you can
change the client ID in Netlify and it takes effect on the next request — **no rebuild needed**
— and if `/api/config` can't be reached the app **fails closed** (stays locked) instead of open.

> **Netlify gotcha:** when you add `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_ID` in
> Site configuration → Environment variables, make sure its **Scopes** include *Functions*
> (so `/api/config` can read it) and it's set for the **Production** deploy context. You can
> verify it's live by opening `https://<your-site>/api/config` — it should show
> `{"enabled":true,...}` with your client ID.

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
   `ALLOWED_DOMAIN`, `ALLOWED_EMAILS`, `VITE_GOOGLE_CLIENT_ID`, `VITE_ALLOWED_DOMAIN`,
   `VITE_ALLOWED_EMAILS`.
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
  _auth.js                 shared sign-in gate (verifies Google token + domain + allowlist)
  config.js                GET /api/config  (public auth config, read at runtime)
  employees.js             GET /api/employees   (auth required)
  meetings.js              GET /api/meetings    (auth required)
  audits.js                GET/POST /api/audits (auth required; auditor = signed-in user)
```

## Not yet wired (intentional)
- **Email dispatch.** The Apps Script version emailed the scored report via `MailApp`.
  Netlify Functions can't send mail directly — `audits.js` includes an optional Gmail-API
  sender (`sendReport()`); set `GMAIL_SENDER` + domain-wide delegation to enable it, or wire
  another provider (Resend/SendGrid). The save works without it.

## Troubleshooting
- **LRM list empty / 500 on `/api/employees`** → Sheet not shared with `GOOGLE_SA_EMAIL`, or
  `SHEET_ID` wrong, or Sheets API not enabled.
- **Auditor not detected** → `VITE_GOOGLE_CLIENT_ID` missing, or the site origin isn't in the
  OAuth client's Authorized origins, or you didn't redeploy after adding the var.
- **Build fails on `GOOGLE_SA_KEY`** → keep it wrapped in quotes with literal `\n`, exactly
  as in the JSON.
