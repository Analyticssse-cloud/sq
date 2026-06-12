# SolarSquare Quality Systems — React + Vercel

The QA audit dashboard: a **Vite + React** frontend with **serverless functions** (in `/api`)
that read and write your existing **Google Sheet**. Same UI and scoring as before; deployed
free on **Vercel** (Hobby plan — no credit card).

- **Frontend:** Vite + React (`src/`)
- **Backend:** Vercel Serverless Functions (`api/`)
- **Database:** your Google Sheet (tabs: `EmployeeMaster`, `Audits`, `meeting tracker`) via a service account
- **Auditor identity:** Google Sign-In (auto-detected), with a manual-email fallback

> **Just want the deploy steps?** See **`DEPLOY-VERCEL.md`** for the browser-only, no-Git-install
> walkthrough. This README covers the full setup (Google Cloud, the Sheet, the auth gate).

The two behaviors you fixed earlier are preserved:
- **LRM auto-fill** comes from `EmployeeMaster` (header matching is whitespace/case-tolerant).
- **Auditor email** auto-detects from Google Sign-In; if disabled, the form asks for it.

---

## 0. What you need first
- [Node.js 18+](https://nodejs.org) installed (only for local dev — not required to deploy).
- A **GitHub** account (Vercel deploys from a GitHub repo).
- A free **Vercel** account (sign in with GitHub).
- Access to the **Google Sheet** that holds `EmployeeMaster`, `Audits`, `meeting tracker`.
- A **Google Cloud** project (free) to create the service account + OAuth client.

---

## 1. Run it locally (optional, 5 min)
```bash
npm install
cp .env.example .env       # then fill in the values (see steps 2-3)
npm run dev                # http://localhost:5173  (UI only; uses mock data if no backend)
```
To run the **functions** locally too (serves UI + `/api/*` together):
```bash
npm i -g vercel
vercel dev                 # http://localhost:3000
```
If the backend isn't configured yet, the UI still loads using built-in mock data.

---

## 2. Let the backend read your Sheet (service account)
1. Go to **console.cloud.google.com** → create/select a project.
2. **APIs & Services → Library** → search **Google Sheets API** → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account.** Name it
   `qa-dashboard`, click **Done**.
4. Open the service account → **Keys → Add key → Create new key → JSON**. A file downloads.
5. From that JSON, copy into your `.env` (and later into Vercel):
   - `client_email`  → **GOOGLE_SA_EMAIL**
   - `private_key`   → **GOOGLE_SA_KEY** (paste the whole value, keep the `\n` sequences)
6. Copy your Sheet's ID from its URL → **SHEET_ID**.
7. **Share the Sheet** with the `GOOGLE_SA_EMAIL` address as **Editor** (just like sharing
   with a teammate). This is what authorizes the functions.

> Sheet tabs must be named `EmployeeMaster`, `Audits`, and `meeting tracker` with the headers
> described below.

### The `meeting tracker` tab
The master list of every scheduled meeting — it drives the **City & TL Summary**
(Total MS / **Meetings Done** / Pending / coverage) and the **New Audit lead picker**. Columns
are read **by name**, so order is flexible:

| lead_id | meeting_type | meeting_schedule_date | assigned_lrm_email | assigned_lrm | Combined City, Cluster | Entity id | Lead Link | Recording Link | Meeting Status | Meeting Done Date |
|---|---|---|---|---|---|---|---|---|---|---|

- **lead_id** must match the Lead ID written into `Audits` — that's the join key for
  "Audits Done" vs "Pending".
- **assigned_lrm_email** is joined to `EmployeeMaster` to resolve the LRM's **Team Lead**.
  Since the **Team Lead is the auditor**, each meeting routes to its LRM's TL.
- **Combined City, Cluster** — bare city ("Nagpur") or "City, Cluster" both work.
- **Entity id** — the lead's record id. Surfaced as a copyable chip on the audit screen.
- **Lead Link** — deep link to the lead in Lighthouse; rebuilt from **Entity id** if blank.
- **Recording Link** — URL of the call recording (the inline player streams it).
- **Meeting Status** *(optional)* — outcome text: `Completed` / `No-show` / `Rescheduled` /
  `Cancelled` / `Scheduled`. Spelling-tolerant (`Done`, `Visited`, `Attended` all count as done).
- **Meeting Done Date** *(recommended)* — the date the meeting was actually held. **This is the
  strongest completion signal:** a date present means the meeting happened, and it powers the
  **Meetings Done** metric (held ÷ due) regardless of the status text. Leave blank for meetings
  that haven't happened.

Test it: `vercel dev`, then open `http://localhost:3000/api/meetings` — you should see the
tracker rows as JSON, each with a resolved `assignedAuditorName` (the TL) plus `meetingStatus`,
`meetingDoneDate`, and `meetingDoneISO`.

### The `EmployeeMaster` tab
Drives the LRM autocomplete + auto-fill and the LRM→TL mapping. Header matching is tolerant, so
`TL Email`, `tl_email`, `Team Lead Email` all resolve. Test: open `/api/employees` — you should
see your LRM list as JSON.

---

## 3. Lock the app to authorized users (Google Sign-In)
When this is configured, signing in becomes **mandatory** — visitors see a login screen and the
app loads nothing (and `/api/*` returns data to nobody) until an authorized account signs in.

1. In Google Cloud → **APIs & Services → Credentials → Create credentials → OAuth client ID.**
2. Application type **Web application**. Under **Authorized JavaScript origins** add:
   - `http://localhost:3000` (local `vercel dev`)
   - your Vercel URL, e.g. `https://qa-dashboard.vercel.app`
3. Copy the **Client ID** → set **VITE_GOOGLE_CLIENT_ID** in `.env` (and Vercel).
4. Set **ALLOWED_DOMAIN** + **VITE_ALLOWED_DOMAIN** to `solarsquare.in` so only your
   Workspace accounts can sign in.

### Restricting to admins only
Domain-only access lets *anyone* at solarsquare.in in. To lock the app to a named list, set
**ALLOWED_EMAILS** (server) and **VITE_ALLOWED_EMAILS** (browser, for the message) to the same
comma-separated list:

```
ALLOWED_EMAILS=asha.q@solarsquare.in, ravi.k@solarsquare.in
VITE_ALLOWED_EMAILS=asha.q@solarsquare.in, ravi.k@solarsquare.in
```

Leave them blank to allow anyone on the domain. The **server** list (`ALLOWED_EMAILS`) is what
actually enforces access on every request. Adding/removing an admin = edit the env var and
redeploy; no code change.

> **Why both layers?** The login screen alone is not security — the `/api/*` functions verify
> the signed-in user's Google token (domain + allowlist) on **every** call, so data can't be
> pulled by hitting the URL directly.

### How the gate is configured (runtime, not build-time)
The browser learns whether the gate is on by calling **`/api/config`** at startup, which reads
your env vars **live on the server**. This is on purpose: `VITE_*` variables are otherwise
compiled into the JS at *build* time, and if they aren't exposed to the build the gate would
silently turn off. With runtime config you can change the client ID in Vercel and it takes
effect on the next request, and if `/api/config` can't be reached the app **fails closed**
(stays locked) instead of open.

---

## 4. Deploy on Vercel
Full step-by-step (including the no-Git-install GitHub upload) is in **`DEPLOY-VERCEL.md`**.
Short version:

1. Get this folder into a **GitHub repo** (private is fine).
2. **vercel.com → Add New… → Project → Import** the repo. The **Vite** preset is auto-detected;
   `vercel.json` already sets build command `npm run build` and output `dist`.
3. Add **Environment Variables** (same values as your `.env`): `SHEET_ID`, `GOOGLE_SA_EMAIL`,
   `GOOGLE_SA_KEY`, `ALLOWED_DOMAIN`, `ALLOWED_EMAILS`, `VITE_GOOGLE_CLIENT_ID`,
   `VITE_ALLOWED_DOMAIN`, `VITE_ALLOWED_EMAILS` (and optional `GMAIL_SENDER`).
4. **Deploy.** You'll get a `https://<project>.vercel.app` URL.
5. Add that URL to the OAuth client's **Authorized JavaScript origins** (step 3.2).

Every push to the repo's main branch auto-deploys. To change an env var, edit it in
**Vercel → Settings → Environment Variables**, then **Redeploy** so `VITE_*` changes are picked up.

---

## Project structure
```
index.html                 Vite entry (theme tokens live here)
vite.config.mjs
vercel.json                build config + SPA rewrite (everything non-/api → index.html)
DEPLOY-VERCEL.md           browser-only deploy walkthrough
src/
  globals.js               exposes window.React/ReactDOM for the ported files
  main.jsx                 import order (globals -> data -> api -> ui -> views -> app)
  data.js                  scoring + framework + mock data
  api.js                   data layer -> calls /api/* (mock fallback for offline dev)
  auth.js                  Google Sign-In + the front-end half of the access gate
  ui.jsx audit.jsx analytics.jsx performance.jsx summary.jsx app.jsx   (UI)
  tweaks-panel.jsx
api/                       Vercel Serverless Functions
  _adapter.js              wraps the ported handlers into Vercel (req,res) functions  [helper, not a route]
  _sheets.js               shared Google Sheets helper (service account)             [helper, not a route]
  _auth.js                 shared sign-in gate (verifies Google token + domain + allowlist)  [helper, not a route]
  config.js                GET /api/config   (public auth config, read at runtime)
  employees.js             GET /api/employees   (auth required)
  meetings.js              GET /api/meetings    (auth required)
  audits.js                GET/POST /api/audits (auth required; auditor = signed-in user)
```
> Files in `/api` whose names start with `_` are **not** turned into endpoints by Vercel —
> they're private helpers imported by the real functions.

## Not yet wired (intentional)
- **Email dispatch.** `api/audits.js` includes an optional Gmail-API sender (`sendReport()`);
  set `GMAIL_SENDER` + domain-wide delegation to enable it, or wire another provider
  (Resend/SendGrid). The save works without it.

## Troubleshooting
- **LRM list empty / 500 on `/api/employees`** → Sheet not shared with `GOOGLE_SA_EMAIL`, or
  `SHEET_ID` wrong, or Sheets API not enabled.
- **Auditor not detected** → `VITE_GOOGLE_CLIENT_ID` missing, or the site origin isn't in the
  OAuth client's Authorized origins, or you didn't redeploy after adding the var.
- **`/api/meetings` missing `meetingDoneISO`** → the deploy didn't pick up the new code, or the
  **Meeting Done Date** column isn't in the `meeting tracker` tab yet.
- **Build fails on `GOOGLE_SA_KEY`** → keep it wrapped in quotes with literal `\n`, exactly as
  in the JSON.
