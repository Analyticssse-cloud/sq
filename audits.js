// _sheets.js — shared Google Sheets helper for the Netlify Functions.
// Files prefixed with "_" are NOT deployed as endpoints; they're imported by the others.
// Auth uses a Google service account (no end-user consent needed). Share your Sheet with
// the service account's email as an Editor.
const { google } = require('googleapis');

function sheetsClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SA_EMAIL,
    null,
    (process.env.GOOGLE_SA_KEY || '').replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

async function readSheet(range) {
  const s = sheetsClient();
  const res = await s.spreadsheets.values.get({ spreadsheetId: process.env.SHEET_ID, range });
  return res.data.values || [];
}

async function appendRow(range, row) {
  const s = sheetsClient();
  await s.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

// values[] (incl. header row) -> array of objects keyed by trimmed header (whitespace-tolerant)
function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  const head = values[0].map(h => String(h).trim());
  return values.slice(1).map(r => {
    const o = {}; head.forEach((h, i) => { o[h] = r[i]; }); return o;
  });
}

// Tolerant field lookup: matches a header by any of `candidates`, ignoring case, spaces,
// underscores and punctuation. So "TL Email", "tl_email", "Team Lead Email" all resolve.
function pick(row, candidates) {
  const squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const want = candidates.map(squash);
  for (const rk of Object.keys(row)) {
    if (want.indexOf(squash(rk)) >= 0) return row[rk];
  }
  return '';
}

function json(status, body) {
  return { statusCode: status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

module.exports = { readSheet, appendRow, rowsToObjects, pick, json };
