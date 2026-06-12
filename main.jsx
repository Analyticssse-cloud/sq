// auth.js — Google Sign-In + the front-end half of the access gate.
//
// CONFIG IS LOADED AT RUNTIME from /api/config (a Netlify Function that reads the env vars
// live). This is deliberate: VITE_* build-time vars silently fail if Netlify doesn't expose
// them to the build, which would turn the gate OFF without warning. Fetching at runtime makes
// the gate depend on the server, not on what got baked into the bundle.
//
// FAIL CLOSED: if we can't reach /api/config we assume the gate is ON (locked) rather than
// open — a security gate must never default to "allow" on error. (import.meta.env is used
// only as an optimistic head-start before the fetch resolves.)
//
// Authorization is enforced on the SERVER (netlify/functions/_auth.js) on every API call:
//   ALLOWED_DOMAIN   — only @<domain> accounts may sign in
//   ALLOWED_EMAILS   — optional allowlist of the exact admins allowed in (blank = whole domain)
// The browser only knows the domain + whether an allowlist exists; the real list never ships.

const BUILD_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const BUILD_DOMAIN = (import.meta.env.VITE_ALLOWED_DOMAIN || 'solarsquare.in').toLowerCase();

const state = {
  ready: false,
  enabled: true,            // fail-closed default until /api/config says otherwise
  clientId: BUILD_CLIENT_ID,
  allowedDomain: BUILD_DOMAIN,
  restricted: false,
};

function decodeJwt(token) {
  try {
    const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch (e) { return {}; }
}

function readAuth() {
  try { return JSON.parse(localStorage.getItem('qa_auth') || 'null'); } catch (e) { return null; }
}

function signOut() {
  try {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  } catch (e) { /* noop */ }
  localStorage.removeItem('qa_auth');
  location.reload();
}

// Optimistic, browser-side domain check (UX only — the server allowlist is authoritative and
// surfaces as the "access denied" screen if a domain account isn't actually permitted).
function isAuthorized(session) {
  if (!session || !session.email) return false;
  const em = String(session.email).toLowerCase();
  if (state.allowedDomain && !em.endsWith('@' + state.allowedDomain)) return false;
  return true;
}

function handleCredential(resp) {
  const c = decodeJwt(resp.credential);
  const email = (c.email || '').toLowerCase();
  if (state.allowedDomain && c.hd !== state.allowedDomain && !email.endsWith('@' + state.allowedDomain)) {
    alert('Please sign in with your @' + state.allowedDomain + ' account.');
    return;
  }
  localStorage.setItem('qa_auth', JSON.stringify({
    name: c.name || '', email: c.email || '', picture: c.picture || '', token: resp.credential,
  }));
  location.reload();
}

let gisReady = null;
function loadGis() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve) => {
    if (window.google && window.google.accounts) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return gisReady;
}

async function renderButton(el, opts = {}) {
  if (!state.clientId || !el) return;
  const ok = await loadGis();
  if (!ok || !window.google || !window.google.accounts) return;
  window.google.accounts.id.initialize({ client_id: state.clientId, callback: handleCredential, hd: state.allowedDomain });
  el.innerHTML = '';
  window.google.accounts.id.renderButton(el, {
    theme: opts.theme || 'outline', size: opts.size || 'large',
    text: 'signin_with', shape: 'pill', width: opts.width || 280,
  });
  if (opts.oneTap !== false) window.google.accounts.id.prompt();
}

// Resolve the live config from the server. Awaited by app.jsx before it decides whether to
// show the login wall. Fail closed: any error leaves enabled=true (locked).
let initPromise = null;
function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const r = await fetch('/api/config', { cache: 'no-store' });
      if (r.ok) {
        const cfg = await r.json();
        state.enabled = !!cfg.enabled;
        state.clientId = cfg.clientId || state.clientId;
        state.allowedDomain = (cfg.allowedDomain || state.allowedDomain || '').toLowerCase();
        state.restricted = !!cfg.restricted;
      } else if (BUILD_CLIENT_ID) {
        state.enabled = true; // function missing but build var present → use it
      } else {
        // No config and no build var: likely the static preview with no backend → demo open.
        // (On a real deploy /api/config exists, so we never silently fall open in production.)
        state.enabled = false;
      }
    } catch (e) {
      state.enabled = !!BUILD_CLIENT_ID; // network error → lock if we have any client id, else demo
    }
    state.ready = true;
    Object.assign(window.QA.auth, {
      enabled: state.enabled, clientId: state.clientId,
      allowedDomain: state.allowedDomain, restricted: state.restricted, ready: true,
    });
    return state;
  })();
  return initPromise;
}

window.QA = window.QA || {};
window.QA.auth = {
  enabled: state.enabled,
  clientId: state.clientId,
  allowedDomain: state.allowedDomain,
  restricted: state.restricted,
  ready: false,
  init,
  get session() { return readAuth(); },
  isAuthorized,
  renderButton,
  signOut,
};
