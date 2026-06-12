// audits.js
//   GET  /api/audits  -> all audit records (powers Analytics + My Performance)
//   POST /api/audits  -> score, verify auditor, append a row, return { success, overall }
//
// Mirrors the scoring + column-aligned append from the Apps Script backend so the Sheet
// schema stays identical. Email dispatch (the old MailApp step) is intentionally left as a
// TODO — wire an email provider (Resend/SendGrid) in sendReport() when you're ready.
const { readSheet, appendRow, rowsToObjects, pick, json } = require('./_sheets');
const { requireUser, deny } = require('./_auth');
const { google } = require('googleapis');

const SECTIONS = [
  { key: 'opening',       count: 2 },
  { key: 'selling',       count: 5 },
  { key: 'qualification', count: 6 },
  { key: 'objection',     count: 1 },
  { key: 'closing',       count: 3 },
];
const PASS_THRESHOLD = 80;

const AUDIT_HEADERS = [
  'AuditID', 'LeadID',
  'LRM Name', 'LRM Email', 'TL Name', 'TL Email', 'ZSM Name', 'ZSM Email', 'ADOS Name', 'ADOS Email',
  'Meeting Scheduled Date', 'Meeting Status', 'Status After Audit',
  'Auditor Name', 'Auditor Email', 'Audit Date', 'Overall %', 'Section Scores (JSON)', 'Answers (JSON)',
  'Strengths', 'Improvements', 'Action Items',
];

