// data.js — domain model, scoring logic, and realistic mock audits.
// Exported on window for the other babel scripts.

// ---- Evaluation framework: 5 sections, 17 criteria ----
const SECTIONS = [
  { key: 'opening', name: 'Opening', short: 'Open', items: [
    { label: 'Greeting & self-introduction', eg: ['Namaste se Kapil ji main shankar nagar office se laxshmi bol rahi hun'] },
    { label: 'Stated purpose / set reference for the call', eg: ['Apne solar main interest show kiya tha', 'Apka roof survery hua tha uska design ready hai'] },
  ]},
  { key: 'selling', name: 'Selling', short: 'Sell', items: [
    'Briefly explained SolarSquare',
    'Explained the benefits of the site visit',
    { label: 'Value proposition', eg: ['Topcon & site visit'] },
    { label: 'End to end service', eg: ['from design to installation to subsidy'] },
    'Insurance & warranty info',
  ]},
  { key: 'qualification', name: 'Qualification', short: 'Qual', items: [
    'Captured monthly electricity bill',
    'Confirmed roof ownership',
    'Roof Type',
    'Identified meter type & phases',
    'Construction status',
    'Evaluated shadow / obstruction',
  ]},
  { key: 'objection', name: 'Objection Handling', short: 'Obj', items: [
    'Clear, concise answers & redirection',
  ]},
  { key: 'closing', name: 'Closing', short: 'Close', items: [
    'Set the appointment Time',
    'Confirmed Appointment date',
    'Correct CRM logging & Disposition',
  ]},
];

// normalize an item to { label, eg }
function normItem(item) { return typeof item === 'string' ? { label: item, eg: [] } : { eg: [], ...item }; }

// flat list of all 17 params with section ref
const PARAMS = [];
SECTIONS.forEach((s, si) => s.items.forEach((item, ii) => {
  const it = normItem(item);
  PARAMS.push({ id: `${s.key}-${ii}`, label: it.label, eg: it.eg, section: s.key, sectionName: s.name, sectionIdx: si });
}));

const PASS_DEFAULT = 80;

// ---- Scoring ----
// Each section scored as % of Yes among applicable (non-NA) items.
// Overall = mean of the 5 section percentages (each section weighted equally, "Max 5 pts").
function scoreAudit(answers) {
  // answers: { [paramId]: 'Yes'|'No'|'NA' }
  const sectionPct = {};
  SECTIONS.forEach(s => {
    const ids = s.items.map((_, ii) => `${s.key}-${ii}`);
    let applicable = 0, yes = 0;
    ids.forEach(id => {
      const a = answers[id];
      if (a === 'NA' || a == null) return;
      applicable++;
      if (a === 'Yes') yes++;
    });
    sectionPct[s.key] = applicable === 0 ? null : Math.round((yes / applicable) * 100);
  });
  const vals = SECTIONS.map(s => sectionPct[s.key]).filter(v => v != null);
  const overall = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  return { sectionPct, overall };
}

// ---- People ----
// Hierarchy: LRM (agent) -> Team Lead -> ZSM (manager) -> ADOS
const ADOS_LIST = [
  { name: 'Sanjay Kapoor', email: 'sanjay.kapoor@solarsquare.in' },
  { name: 'Ritu Malhotra', email: 'ritu.malhotra@solarsquare.in' },
];
const MANAGERS = [
  { name: 'Rohan Mehta', email: 'rohan.mehta@solarsquare.in', ados: 0 },
  { name: 'Aditi Sharma', email: 'aditi.sharma@solarsquare.in', ados: 1 },
];
const TEAM_LEADS = [
  { name: 'Vikram Nair', email: 'vikram.nair@solarsquare.in', mgr: 0 },
  { name: 'Sneha Patil', email: 'sneha.patil@solarsquare.in', mgr: 0 },
  { name: 'Imran Khan', email: 'imran.khan@solarsquare.in', mgr: 1 },
  { name: 'Divya Reddy', email: 'divya.reddy@solarsquare.in', mgr: 1 },
];
const AGENTS = [
  { name: 'Aarav Joshi',     tl: 0 }, { name: 'Priya Kulkarni',  tl: 0 },
  { name: 'Karthik Iyer',    tl: 1 }, { name: 'Neha Bansal',     tl: 1 },
  { name: 'Sahil Verma',     tl: 2 }, { name: 'Ananya Das',      tl: 2 },
  { name: 'Rahul Pillai',    tl: 3 }, { name: 'Meera Chauhan',   tl: 3 },
  { name: 'Tushar Gupta',    tl: 0 }, { name: 'Fatima Sheikh',   tl: 2 },
].map(a => {
  const slug = a.name.toLowerCase().replace(/[^a-z]+/g, '.');
  const tl = TEAM_LEADS[a.tl];
  const mgr = MANAGERS[tl.mgr];
  const ados = ADOS_LIST[mgr.ados];
  return {
    name: a.name,
    email: `${slug}@solarsquare.in`,
    tlName: tl.name, tlEmail: tl.email,
    mgrName: mgr.name, mgrEmail: mgr.email,
    adosName: ados.name, adosEmail: ados.email,
  };
});
const QA_AUDITORS = ['Pooja Menon', 'Arjun Saxena', 'Kavya Rao'];

