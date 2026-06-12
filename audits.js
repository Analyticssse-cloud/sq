// _auth.js — sign-in enforcement shared by every Netlify Function.
// Files prefixed with "_" are NOT deployed as endpoints; they're imported by the others.
//
// The browser sends the signed-in user's Google ID token as "Authorization: Bearer <token>".
// requireUser() verifies that token with Google, then runs it past two gates, BOTH set via
// environment variables (Netlify -> Site configuration -> Environment variables):
//
//   ALLOWED_DOMAIN  — only accept accounts on this Workspace domain (e.g. solarsquare.in).
//   ALLOWED_EMAILS  — comma/space/newline-separated allowlist of the EXACT people allowed to
//                     use the app (your admins). Leave blank to allow ANY verified account on
//                     ALLOWED_DOMAIN; set it to lock the app to a named list.
//
// This is the REAL gate. The login screen in the browser is just UX — without this, the
// /api/* endpoints would still hand data to anyone who hits the URL directly.
const { json } = require('./_sheets');

function parseList(v) {
  return String(v || '').split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
}

function bearer(event) {
  const h = (event && event.headers) || {};
  const raw = h.authorization || h.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(raw).trim());
  return m ? m[1] : '';
}

// Verify the caller and check both gates. Returns { ok, status, user, reason }.
async function requireUser(event) {
  const token = bearer(event);
  if (!token) return { ok: false, status: 401, reason: 'not-signed-in' };

  let p;
  try {
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
    if (!r.ok) return { ok: false, status: 401, reason: 'invalid-token' };
    p = await r.json();
  } catch (e) {
    return { ok: false, status: 401, reason: 'verify-failed' };
  }

  // The token must have been minted for OUR OAuth client (prevents replaying a token that
  // some other app on the same domain issued).
  const aud = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  if (aud && p.aud && p.aud !== aud) return { ok: false, status: 401, reason: 'wrong-audience' };
  if (p.email_verified === false || p.email_verified === 'false') return { ok: false, status: 401, reason: 'email-unverified' };

  const email = String(p.email || '').toLowerCase();
  if (!email) return { ok: false, status: 401, reason: 'no-email' };

  const domain = (process.env.ALLOWED_DOMAIN || '').toLowerCase();
  if (domain && p.hd !== domain && !email.endsWith('@' + domain)) {
    return { ok: false, status: 403, reason: 'wrong-domain' };
  }

  const allow = parseList(process.env.ALLOWED_EMAILS);
  if (allow.length && allow.indexOf(email) < 0) {
    return { ok: false, status: 403, reason: 'not-authorized' };
  }

  return { ok: true, status: 200, user: { email, name: p.name || '', picture: p.picture || '' } };
}

// Standard refusal body. `authError:true` tells the frontend to show the login / access-denied
// screen rather than silently falling back to demo data.
function deny(res) {
  return json(res.status || 401, { error: res.reason || 'unauthorized', authError: true });
}

module.exports = { requireUser, deny, parseList };