function nameFromEmail(email) {
  if (!email) return '';
  return String(email).split('@')[0].split(/[._]+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Build the scored-report email body (ported from the Apps Script MailApp template).
function reportHtml(rec) {
  const pass = rec.overall >= PASS_THRESHOLD;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const rows = SECTIONS.map(s => {
    const v = rec.sectionPct[s.key];
    return '<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">' + cap(s.key) + '</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600">' + (v == null ? 'N/A' : v + '%') + '</td></tr>';
  }).join('');
  const note = (label, txt) => txt ? '<h3 style="margin:16px 0 4px">' + label + '</h3><p style="margin:0;font-size:14px;line-height:1.5">' + txt + '</p>' : '';
  const box = (label, val) => '<div style="flex:1;text-align:center;padding:12px;border:1px solid #e5e7eb;border-radius:8px"><div style="font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:.05em">' + label + '</div><div style="font-size:22px;font-weight:700">' + (typeof val === 'number' ? val + '%' : val) + '</div></div>';
  return '<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2937">'
    + '<h2 style="margin:0 0 4px">QA Audit Report</h2>'
    + '<p style="color:#6b7280;margin:0 0 16px">SolarSquare Quality Systems</p>'
    + '<table style="width:100%;border-collapse:collapse;font-size:14px">'
    + '<tr><td style="padding:6px 12px;color:#6b7280">LRM</td><td style="padding:6px 12px;text-align:right">' + rec.agentName + '</td></tr>'
    + '<tr><td style="padding:6px 12px;color:#6b7280">Lead ID</td><td style="padding:6px 12px;text-align:right">' + rec.leadId + '</td></tr>'
    + '<tr><td style="padding:6px 12px;color:#6b7280">Audited by</td><td style="padding:6px 12px;text-align:right">' + (rec.auditorName || '') + '</td></tr>'
    + '</table>'
    + '<div style="display:flex;gap:12px;margin:16px 0">' + box('Overall', rec.overall) + box('Result', pass ? 'PASS' : 'FAIL') + '</div>'
    + '<h3 style="margin:16px 0 6px">Section scores</h3>'
    + '<table style="width:100%;border-collapse:collapse;font-size:14px">' + rows + '</table>'
    + note('Strengths', rec.notes.strengths) + note('Areas to improve', rec.notes.improvements) + note('Action items', rec.notes.actionItems)
    + '</div>';
}

// Email the report to LRM/TL/ZSM/ADOS via the Gmail API (Google Workspace).
// No-op unless GMAIL_SENDER is set. Requires the service account to have domain-wide
// delegation for the gmail.send scope, and GMAIL_SENDER to be a real mailbox in your domain.
async function sendReport(rec) {
  const sender = process.env.GMAIL_SENDER; // e.g. qa@solarsquare.in
  if (!sender) return { skipped: true };
  const to = [rec.agentEmail, rec.tlEmail, rec.mgrEmail, rec.adosEmail]
    .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  if (!to.length) return { skipped: true };

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SA_EMAIL,
    key: (process.env.GOOGLE_SA_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: sender, // impersonate this mailbox (needs domain-wide delegation)
  });
  const gmail = google.gmail({ version: 'v1', auth });

  const pass = rec.overall >= PASS_THRESHOLD;
  const subject = 'QA Audit \u00b7 ' + rec.agentName + ' \u00b7 ' + rec.overall + '% (' + (pass ? 'Pass' : 'Fail') + ') \u00b7 Lead ' + rec.leadId;
  const message =
    'From: ' + sender + '\r\n' +
    'To: ' + to.join(', ') + '\r\n' +
    'Subject: =?UTF-8?B?' + Buffer.from(subject, 'utf8').toString('base64') + '?=\r\n' +
    'MIME-Version: 1.0\r\n' +
    'Content-Type: text/html; charset=UTF-8\r\n' +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    Buffer.from(reportHtml(rec), 'utf8').toString('base64');
  const raw = Buffer.from(message, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
  return { sent: to };
}

function scoreAnswers(answers) {
  const sectionPct = {};
  SECTIONS.forEach(s => {
    let applicable = 0, yes = 0;
    for (let ii = 0; ii < s.count; ii++) {
      const a = answers[s.key + '-' + ii];
      if (a === 'NA' || a == null) continue;
      applicable++; if (a === 'Yes') yes++;
    }
    sectionPct[s.key] = applicable === 0 ? null : Math.round((yes / applicable) * 100);
  });
  const vals = SECTIONS.map(s => sectionPct[s.key]).filter(v => v != null);
  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  return { sectionPct, overall };
}

function rowToRecord(r) {
  const parse = v => { try { return JSON.parse(v || '{}'); } catch (e) { return {}; } };
  const callDate = r['Audit Date'] ? String(r['Audit Date']) : '';
  return {
    id: r['AuditID'], leadId: r['LeadID'],
    agentName: r['LRM Name'], agentEmail: r['LRM Email'],
    tlName: r['TL Name'], tlEmail: r['TL Email'],
    mgrName: r['ZSM Name'], mgrEmail: r['ZSM Email'],
    adosName: r['ADOS Name'], adosEmail: r['ADOS Email'],
    meetingDate: r['Meeting Scheduled Date'] ? String(r['Meeting Scheduled Date']) : '',
    meetingStatus: r['Meeting Status'], meetingStatusAfterAudit: r['Status After Audit'],
    auditorName: r['Auditor Name'], auditorEmail: r['Auditor Email'],
    callDate,
    ts: new Date(callDate || 0).getTime() || 0,
    overall: Number(r['Overall %']) || 0,
    sectionPct: parse(r['Section Scores (JSON)']),
    answers: parse(r['Answers (JSON)']),
    notes: { strengths: r['Strengths'], improvements: r['Improvements'], actionItems: r['Action Items'] },
  };
}

async function getEmployee(agentName) {
  const rows = rowsToObjects(await readSheet('EmployeeMaster!A:Z'));
  const norm = s => String(s || '').trim().toLowerCase();
  const hit = rows.find(r => norm(pick(r, ['LRM Name', 'LRM', 'Agent Name', 'Name'])) === norm(agentName));
  if (!hit) return null;
  return {
    agentName: pick(hit, ['LRM Name', 'LRM', 'Agent Name', 'Name']), agentEmail: pick(hit, ['LRM Email', 'Agent Email', 'Email']),
    tlName: pick(hit, ['TL Name', 'Team Lead Name', 'Team Lead', 'TL']), tlEmail: pick(hit, ['TL Email', 'Team Lead Email', 'TL Mail']),
    mgrName: pick(hit, ['ZSM Name', 'Manager Name', 'ZSM']), mgrEmail: pick(hit, ['ZSM Email', 'Manager Email']),
    adosName: pick(hit, ['ADOS Name', 'ADOS']), adosEmail: pick(hit, ['ADOS Email']),
  };
}

async function handleGet() {
  const rows = rowsToObjects(await readSheet('Audits!A:V'));
  const records = rows.filter(r => r['AuditID']).map(rowToRecord);
  return json(200, records);
}

async function handlePost(event, verifiedUser) {
  const p = JSON.parse(event.body || '{}');

  const emp = await getEmployee(p.agentName);
  if (!emp) return json(200, { success: false, message: 'LRM "' + p.agentName + '" not found in EmployeeMaster.' });

  // Auditor identity is the signed-in user the gate already verified — it can't be spoofed
  // from the form body. (Manual fields remain a fallback for local dev with sign-in off.)
  const auditorEmail = (verifiedUser && verifiedUser.email) || String(p.auditorEmail || '').trim();
  const auditorName  = (verifiedUser && verifiedUser.name) || p.auditorName || nameFromEmail(auditorEmail);
  if (!auditorEmail) return json(200, { success: false, message: 'Auditor email missing (sign in or enter it).' });

  const sc = scoreAnswers(p.answers || {});
  const id = 'A' + Date.now();
  const auditDate = p.auditDate || new Date().toISOString().slice(0, 10);
  const notes = p.notes || {};

  const rowObj = {
    'AuditID': id, 'LeadID': p.leadId,
    'LRM Name': emp.agentName, 'LRM Email': emp.agentEmail,
    'TL Name': emp.tlName, 'TL Email': emp.tlEmail,
    'ZSM Name': emp.mgrName, 'ZSM Email': emp.mgrEmail,
    'ADOS Name': emp.adosName, 'ADOS Email': emp.adosEmail,
    'Meeting Scheduled Date': p.meetingDate || '',
    'Meeting Status': p.meetingDate ? 'Scheduled' : 'Pending',
    'Status After Audit': sc.overall >= PASS_THRESHOLD ? 'Confirmed' : 'Rescheduled',
    'Auditor Name': auditorName, 'Auditor Email': auditorEmail,
    'Audit Date': auditDate, 'Overall %': sc.overall,
    'Section Scores (JSON)': JSON.stringify(sc.sectionPct),
    'Answers (JSON)': JSON.stringify(p.answers || {}),
    'Strengths': notes.strengths || '', 'Improvements': notes.improvements || '', 'Action Items': notes.actionItems || '',
  };

  // Align to the live header row so values always land in the right column.
  let headers = AUDIT_HEADERS;
  try {
    const head = (await readSheet('Audits!1:1'))[0];
    if (head && head.length) headers = head.map(h => String(h).trim());
  } catch (e) { /* fall back to the canonical schema */ }
  const rowArr = headers.map(h => (rowObj[h] != null ? rowObj[h] : ''));

  await appendRow('Audits!A:A', rowArr);

  // Email the scored report to LRM/TL/ZSM/ADOS (no-op if email isn't configured).
  let emailNote = null;
  try {
    const r = await sendReport({
      agentName: emp.agentName, agentEmail: emp.agentEmail,
      tlEmail: emp.tlEmail, mgrEmail: emp.mgrEmail, adosEmail: emp.adosEmail,
      leadId: p.leadId, auditorName, overall: sc.overall, sectionPct: sc.sectionPct, notes,
    });
    if (r && r.skipped) emailNote = 'email-not-configured';
  } catch (e) {
    emailNote = 'email-failed: ' + (e && e.message || e);
    console.warn('[audits] report email failed:', emailNote);
  }

  return json(200, { success: true, id, overall: sc.overall, email: emailNote });
}

exports.handler = async (event) => {
  try {
    const auth = await requireUser(event);
    if (!auth.ok) return deny(auth);
    if (event.httpMethod === 'POST') return await handlePost(event, auth.user);
    return await handleGet();
  } catch (e) {
    return json(500, { success: false, error: String(e && e.message || e) });
  }
};

// --- Vercel adapter: expose the handler as a Vercel serverless function ---
module.exports = require('./_adapter')(exports.handler);
