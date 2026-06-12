// performance.jsx — individual LRM scorecard. window.PerformanceView
const { useState: useStateP, useMemo: useMemoP } = React;

const STATUS_TONES = {
  Completed: 'ok', Confirmed: 'ok',
  Scheduled: 'primary', Pending: 'neutral',
  Rescheduled: 'warn',
  'No-show': 'bad', Dropped: 'bad',
};
function statusTone(s) { return STATUS_TONES[s] || 'neutral'; }

function PerformanceView({ audits, threshold, agents }) {
  const { SECTIONS, fmtDate } = window.QA;
  const [sel, setSel] = useStateP(agents[0]?.name || '');
  const [f, setF] = useStateP({ mgr: '', tl: '', auditor: '', from: '', to: '' });
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const reset = () => setF({ mgr: '', tl: '', auditor: '', from: '', to: '' });
  const todayISO = new Date().toISOString().slice(0, 10);

  // ZSM / Team Lead options derived from the REAL employee list (not the sample roster)
  const managers = useMemoP(() => {
    const m = {};
    agents.forEach(a => { if (a.mgrEmail) m[a.mgrEmail] = a.mgrName || a.mgrEmail; });
    return Object.entries(m).map(([email, name]) => ({ email, name })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [agents]);
  const teamLeads = useMemoP(() => {
    const m = {};
    agents.forEach(a => { if (a.tlEmail && (!f.mgr || a.mgrEmail === f.mgr)) m[a.tlEmail] = a.tlName || a.tlEmail; });
    return Object.entries(m).map(([email, name]) => ({ email, name })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [agents, f.mgr]);

  // LRM picker options narrow by ZSM / Team Lead
  const agentOpts = useMemoP(() => agents.filter(a =>
    (!f.mgr || a.mgrEmail === f.mgr) && (!f.tl || a.tlEmail === f.tl)), [agents, f.mgr, f.tl]);

  // keep the selected LRM valid when ZSM/TL filters change
  React.useEffect(() => {
    if (agentOpts.length && !agentOpts.some(a => a.name === sel)) setSel(agentOpts[0].name);
  }, [agentOpts]);

  // distinct auditors for the Auditor filter
  const auditors = useMemoP(() => {
    const m = {};
    audits.forEach(a => { if (a.auditorEmail) m[a.auditorEmail] = a.auditorName || a.auditorEmail; });
    return Object.entries(m).map(([email, name]) => ({ email, name }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [audits]);

  const group = useMemoP(() => audits.filter(a =>
    a.agentName === sel
    && (!f.auditor || a.auditorEmail === f.auditor)
    && (!f.from || a.callDate >= f.from)
    && (!f.to || a.callDate <= f.to)
  ).sort((a, b) => b.ts - a.ts), [audits, sel, f.auditor, f.from, f.to]);
  const completed = group;
  const agent = agents.find(a => a.name === sel);

  const meetingStats = useMemoP(() => ({
    approved: group.filter(a => ['Confirmed', 'Completed'].indexOf(a.meetingStatusAfterAudit) >= 0).length,
    rejected: group.filter(a => ['Rescheduled', 'Dropped', 'No-show', 'Rejected'].indexOf(a.meetingStatusAfterAudit) >= 0).length,
  }), [group]);

  const exportPDF = () => {
    const bits = ['LRM: ' + sel];
    const au = auditors.find(x => x.email === f.auditor); if (au) bits.push('Auditor: ' + au.name);
    if (f.from || f.to) bits.push('Dates: ' + (f.from || '\u2026') + ' \u2192 ' + (f.to || '\u2026'));
    window.exportAuditsPDF(group, { title: sel + ' \u2014 QA Scorecard', subtitle: bits.join('  \u00b7  ') });
  };

  const stats = useMemoP(() => {
    if (!completed.length) return null;
    const avg = Math.round(completed.reduce((s, a) => s + a.overall, 0) / completed.length);
    const passed = completed.filter(a => a.overall >= threshold).length;
    const secAvg = SECTIONS.map(s => {
      const vals = completed.map(a => a.sectionPct[s.key]).filter(v => v != null);
      return vals.length ? Math.round(vals.reduce((x, y) => x + y, 0) / vals.length) : null;
    });
    const trend = completed.slice().sort((a, b) => a.ts - b.ts).map(a => a.overall);
    const best = secAvg.reduce((b, v, i) => (v != null && (b.v == null || v > b.v)) ? { i, v } : b, { i: 0, v: null });
    const worst = secAvg.reduce((w, v, i) => (v != null && (w.v == null || v < w.v)) ? { i, v } : w, { i: 0, v: null });
    return { avg, passed, secAvg, trend, best, worst };
  }, [completed, threshold]);

  return (
    <div>
      <ViewHeader title="My Performance"
        sub="An agent's full quality history — section strengths, gaps and every audit on record."
        action={<Button size="sm" onClick={exportPDF} disabled={!group.length} style={{ opacity: group.length ? 1 : 0.5 }}>↓ Export PDF ({group.length})</Button>}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
        <Card title="Filters" action={<div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="button" onClick={() => setF(o => ({ ...o, from: todayISO, to: todayISO }))} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none' }}>Today</button>
          <button type="button" onClick={reset} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary-strong)', background: 'none', border: 'none' }}>Reset all</button>
        </div>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }} className="filter-grid">
            <Field label="LRM">
              <Select value={sel} onChange={setSel}>
                {agentOpts.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="ZSM">
              <Select value={f.mgr} onChange={v => setF(o => ({ ...o, mgr: v, tl: '' }))}>
                <option value="">All ZSMs</option>
                {managers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Team Lead">
              <Select value={f.tl} onChange={v => set('tl', v)}>
                <option value="">All TLs</option>
                {teamLeads.map(t => <option key={t.email} value={t.email}>{t.name}</option>)}
              </Select>
            </Field>
            <Field label="Auditor">
              <Select value={f.auditor} onChange={v => set('auditor', v)}>
                <option value="">All auditors</option>
                {auditors.map(a => <option key={a.email} value={a.email}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="From"><TextInput type="date" value={f.from} onChange={v => set('from', v)} /></Field>
            <Field label="To"><TextInput type="date" value={f.to} onChange={v => set('to', v)} /></Field>
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap)' }} className="kpi-grid">
          <StatCard label="Audits done so far" value={group.length} tone="primary" sub={sel || '—'} />
          <StatCard label="Meetings approved" value={meetingStats.approved} tone="ok" sub="confirmed / completed" />
          <StatCard label="Meetings rejected" value={meetingStats.rejected} tone="bad" sub="rescheduled / dropped / no-show" />
        </div>

      {!stats ? (
        <Card><EmptyState title="No audits for this selection" body="Adjust the filters above or pick another LRM." /></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
          {/* profile header */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <Avatar name={agent.name} size={62} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <h2 style={{ fontSize: 22, color: 'var(--ink)' }}>{agent.name}</h2>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{agent.email}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <Badge tone="neutral">TL · {agent.tlName}</Badge>
                  <Badge tone="neutral">ZSM · {agent.mgrName}</Badge>
                  <Badge tone="neutral">ADOS · {agent.adosName}</Badge>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 28, alignItems: 'center' }}>
                <StatPill label="Audits" value={completed.length} />
                <StatPill label="Passed" value={`${stats.passed}/${completed.length}`} tone="ok" />
                <ScoreRing value={stats.avg} size={96} stroke={10} threshold={threshold} label="Overall" />
              </div>
            </div>
          </Card>

          <Card title="Score trend" subtitle="Overall score across audits, oldest → newest. Dashed line = pass threshold.">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.1fr)', gap: 28, alignItems: 'center' }} className="perf-grid">
              <div>
                <TrendLine data={stats.trend} threshold={threshold} height={150} />
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                  <Badge tone="ok">★ Strongest · {SECTIONS[stats.best.i].name} {stats.best.v}%</Badge>
                  <Badge tone="bad">↓ Focus · {SECTIONS[stats.worst.i].name} {stats.worst.v}%</Badge>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {SECTIONS.map((s, i) => {
                  const v = stats.secAvg[i]; const tone = v == null ? 'neutral' : scoreTone(v, threshold);
                  return (
                    <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '128px 1fr 40px', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{s.name}</span>
                      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: (v || 0) + '%', height: '100%', background: `var(--${tone === 'neutral' ? 'ink-3' : tone})`, borderRadius: 99 }} />
                      </div>
                      <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-mono)', textAlign: 'right', color: `var(--${tone === 'neutral' ? 'ink-3' : tone})` }}>{v == null ? '—' : v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* meeting tracker */}
          <Card title="Lead & meeting tracker" subtitle="Audit score and how each meeting progressed after the audit." pad={false}>
            <div style={{ overflowX: 'auto' }}>
              <Table>
                <thead><tr>
                  <th style={thStyle}>Lead ID</th>
                  <th style={thStyle}>Meeting schedule date</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Audit score</th>
                  <th style={thStyle}>Meeting status</th>
                  <th style={thStyle}>Status after audit</th>
                </tr></thead>
                <tbody>
                  {group.map(a => (
                    <tr key={a.id} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={tdStyle}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{a.leadId}</span></td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{a.meetingDate ? fmtDate(a.meetingDate) : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}><Badge tone={scoreTone(a.overall, threshold)} mono>{a.overall}%</Badge></td>
                      <td style={tdStyle}><Badge tone={statusTone(a.meetingStatus)}>{a.meetingStatus}</Badge></td>
                      <td style={tdStyle}><Badge tone={statusTone(a.meetingStatusAfterAudit)}>{a.meetingStatusAfterAudit}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          {/* history */}
          <Card title="Evaluation history" subtitle={`${completed.length} audits on record`} pad={false}>
            <div style={{ overflowX: 'auto' }}>
              <Table>
                <thead><tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Lead ID</th>
                  <th style={thStyle}>Auditor</th>
                  {SECTIONS.map(s => <th key={s.key} style={{ ...thStyle, textAlign: 'center' }}>{s.short}</th>)}
                  <th style={{ ...thStyle, textAlign: 'center' }}>Score</th>
                  <th style={thStyle}>Action items</th>
                </tr></thead>
                <tbody>
                  {completed.map(a => (
                    <tr key={a.id} onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmtDate(a.callDate)}</td>
                      <td style={tdStyle}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-2)' }}>{a.leadId}</span></td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{a.auditorName || '—'}</td>
                      {SECTIONS.map(s => { const v = a.sectionPct[s.key]; const tone = v == null ? 'neutral' : scoreTone(v, threshold); return <td key={s.key} className="tnum" style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: v == null ? 'var(--ink-3)' : `var(--${tone === 'neutral' ? 'ink-3' : tone})` }}>{v == null ? '—' : v}</td>; })}
                      <td style={{ ...tdStyle, textAlign: 'center' }}><Badge tone={a.overall >= threshold ? 'ok' : 'bad'} mono>{a.overall}%</Badge></td>
                      <td style={{ ...tdStyle, maxWidth: 260 }}><span style={{ fontSize: 12.5, color: 'var(--ink-3)', display: 'block', lineHeight: 1.4 }}>{a.notes?.actionItems || '—'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}

function StatPill({ label, value, tone = 'neutral' }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="tnum" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 26, color: tone === 'ok' ? 'var(--ok)' : 'var(--ink)' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

Object.assign(window, { PerformanceView });