// ---- Geography ----
// City + cluster ("Combined City, Cluster" in the Meeting Tracker sheet).
// Each Team Lead's team operates in one city; an LRM inherits its TL's city.
// (In LIVE data, City comes straight from the tracker row — this mapping only
//  seeds the demo so the join is visible.)
const CITY_BY_TL = {
  'vikram.nair@solarsquare.in':  { city: 'Nagpur', cluster: 'Nagpur · Central' },
  'sneha.patil@solarsquare.in':  { city: 'Nagpur', cluster: 'Nagpur · West' },
  'imran.khan@solarsquare.in':   { city: 'Pune',   cluster: 'Pune · Hinjewadi' },
  'divya.reddy@solarsquare.in':  { city: 'Nashik', cluster: 'Nashik · College Rd' },
};
function cityForTl(tlEmail) { return CITY_BY_TL[tlEmail] || { city: 'Unassigned', cluster: '—' }; }

// ---- Lighthouse (internal lead console) ----
// The Meeting Tracker sheet now carries a ready-made "Lead Link" column that deep-links
// straight to the lead record in Lighthouse, keyed by the row's "Entity id" (a Mongo
// ObjectId), e.g. .../#/menu/lead/details/<entityId>/ . We surface that link verbatim as
// row.leadLink and just consume it. lighthouseUrl() builds the same URL from an entity id
// (used as a fallback / for manual entry where only an id is known).
const LIGHTHOUSE_BASE = 'https://lighthouse.solarsquare.in/#/menu/lead/details/';
function lighthouseUrl(entityId) {
  const id = String(entityId || '').trim();
  return id ? LIGHTHOUSE_BASE + encodeURIComponent(id) + '/' : '';
}
// Fabricate a believable 24-char Mongo ObjectId. The leading 4 bytes are the document
// timestamp, so seeding from the meeting date makes the demo ids line up with real ones
// (June-2026 rows start 0x6a…, matching the sample sheet).
function makeEntityId(rng, dateMs) {
  const ts = Math.floor((dateMs || Date.now()) / 1000).toString(16).padStart(8, '0').slice(-8);
  let rest = '';
  for (let i = 0; i < 16; i++) rest += Math.floor(rng() * 16).toString(16);
  return ts + rest;
}

// ---- Call recordings ----
// In LIVE data the recording URL comes straight from the Meeting Tracker sheet's
// "Recording Link" column, surfaced as row.recordingUrl in getMeetingTracker (blank when
// the call hasn't been linked yet — the inline player shows "No recording linked").
// Here we seed a pool of real, streamable samples so the inline player is demonstrable.
const DEMO_RECORDINGS = Array.from({ length: 16 }, (_, i) =>
  `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${i + 1}.mp3`);

// The TEAM LEAD is the auditor: every meeting is audited by the TL of its LRM.
// So a lead's assigned auditor = that LRM's Team Lead, and a TL's "queue" is simply
// their own team's pending meetings. (QA_AUDITORS is retained only for legacy mock
// audit attribution.)
function auditorForLrm(emp) {
  return { name: (emp && emp.tlName) || '—', email: (emp && emp.tlEmail) || '' };
}

