# ----------------------------------------------------------------------------
# Copy this file to ".env" for local dev, and set the SAME keys in the Netlify
# dashboard (Site configuration -> Environment variables) for production.
# NEVER commit the real .env file.
# ----------------------------------------------------------------------------

# --- Google Sheet (your database) ---
# The ID is the long string in the Sheet URL: docs.google.com/spreadsheets/d/<THIS>/edit
SHEET_ID=

# --- Service account (lets the Netlify Functions read/write the Sheet) ---
# From the JSON key you download in Google Cloud. Share the Sheet with this email as Editor.
GOOGLE_SA_EMAIL=qa-dashboard@your-project.iam.gserviceaccount.com
# Paste the private_key value EXACTLY as in the JSON, including the \n sequences, on one line.
GOOGLE_SA_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# --- Auditor sign-in (REQUIRED in production to lock the app) ---
# When VITE_GOOGLE_CLIENT_ID (below) is set, signing in is MANDATORY: the app shows a login
# screen and loads nothing until an authorized account signs in. These server-side vars are
# the REAL gate (the browser check is only UX) and are enforced on every /api/* request.

# Only accept accounts on this Workspace domain.
ALLOWED_DOMAIN=solarsquare.in

# Admin allowlist — comma/space-separated list of the EXACT emails allowed to use the app.
# Leave BLANK to allow anyone on ALLOWED_DOMAIN; fill it in to lock the app to named admins.
# e.g. ALLOWED_EMAILS=asha.q@solarsquare.in, ravi.k@solarsquare.in
ALLOWED_EMAILS=

# --- Frontend build vars (must be prefixed VITE_ to reach the browser) ---
# Google OAuth *Web* client ID. Leave blank to disable the gate (manual-email demo mode).
VITE_GOOGLE_CLIENT_ID=
VITE_ALLOWED_DOMAIN=solarsquare.in
# Mirror of ALLOWED_EMAILS so the login screen can show "not authorized" without a round-trip
# (the server list above is still what actually enforces it). Keep the two in sync.
VITE_ALLOWED_EMAILS=
