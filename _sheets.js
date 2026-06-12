// _adapter.js — bridges the ported "Netlify-style" handlers to Vercel's serverless format.
// Files in /api prefixed with "_" are NOT turned into routes by Vercel, so this and
// _sheets.js / _auth.js stay private helpers.
//
// The backend handlers were written as:  async (event) => ({ statusCode, headers, body })
// Vercel functions are:                  async (req, res) => { ... res.end() }
// This wrapper converts a Vercel (req,res) into the `event` the handlers expect, runs the
// handler, and writes its returned object back onto `res`. Lets the backend run unchanged.
module.exports = function toVercel(handler) {
  return async (req, res) => {
    // Vercel auto-parses JSON bodies into objects; the handlers expect a raw string.
    let body = '';
    if (req.body != null) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const event = {
      headers: req.headers || {},
      httpMethod: req.method || 'GET',
      body,
      queryStringParameters: req.query || {},
    };

    try {
      const r = (await handler(event)) || {};
      const headers = r.headers || { 'Content-Type': 'application/json' };
      Object.keys(headers).forEach(k => res.setHeader(k, headers[k]));
      res.statusCode = r.statusCode || 200;
      res.end(r.body != null ? r.body : '');
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String((e && e.message) || e) }));
    }
  };
};
