// config.js  →  GET /api/config
// Serves the PUBLIC front-end auth config, read from environment variables at RUNTIME.
//
// Why this exists: VITE_* variables are compiled into the JS at *build* time, so if Netlify
// doesn't expose them to the build (wrong scope/context) the gate silently turns off. Reading
// them here at runtime removes that whole class of failure — change the client ID in Netlify
// and it takes effect on the next request, no rebuild needed.
//
// Only NON-secret values are returned (the OAuth *client ID* is public by design; it ships in
// every browser anyway). The service-account key, allowlist, etc. are NEVER sent here.
const { json } = require('./_sheets');

exports.handler = async () => {
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
  const allowedDomain = (process.env.ALLOWED_DOMAIN || process.env.VITE_ALLOWED_DOMAIN || '').toLowerCase();
  const allowlist = String(process.env.ALLOWED_EMAILS || process.env.VITE_ALLOWED_EMAILS || '')
    .split(/[,\s]+/).map(s => s.trim()).filter(Boolean);

  return json(200, {
    // gate is ON whenever a client ID is configured
    enabled: !!clientId,
    clientId,
    allowedDomain,
    // booleans only — we don't leak the actual admin list to the browser
    restricted: allowlist.length > 0,
  });
};

// --- Vercel adapter: expose the handler as a Vercel serverless function ---
module.exports = require('./_adapter')(exports.handler);
