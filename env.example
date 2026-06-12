// summary.jsx — City & TL audit summary (the manager landing view). window.SummaryView
const { useState: useStateSm, useMemo: useMemoSm } = React;

const APPROVED_SET = ['Confirmed', 'Completed'];
const REJECTED_SET = ['Rescheduled', 'Dropped', 'No-show', 'Rejected'];
const SUMMARY_TODAY = '2026-06-08';
// A meeting is "due" (should have happened) once it has a resolved outcome OR its date has passed.
const RESOLVED_MEETING = ['Completed', 'No-show', 'Rescheduled', 'Cancelled', 'Dropped'];

// blank accumulator for a city / TL roll-up bucket
function blankAgg() {
  return { totalMS: 0, due: 0, held: 0, auditsDone: 0, pending: 0, approved: 0, rejected: 0, scoreSum: 0, scoreCount: 0 };
}
// `meeting` = the tracker row; `audit` = its matching QA audit (or null).
function addToAgg(agg, audit, meeting) {
  agg.totalMS++;
  // meeting outcome — a meeting counts toward "due" once it has a resolved status or its date passed
  if (meeting) {
    const st = meeting.meetingStatus || '';
    const iso = meeting.scheduleISO || (meeting.scheduleDate || '').slice(0, 10);
    const isDue = RESOLVED_MEETING.indexOf(st) >= 0 || (iso && iso <= SUMMARY_TODAY);
    if (isDue) {
      agg.due++;
      if (st === 'Completed') agg.held++;
    }
  }
  if (audit) {
    agg.auditsDone++;
    agg.scoreSum += audit.overall; agg.scoreCount++;
    if (APPROVED_SET.indexOf(audit.meetingStatusAfterAudit) >= 0) agg.approved++;
    else if (REJECTED_SET.indexOf(audit.meetingStatusAfterAudit) >= 0) agg.rejected++;
  } else {
    agg.pending++;
  }
}
function aggScore(agg) { return agg.scoreCount ? Math.round(agg.scoreSum / agg.scoreCount) : null; }
function aggDoneRate(agg) { return agg.due ? Math.round((agg.held / agg.due) * 100) : null; }
function doneTone(rate) { return rate == null ? 'neutral' : (rate >= 75 ? 'ok' : rate >= 55 ? 'warn' : 'bad'); }

// Meetings-Done cell: held count over the meetings that were due, with the done-rate.
function DoneCell({ held, due, strong }) {
  const rate = due ? Math.round((held / due) * 100) : null;
  const tone = doneTone(rate);
  const col = tone === 'neutral' ? 'var(--ink-3)' : `var(--${tone})`;
  return (
    <td className="tnum" style={{ ...window.tdStyle, textAlign: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15, gap: 1 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: strong ? 700 : 600, fontSize: strong ? 14 : 13.5, color: held === 0 ? 'var(--ink-3)' : col }}>
          {held}<span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>/{due || 0}</span>
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: col }}>{rate == null ? '—' : rate + '%'}</span>
      </div>
    </td>
  );
}