// ---- Deterministic PRNG so the demo is stable across reloads ----
function makeRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Each agent has a latent skill profile (per-section bias) -> believable patterns.
function buildMockAudits() {
  const rng = makeRng(20260604);
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const audits = [];
  let uid = 1;

  const skill = AGENTS.map((_, i) => {
    const base = 0.66 + rng() * 0.3; // 0.66 - 0.96
    return SECTIONS.map((s, si) => {
      // weakest section varies per agent
      const dip = (si === (i % 5)) ? -0.18 : 0;
      const dip2 = (s.key === 'objection') ? -0.06 : 0;
      return Math.max(0.35, Math.min(0.99, base + dip + dip2 + (rng() - 0.5) * 0.12));
    });
  });

  const today = new Date('2026-06-04');

  const genAnswers = (skillRow) => {
    const answers = {};
    SECTIONS.forEach((s, si) => {
      const p = skillRow[si];
      s.items.forEach((_, ii) => {
        const id = `${s.key}-${ii}`;
        const r = rng();
        if (r > 0.93 && s.items.length > 2) answers[id] = 'NA';
        else answers[id] = rng() < p ? 'Yes' : 'No';
      });
    });
    return answers;
  };

  // pool of auditors (TLs + QA reviewers) — whoever was logged in when the audit was done
  const auditorPool = [].concat(
    TEAM_LEADS.map(t => ({ name: t.name, email: t.email })),
    QA_AUDITORS.map(n => ({ name: n, email: nameFromEmail(n) ? (n.toLowerCase().replace(/[^a-z]+/g, '.') + '@solarsquare.in') : '' }))
  );

  AGENTS.forEach((agent, ai) => {
    const n = 4 + Math.floor(rng() * 6); // 4-9 leads each
    for (let k = 0; k < n; k++) {
      const answers = genAnswers(skill[ai]);
      const { sectionPct, overall } = scoreAudit(answers);

      const daysAgo = Math.floor(rng() * 75);
      const d = new Date(today); d.setDate(d.getDate() - daysAgo);
      const md = new Date(d); md.setDate(md.getDate() + 1 + Math.floor(rng() * 6));

      const auditor = pick(auditorPool);
      const mStatus = pick(['Scheduled', 'Completed', 'Completed', 'No-show', 'Rescheduled']);
      const mAfter = overall >= 80
        ? pick(['Confirmed', 'Completed', 'Confirmed', 'Rescheduled'])
        : pick(['Rescheduled', 'Dropped', 'Confirmed', 'No-show']);

      const rec = {
        id: uid++,
        agentName: agent.name, agentEmail: agent.email,
        tlName: agent.tlName, tlEmail: agent.tlEmail,
        mgrName: agent.mgrName, mgrEmail: agent.mgrEmail,
        adosName: agent.adosName, adosEmail: agent.adosEmail,
        meetingDate: md.toISOString().slice(0, 10),
        leadId: 'SS-' + (240000 + Math.floor(rng() * 59999)),
        meetingStatus: mStatus, meetingStatusAfterAudit: mAfter,
        auditorName: auditor.name, auditorEmail: auditor.email,
        callDate: d.toISOString().slice(0, 10), ts: d.getTime(),
        answers, sectionPct, overall,
        notes: buildNotes(rng, sectionPct),
      };
      audits.push(rec);
    }
  });
  audits.sort((a, b) => b.ts - a.ts);
  return audits;
}

function buildNotes(rng, sectionPct) {
  const weakest = SECTIONS.reduce((w, s) => (sectionPct[s.key] ?? 100) < (sectionPct[w.key] ?? 100) ? s : w, SECTIONS[0]);
  const strengthBank = [
    'Warm, confident greeting and clear self-introduction.',
    'Strong value framing — tied solar savings to the customer\u2019s bill.',
    'Handled the pricing question with full transparency.',
    'Excellent rapport; customer was engaged throughout.',
    'Logged the lead cleanly in CRM with correct tagging.',
  ];
  const improveBank = {
    opening: 'Set the reference for the call earlier so the customer knows why we\u2019re calling.',
    selling: 'Spend more time on the value proposition before moving to qualification.',
    qualification: 'Missed confirming roof ownership and meter phase — capture these every time.',
    objection: 'Address objections directly instead of deflecting to the site visit.',
    closing: 'Confirm the appointment slot explicitly and repeat it back to the customer.',
  };
  const actionBank = {
    opening: 'Practice the opening script; review 2 recorded calls with TL.',
    selling: 'Shadow a top performer on value-prop delivery this week.',
    qualification: 'Use the qualification checklist on the next 10 calls.',
    objection: 'Attend the objection-handling refresher session.',
    closing: 'Role-play closing & appointment confirmation in next 1:1.',
  };
  return {
    strengths: strengthBank[Math.floor(rng() * strengthBank.length)],
    improvements: improveBank[weakest.key],
    actionItems: actionBank[weakest.key],
  };
}

