// api.js — data layer for the Netlify build.
// Talks to the Netlify Functions backend (/api/*). If the functions aren't reachable
// (e.g. running `vite` alone with no `netlify dev`), it transparently falls back to the
// in-memory mock so the UI still renders during pure-frontend development.
(function () {
  const Q = window.QA;

  // Thrown on 401/403 from the backend so the app can show the login / access-denied screen
  // instead of silently falling back to demo data (which would look like a working app).
  class AuthError extends Error {
    constructor(status) { super('auth-' + status); this.isAuth = true; this.status = status; }
  }

  function storedAuth() {
    try { return JSON.parse(localStorage.getItem('qa_auth') || 'null'); } catch (e) { return null; }
  }
  function authHeaders() {
    const a = storedAuth();
    return a && a.token ? { Authorization: 'Bearer ' + a.token } : {};
  }

  async function jget(url) {
    const r = await fetch(url, { headers: { ...authHeaders() } });
    if (r.status === 401 || r.status === 403) throw new AuthError(r.status);
    if (!r.ok) throw new Error(url + ' -> ' + r.status);
    return r.json();
  }
  async function jpost(url, body) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (r.status === 401 || r.status === 403) throw new AuthError(r.status);
    return r.json();
  }

  // ---------------- REMOTE backend (Netlify Functions -> Google Sheets) ----------------
  const Remote = {
    getCurrentUser: async () => {
      const a = storedAuth();
      return a && a.email ? { name: a.name, email: a.email } : { name: '', email: '' };
    },
    getAllEmployees: () => jget('/api/employees'),
    loadMeetings: async () => {
      const all = await jget('/api/meetings');
      return all.map(m => ({ ...m, scheduleISO: m.scheduleISO || String(m.scheduleDate || '').slice(0, 10) }));
    },
    loadAudits: async () => {
      const all = await jget('/api/audits');
      all.forEach(a => { if (a.ts == null) a.ts = new Date(a.callDate || 0).getTime() || 0; });
      all.sort((a, b) => b.ts - a.ts);
      return all;
    },
    saveAudit: (p) => jpost('/api/audits', { ...p }),
  };

  // ---------------- MOCK backend (used only if a Remote call throws) ----------------
  const Mock = (() => {
    let store = Q.MOCK_AUDITS.map(a => ({ ...a }));
    const empByName = name => Q.AGENTS.find(a => a.name === name);
    const wait = v => new Promise(r => setTimeout(() => r(v), 80));
    return {
      getAllEmployees: () => wait(Q.AGENTS.map(a => ({ ...a }))),
      loadMeetings: () => wait(Q.MEETING_TRACKER.map(m => ({ ...m, scheduleISO: String(m.scheduleDate || '').slice(0, 10) }))),
      loadAudits: () => wait(store.map(a => ({ ...a })).sort((a, b) => b.ts - a.ts)),
      saveAudit: (p) => {
        const emp = empByName(p.agentName);
        if (!emp) return wait({ success: false, message: 'LRM not found.' });
        const sc = Q.scoreAudit(p.answers);
        const today = p.auditDate || new Date().toISOString().slice(0, 10);
        const rec = {
          id: 'A' + Date.now(), leadId: p.leadId,
          agentName: emp.name, agentEmail: emp.email,
          tlName: emp.tlName, tlEmail: emp.tlEmail, mgrName: emp.mgrName, mgrEmail: emp.mgrEmail,
          adosName: emp.adosName, adosEmail: emp.adosEmail,
          meetingDate: p.meetingDate, meetingStatus: p.meetingDate ? 'Scheduled' : 'Pending',
          meetingStatusAfterAudit: sc.overall >= Q.PASS_DEFAULT ? 'Confirmed' : 'Rescheduled',
          auditorName: p.auditorName || Q.nameFromEmail(p.auditorEmail || ''),
          auditorEmail: p.auditorEmail || '',
          callDate: today, ts: Date.now(),
          answers: { ...p.answers }, sectionPct: sc.sectionPct, overall: sc.overall,
          notes: { ...(p.notes || {}) },
        };
        store = [rec, ...store];
        return wait({ success: true, id: rec.id, overall: sc.overall });
      },
    };
  })();

  // wrap a remote call so a network/backend failure degrades to the mock (dev convenience).
  // An AuthError (401/403) is re-thrown, NOT masked — the app must show the login screen.
  function withMock(remote, mock, label) {
    return async (...args) => {
      try { return await remote(...args); }
      catch (e) {
        if (e && e.isAuth) throw e;
        console.warn('[api] ' + label + ' fell back to mock:', e.message); return mock(...args);
      }
    };
  }

  Q.api = {
    isLive: true,
    AuthError,
    getCurrentUser: Remote.getCurrentUser,
    getAllEmployees: withMock(Remote.getAllEmployees, Mock.getAllEmployees, 'getAllEmployees'),
    loadMeetings: withMock(Remote.loadMeetings, Mock.loadMeetings, 'loadMeetings'),
    loadAudits: withMock(Remote.loadAudits, Mock.loadAudits, 'loadAudits'),
    saveAudit: withMock(Remote.saveAudit, Mock.saveAudit, 'saveAudit'),
  };
})();
