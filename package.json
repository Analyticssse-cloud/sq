// meetings.js  →  GET /api/meetings
// Returns the "meeting tracker" tab as objects — the master list of every scheduled
// meeting. Powers the New Audit lead picker (pending = tracker minus audited) and the
// City & TL Summary (Total MS / Pending / coverage).
//
// Each row is joined to EmployeeMaster by assigned_lrm_email so we can resolve the LRM's
// Team Lead. Per the agreed model, THE TEAM LEAD IS THE AUDITOR — so a meeting's assigned
// auditor is its LRM's TL, and a TL's "My queue" is simply their own team's meetings.
//
// Expected tab name: "meeting tracker"  (columns, in order):
//   lead_id | meeting_type | meeting_schedule_date | assigned_lrm_email | assigned_lrm
//   | Combined City, Cluster | Entity id | Lead Link | Recording Link
//   | Meeting Status | Meeting Done Date
// (Both outcome columns are optional. "Meeting Done Date" is the strongest signal — a date
//  present means the meeting was held; it overrides/stands in for "Meeting Status". If both
//  are absent the dashboard falls back to date-based "due".)
const { readSheet, rowsToObjects, pick, json } = require('./_sheets');
const { requireUser, deny } = require('./_auth');

// "June 9, 2026, 8:30 AM" (or an ISO string) -> "2026-06-09", using local parts to avoid
// any UTC date-shift. Returns '' if unparseable.
function toISODate(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  // already ISO-ish
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Pull the "Combined City, Cluster" value into a {city, cluster} pair. The value may be a
// bare city ("Nagpur"), "City, Cluster", or "City - Cluster".
function splitCityCluster(v) {
  const s = String(v || '').trim();
  if (!s) return { city: 'Unassigned', cluster: '—' };
  let parts = null;
  if (s.indexOf(',') >= 0) parts = s.split(',');
  else if (s.indexOf(' - ') >= 0) parts = s.split(' - ');
  else if (s.indexOf('-') >= 0) parts = s.split('-');
  if (parts && parts.length > 1) {
    const city = parts[0].trim();
    return { city, cluster: parts.slice(1).join(' ').trim() ? city + ' · ' + parts.slice(1).join(' ').trim() : city };
  }
  return { city: s, cluster: s };
}

// tolerant header lookup is provided by _sheets.pick (case/space/underscore-insensitive)

// Normalize whatever the sheet's status column says into a canonical outcome so the
// dashboard's "Meetings Done" logic is spelling-proof. Blank = not yet updated / upcoming.
function normMeetingStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  if (/(complete|done|visit|happened|\bmet\b|attended|conducted)/.test(s)) return 'Completed';
  if (/(no.?show|absent|not.?reach|missed|unavail)/.test(s)) return 'No-show';
  if (/(reschedul|postpone|re-?meet|re.?visit)/.test(s)) return 'Rescheduled';
  if (/(cancel|drop|abort)/.test(s)) return 'Cancelled';
  if (/(schedul|upcoming|pending|planned|open)/.test(s)) return 'Scheduled';
  return String(raw).trim(); // unknown: pass through verbatim
}

exports.handler = async (event) => {
  const auth = await requireUser(event);
  if (!auth.ok) return deny(auth);
  try {
    // 1) LRM email -> Team Lead (the auditor). Tolerant headers so "TL Email",
    //    "tl_email", "Team Lead Email" etc. all resolve.
    const emps = rowsToObjects(await readSheet('EmployeeMaster!A:Z'));
    const norm = s => String(s || '').trim().toLowerCase();
    const tlByLrm = {};
    emps.forEach(e => {
      const em = norm(pick(e, ['LRM Email', 'Agent Email', 'Email']));
      if (em) tlByLrm[em] = {
        tlName: pick(e, ['TL Name', 'Team Lead Name', 'Team Lead', 'TL']) || '',
        tlEmail: pick(e, ['TL Email', 'Team Lead Email', 'TL Mail']) || '',
      };
    });

    // 2) the meeting tracker rows. Read A:Z so the newer columns (Entity id, Lead Link,
    //    Recording Link) are included regardless of exact position; pick() resolves by name.
    const rows = rowsToObjects(await readSheet("'meeting tracker'!A:Z"));
    const meetings = rows.map(r => {
      const leadId = pick(r, ['lead_id', 'leadid', 'lead id']);
      if (!leadId) return null;
      const lrmEmail = pick(r, ['assigned_lrm_email', 'assigned lrm email', 'lrm email']);
      const { city, cluster } = splitCityCluster(pick(r, ['Combined City, Cluster', 'combined city cluster', 'city', 'combined city']));
      const sched = pick(r, ['meeting_schedule_date', 'meeting schedule date', 'meeting scheduled date']);
      const tl = tlByLrm[norm(lrmEmail)] || { tlName: '', tlEmail: '' };
      // New tracker columns:
      const entityId = String(pick(r, ['Entity id', 'entity id', 'entityid', 'entity_id']) || '').trim();
      const sheetLeadLink = String(pick(r, ['Lead Link', 'lead link', 'leadlink', 'lead_link']) || '').trim();
      const recordingUrl = String(pick(r, ['Recording Link', 'recording link', 'recordinglink', 'recording_link', 'recording url', 'recording_url']) || '').trim();
      // Meeting outcome — optional columns; power the "Meetings Done" metric in the summary.
      // A populated "Meeting Done Date" is the source of truth: its presence == meeting held.
      const doneRaw = pick(r, ['Meeting Done Date', 'meeting done date', 'meeting_done_date', 'done date', 'done_date', 'meeting completed date', 'completed date', 'completion date', 'actual meeting date']);
      const meetingDoneISO = toISODate(doneRaw);
      const statusText = normMeetingStatus(pick(r, ['Meeting Status', 'meeting_status', 'meeting status', 'meeting_outcome', 'meeting outcome', 'outcome', 'disposition', 'status']));
      // Done-date wins: if it's filled the meeting happened, regardless of (or absent) status text.
      const meetingStatus = meetingDoneISO ? 'Completed' : statusText;
      // Prefer the sheet's Lead Link; otherwise build the entity-keyed Lighthouse deep link.
      const leadLink = sheetLeadLink || (entityId ? 'https://lighthouse.solarsquare.in/#/menu/lead/details/' + entityId + '/' : '');
      return {
        leadId: String(leadId).trim(),
        entityId,
        leadLink,
        meetingType: pick(r, ['meeting_type', 'meeting type']) || 'fresh_meeting',
        city, cluster,
        scheduleDate: String(sched || ''),
        scheduleISO: toISODate(sched),
        meetingStatus,
        meetingDoneDate: String(doneRaw || ''),
        meetingDoneISO,
        lrmEmail: String(lrmEmail || '').trim(),
        lrmName: pick(r, ['assigned_lrm', 'assigned lrm', 'lrm name']) || '',
        recordingUrl,
        // Team Lead is the auditor:
        assignedAuditorEmail: tl.tlEmail,
        assignedAuditorName: tl.tlName,
      };
    }).filter(Boolean);

    return json(200, meetings);
  } catch (e) {
    return json(500, { error: String(e && e.message || e) });
  }
};

// --- Vercel adapter: expose the handler as a Vercel serverless function ---
module.exports = require('./_adapter')(exports.handler);