// ---- Meeting Tracker ----
// Mirrors the "meeting tracker" Google Sheet: one row per meeting scheduled.
// Columns: lead_id, meeting_type, "Combined City, Cluster", meeting_schedule_date,
//          assigned_lrm_email, assigned_lrm.
// We seed it so it JOINS to the audits: every audited lead appears here (=> "Audits
// Done"), plus extra un-audited meetings (=> "Pending"). City comes from the row;
// TL is resolved from the LRM via the employee directory.
function buildMeetingTracker(audits) {
  const rng = makeRng(76543210);
  const byEmail = {};
  AGENTS.forEach(a => { byEmail[a.email] = a; });
  const today = new Date('2026-06-08');
  const fmtSched = (d, h) => {
    const dd = new Date(d); dd.setHours(h, [0, 30][Math.floor(rng() * 2)], 0, 0);
    return dd.toISOString();
  };
  const meetingTypes = ['fresh_meeting', 'fresh_meeting', 'fresh_meeting', 're_meeting'];
  const rows = [];
  let seq = 100000;

  // 1) every audited lead -> a tracker row (these count as "Audits Done")
  audits.forEach(a => {
    const emp = byEmail[a.agentEmail] || {};
    const geo = cityForTl(emp.tlEmail);
    const au = auditorForLrm(emp);
    const sched = a.meetingDate || a.callDate;
    const entityId = makeEntityId(rng, Date.parse(sched + 'T00:00:00Z'));
    rows.push({
      leadId: a.leadId,
      entityId, leadLink: lighthouseUrl(entityId),
      meetingType: 'fresh_meeting',
      city: geo.city, cluster: geo.cluster,
      scheduleDate: sched,
      lrmEmail: a.agentEmail, lrmName: a.agentName,
      assignedAuditorEmail: au.email, assignedAuditorName: au.name,
      recordingUrl: DEMO_RECORDINGS[Math.floor(rng() * DEMO_RECORDINGS.length)],
    });
  });

  // 2) extra meetings with NO audit yet (these are the "Pending" backlog)
  AGENTS.forEach(agent => {
    const geo = cityForTl(agent.tlEmail);
    const pend = 2 + Math.floor(rng() * 6); // 2-7 pending each
    for (let k = 0; k < pend; k++) {
      const daysAhead = Math.floor(rng() * 8) - 2; // mostly upcoming, some just-passed
      const d = new Date(today); d.setDate(d.getDate() + daysAhead);
      const leadId = 'LMH' + (seq++);
      const au = auditorForLrm(agent);
      const entityId = makeEntityId(rng, d.getTime());
      // Recording Link can be blank in the sheet until the call is linked — mirror that.
      const hasRec = rng() > 0.18;
      rows.push({
        leadId,
        entityId, leadLink: lighthouseUrl(entityId),
        meetingType: meetingTypes[Math.floor(rng() * meetingTypes.length)],
        city: geo.city, cluster: geo.cluster,
        scheduleDate: fmtSched(d, 8 + Math.floor(rng() * 9)),
        lrmEmail: agent.email, lrmName: agent.name,
        assignedAuditorEmail: au.email, assignedAuditorName: au.name,
        recordingUrl: hasRec ? DEMO_RECORDINGS[Math.floor(rng() * DEMO_RECORDINGS.length)] : '',
      });
    }
  });

  // 3) Meeting outcome — did the scheduled meeting actually get DONE?
  // Future-dated meetings are still 'Scheduled' (not yet due). Past meetings resolve to a
  // held/missed outcome (~72% completed). In LIVE data this comes straight from the
  // tracker's "Meeting Status" column; here we seed it deterministically.
  const outcomeToday = '2026-06-08';
  const outcomePool = ['Completed', 'Completed', 'Completed', 'Completed', 'Completed',
    'Completed', 'Completed', 'No-show', 'Rescheduled', 'Cancelled'];
  rows.forEach(r => {
    const iso = (r.scheduleDate || '').slice(0, 10);
    r.meetingStatus = iso > outcomeToday ? 'Scheduled' : outcomePool[Math.floor(rng() * outcomePool.length)];
    // "Meeting Done Date" — stamped only when the meeting was actually held. Its presence is
    // the real completion signal in production; here it mirrors a 'Completed' outcome.
    r.meetingDoneDate = r.meetingStatus === 'Completed' ? iso : '';
    r.meetingDoneISO = r.meetingDoneDate;
  });

  return rows;
}

// derive a display name from an email local-part: "laxshmi.iyer@x" -> "Laxshmi Iyer"
function nameFromEmail(email) {
  if (!email) return '';
  return email.split('@')[0].split(/[._]+/).filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}
// Simulated signed-in session. Team Leads are the auditors, so the demo logs in as a TL —
// their queue is their own team's pending meetings. (In LIVE Apps Script this is the
// real Google account of whoever opens the app.)
const SESSION = { email: 'vikram.nair@solarsquare.in', role: 'Team Lead' };
SESSION.name = nameFromEmail(SESSION.email);

const __MOCK_AUDITS = buildMockAudits();

window.QA = {
  SECTIONS, PARAMS, PASS_DEFAULT, scoreAudit, normItem, nameFromEmail, SESSION,
  MANAGERS, TEAM_LEADS, AGENTS, QA_AUDITORS, ADOS_LIST,
  CITY_BY_TL, cityForTl, lighthouseUrl, LIGHTHOUSE_BASE,
  MOCK_AUDITS: __MOCK_AUDITS,
  MEETING_TRACKER: buildMeetingTracker(__MOCK_AUDITS),
  fmtDate: (iso) => {
    if (!iso) return '\u2014';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },
};