// ---- CSV export of the summary (one row per TL, plus city subtotals) ----
function exportSummaryCSV(cities, grand) {
  const head = ['City', 'Team Lead', 'Total MS', 'Meetings Done', 'Due', 'Done %', 'Audits Done', 'Pending', 'Meeting Approved', 'Meetings Rejected', 'Meeting Score'];
  const lines = [head.join(',')];
  const cell = v => (v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"');
  cities.forEach(c => {
    c.tls.forEach(t => lines.push([cell(c.city), cell(t.tlName), t.totalMS, t.held, t.due, aggDoneRate(t) == null ? '' : aggDoneRate(t), t.auditsDone, t.pending, t.approved, t.rejected, aggScore(t) == null ? '' : aggScore(t)].join(',')));
    lines.push([cell(c.city), cell('— City total —'), c.totalMS, c.held, c.due, aggDoneRate(c) == null ? '' : aggDoneRate(c), c.auditsDone, c.pending, c.approved, c.rejected, aggScore(c) == null ? '' : aggScore(c)].join(','));
  });
  lines.push([cell('ALL CITIES'), cell('Grand total'), grand.totalMS, grand.held, grand.due, aggDoneRate(grand) == null ? '' : aggDoneRate(grand), grand.auditsDone, grand.pending, grand.approved, grand.rejected, aggScore(grand) == null ? '' : aggScore(grand)].join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'city-tl-summary.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// small numeric cell
function NumCell({ value, tone, strong }) {
  const col = tone ? `var(--${tone})` : 'var(--ink)';
  return (
    <td className="tnum" style={{ ...window.tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: strong ? 700 : 600, fontSize: strong ? 14 : 13.5, color: value === 0 && !strong ? 'var(--ink-3)' : col }}>
      {value == null ? '—' : value}
    </td>
  );
}

function SummaryView({ audits, meetings, threshold }) {
  const { fmtDate, cityForTl, AGENTS } = window.QA;
  const todayISO = '2026-06-08';
  const [f, setF] = useStateSm({ city: '', tl: '', type: '', from: '', to: '' });
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const [expanded, setExpanded] = useStateSm({}); // city -> bool (undefined = open)
  const isOpen = c => expanded[c] !== false;
  const toggle = c => setExpanded(o => ({ ...o, [c]: !isOpen(c) }));

  // LRM email -> employee (normalized key so case/whitespace differences still match)
  const empByEmail = useMemoSm(() => {
    const m = {}; AGENTS.forEach(a => { if (a.email) m[String(a.email).trim().toLowerCase()] = a; }); return m;
  }, [AGENTS]);

  // Resolve a meeting's Team Lead. The backend (meetings.js) already joins each LRM to its
  // TL with a normalized match and returns it as assignedAuditorName/Email (TL = auditor),
  // so trust that first; fall back to a normalized client-side lookup; else Unassigned.
  const resolveTL = React.useCallback((m) => {
    if (m.assignedAuditorName || m.assignedAuditorEmail) {
      return { tlName: m.assignedAuditorName || window.QA.nameFromEmail(m.assignedAuditorEmail), tlEmail: m.assignedAuditorEmail || '' };
    }
    const emp = empByEmail[String(m.lrmEmail || '').trim().toLowerCase()];
    if (emp && (emp.tlName || emp.tlEmail)) return { tlName: emp.tlName || window.QA.nameFromEmail(emp.tlEmail), tlEmail: emp.tlEmail || '' };
    return { tlName: 'Unassigned', tlEmail: '' };
  }, [empByEmail]);

  // leadId -> audit (most recent wins; audits already sorted desc by ts)
  const auditByLead = useMemoSm(() => {
    const m = {};
    audits.forEach(a => { if (a.leadId != null && m[a.leadId] == null) m[a.leadId] = a; });
    return m;
  }, [audits]);

  // option lists
  const cityOpts = useMemoSm(() => Array.from(new Set(meetings.map(m => m.city))).filter(Boolean).sort(), [meetings]);
  const tlOpts = useMemoSm(() => {
    const m = {};
    meetings.forEach(mt => {
      const { tlName, tlEmail } = resolveTL(mt);
      const key = tlEmail || tlName;
      if (key && (!f.city || mt.city === f.city)) m[key] = tlName;
    });
    return Object.entries(m).map(([email, name]) => ({ email, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [meetings, resolveTL, f.city]);
  const typeOpts = useMemoSm(() => Array.from(new Set(meetings.map(m => m.meetingType))).filter(Boolean).sort(), [meetings]);

  // filtered meeting rows
  const rows = useMemoSm(() => meetings.filter(m => {
    if (f.city && m.city !== f.city) return false;
    if (f.type && m.meetingType !== f.type) return false;
    if (f.tl) { const { tlEmail, tlName } = resolveTL(m); if ((tlEmail || tlName) !== f.tl) return false; }
    if (f.from && m.scheduleISO < f.from) return false;
    if (f.to && m.scheduleISO > f.to) return false;
    return true;
  }), [meetings, f, resolveTL]);

  // roll up: City -> TL
  const { cities, grand } = useMemoSm(() => {
    const cityMap = {};
    const grand = blankAgg();
    rows.forEach(m => {
      const { tlName, tlEmail } = resolveTL(m);
      const audit = auditByLead[m.leadId] || null;
      const city = m.city || 'Unassigned';
      const c = cityMap[city] || (cityMap[city] = { city, tls: {}, ...blankAgg() });
      const t = c.tls[tlEmail || tlName] || (c.tls[tlEmail || tlName] = { tlName, tlEmail, ...blankAgg() });
      addToAgg(t, audit, m); addToAgg(c, audit, m); addToAgg(grand, audit, m);
    });
    const cities = Object.values(cityMap).map(c => ({
      ...c, tls: Object.values(c.tls).sort((a, b) => b.pending - a.pending || b.totalMS - a.totalMS),
    })).sort((a, b) => b.totalMS - a.totalMS);
    return { cities, grand };
  }, [rows, resolveTL, auditByLead]);

  const coverage = grand.totalMS ? Math.round((grand.auditsDone / grand.totalMS) * 100) : 0;
  const doneRate = aggDoneRate(grand);

  const quickRange = (kind) => {
    if (kind === 'all') return setF(o => ({ ...o, from: '', to: '' }));
    const t = new Date(todayISO + 'T00:00:00');
    let from = new Date(t);
    if (kind === 'week') from.setDate(t.getDate() - 6);
    if (kind === 'month') from.setDate(t.getDate() - 29);
    setF(o => ({ ...o, from: from.toISOString().slice(0, 10), to: todayISO }));
  };

  const Th = ({ children, w }) => <th style={{ ...window.thStyle, textAlign: 'center', width: w }}>{children}</th>;

  return (
    <div>
      <ViewHeader title="City & TL Summary"
        sub="Audit coverage across every scheduled meeting — by city and team lead. Pending = meetings still waiting for a QA audit."
        action={<div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" size="sm" onClick={() => exportSummaryCSV(cities, grand)} disabled={!rows.length} style={{ opacity: rows.length ? 1 : 0.5 }}>↓ Export CSV</Button>
        </div>} />

      {/* KPI band */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--gap)', marginBottom: 'var(--gap)' }} className="kpi-grid">
        <StatCard label="Total MS" value={grand.totalMS} tone="primary" sub="meetings scheduled" />
        <StatCard label="Meetings Done" value={grand.held} tone={doneTone(doneRate) === 'neutral' ? 'primary' : doneTone(doneRate)} sub={doneRate == null ? '—' : `${doneRate}% of ${grand.due} due`} />
        <StatCard label="Audits Done" value={grand.auditsDone} tone="ok" sub={grand.totalMS ? coverage + '% coverage' : '—'} />
        <StatCard label="Pending" value={grand.pending} tone={grand.pending ? 'warn' : 'ok'} sub="awaiting audit" />
        <StatCard label="Avg meeting score" value={aggScore(grand) == null ? '—' : aggScore(grand) + '%'} tone={aggScore(grand) == null ? 'neutral' : (aggScore(grand) >= threshold ? 'ok' : 'warn')} sub={`approved ${grand.approved} · rejected ${grand.rejected}`} />
      </div>

      {/* filters */}
      <Card title="Filters" style={{ marginBottom: 'var(--gap)' }}
        action={<div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {[['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([k, lbl]) =>
            <button key={k} type="button" onClick={() => quickRange(k)} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none' }}>{lbl}</button>)}
          <button type="button" onClick={() => setF({ city: '', tl: '', type: '', from: '', to: '' })} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary-strong)', background: 'none', border: 'none' }}>Reset</button>
        </div>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }} className="filter-grid">
          <Field label="City">
            <Select value={f.city} onChange={v => setF(o => ({ ...o, city: v, tl: '' }))}>
              <option value="">All cities</option>
              {cityOpts.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Team Lead">
            <Select value={f.tl} onChange={v => set('tl', v)}>
              <option value="">All TLs</option>
              {tlOpts.map(t => <option key={t.email} value={t.email}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Meeting type">
            <Select value={f.type} onChange={v => set('type', v)}>
              <option value="">All types</option>
              {typeOpts.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </Select>
          </Field>
          <Field label="From"><TextInput type="date" value={f.from} onChange={v => set('from', v)} /></Field>
          <Field label="To"><TextInput type="date" value={f.to} onChange={v => set('to', v)} /></Field>
        </div>
      </Card>

      {/* summary table */}
      <Card title="City & Team Lead breakdown" subtitle="Click a city to expand its team leads. Sorted by volume; TLs by pending backlog." pad={false}>
        {cities.length ? (
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <thead><tr>
                <th style={{ ...window.thStyle, left: 0 }}>City / Team Lead</th>
                <Th>Total MS</Th><Th>Meetings Done</Th><Th>Audits Done</Th><Th>Pending</Th>
                <Th>Approved</Th><Th>Rejected</Th><Th>Meeting Score</Th>
              </tr></thead>
              <tbody>
                {cities.map(c => {
                  const open = isOpen(c.city);
                  const cScore = aggScore(c);
                  return (
                    <React.Fragment key={c.city}>
                      {/* city header row */}
                      <tr onClick={() => toggle(c.city)} style={{ cursor: 'pointer', background: 'var(--surface-2)' }}>
                        <td style={{ ...window.tdStyle, borderBottom: '1px solid var(--line)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <span style={{ fontSize: 10, color: 'var(--ink-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', width: 10 }}>▶</span>
                            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{c.city}</span>
                            <Badge tone="neutral" mono>{c.tls.length} TL{c.tls.length === 1 ? '' : 's'}</Badge>
                          </div>
                        </td>
                        <NumCell value={c.totalMS} strong />
                        <DoneCell held={c.held} due={c.due} strong />
                        <NumCell value={c.auditsDone} strong tone="ok" />
                        <NumCell value={c.pending} strong tone={c.pending ? 'warn' : 'ink-3'} />
                        <NumCell value={c.approved} strong tone="ok" />
                        <NumCell value={c.rejected} strong tone={c.rejected ? 'bad' : 'ink-3'} />
                        <td className="tnum" style={{ ...window.tdStyle, textAlign: 'center', borderBottom: '1px solid var(--line)' }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: cScore == null ? 'var(--ink-3)' : `var(--${scoreTone(cScore, threshold) === 'neutral' ? 'ink' : scoreTone(cScore, threshold)})` }}>{cScore == null ? '—' : cScore + '%'}</span>
                        </td>
                      </tr>
                      {/* TL rows */}
                      {open && c.tls.map(t => {
                        const tScore = aggScore(t);
                        return (
                          <tr key={(t.tlEmail || t.tlName)} style={{ transition: 'background 0.12s' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <td style={window.tdStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 11, paddingLeft: 19 }}>
                                <Avatar name={t.tlName} size={28} />
                                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t.tlName}</span>
                              </div>
                            </td>
                            <NumCell value={t.totalMS} />
                            <DoneCell held={t.held} due={t.due} />
                            <NumCell value={t.auditsDone} tone="ok" />
                            <td style={{ ...window.tdStyle, textAlign: 'center' }}>
                              {t.pending ? <Badge tone="warn" mono>{t.pending}</Badge> : <span className="tnum" style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)', fontSize: 13.5 }}>0</span>}
                            </td>
                            <NumCell value={t.approved} tone="ok" />
                            <NumCell value={t.rejected} tone={t.rejected ? 'bad' : null} />
                            <td className="tnum" style={{ ...window.tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13.5, color: tScore == null ? 'var(--ink-3)' : `var(--${scoreTone(tScore, threshold) === 'neutral' ? 'ink' : scoreTone(tScore, threshold)})` }}>{tScore == null ? '—' : tScore + '%'}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--primary-softer)' }}>
                  <td style={{ ...window.tdStyle, borderTop: '2px solid var(--line)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5 }}>All cities · Grand total</td>
                  <NumCell value={grand.totalMS} strong />
                  <DoneCell held={grand.held} due={grand.due} strong />
                  <NumCell value={grand.auditsDone} strong tone="ok" />
                  <NumCell value={grand.pending} strong tone={grand.pending ? 'warn' : 'ink-3'} />
                  <NumCell value={grand.approved} strong tone="ok" />
                  <NumCell value={grand.rejected} strong tone={grand.rejected ? 'bad' : 'ink-3'} />
                  <td className="tnum" style={{ ...window.tdStyle, textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{aggScore(grand) == null ? '—' : aggScore(grand) + '%'}</td>
                </tr>
              </tfoot>
            </Table>
          </div>
        ) : <EmptyState title="No meetings match these filters" body="Try widening the date range or clearing filters." />}
      </Card>

      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.6 }}>
        <b>Total MS</b> = meetings in the tracker · <b>Meetings Done</b> = scheduled meetings actually completed, out of those already due (held ÷ due) · <b>Audits Done</b> = those with a matching QA audit (joined on lead ID) ·
        <b> Pending</b> = Total MS − Audits Done · <b>Approved / Rejected</b> = meeting status set after the audit ·
        <b> Meeting Score</b> = average audit score across audited meetings.
      </div>
    </div>
  );
}

Object.assign(window, { SummaryView, exportSummaryCSV });
