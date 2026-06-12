// analytics.jsx — KPIs, filters, scoreboard, miss analysis. window.AnalyticsView
const { useState: useStateAn, useMemo: useMemoAn } = React;

// HTML-escape helper for the printable report
function __esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Build a printable report in a new window and open the browser's print dialog
// (the user picks “Save as PDF”). Shared by Analytics and My Performance.
function exportAuditsPDF(data, opts) {
  opts = opts || {};
  const Q = window.QA, SECTIONS = Q.SECTIONS, fmtDate = Q.fmtDate;
  const n = data.length;
  const avg = n ? Math.round(data.reduce((s, a) => s + a.overall, 0) / n) : 0;
  const approved = data.filter(a => ['Confirmed', 'Completed'].indexOf(a.meetingStatusAfterAudit) >= 0).length;
  const rejected = data.filter(a => ['Rescheduled', 'Dropped', 'No-show', 'Rejected'].indexOf(a.meetingStatusAfterAudit) >= 0).length;
  const cols = [{ h: 'Date' }, { h: 'Lead ID' }, { h: 'LRM' }, { h: 'Auditor' }]
    .concat(SECTIONS.map(s => ({ h: s.short, n: true })))
    .concat([{ h: 'Score', n: true }, { h: 'Status after audit' }]);
  const thead = cols.map(c => '<th' + (c.n ? ' class="n"' : '') + '>' + __esc(c.h) + '</th>').join('');
  const body = data.map(a => '<tr>'
    + '<td>' + __esc(fmtDate(a.callDate)) + '</td>'
    + '<td>' + __esc(a.leadId) + '</td>'
    + '<td>' + __esc(a.agentName) + '</td>'
    + '<td>' + __esc(a.auditorName || '') + '</td>'
    + SECTIONS.map(s => '<td class="n">' + (a.sectionPct[s.key] == null ? '&mdash;' : a.sectionPct[s.key]) + '</td>').join('')
    + '<td class="n"><b>' + a.overall + '%</b></td>'
    + '<td>' + __esc(a.meetingStatusAfterAudit || '') + '</td>'
    + '</tr>').join('');
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>' + __esc(opts.title || 'QA Audit Report') + '</title>'
    + '<style>'
    + '@page{size:A4 landscape;margin:12mm}'
    + '*{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}'
    + 'body{margin:0;color:#1f2937}'
    + 'h1{font-size:20px;margin:0 0 2px}'
    + '.sub{color:#6b7280;font-size:12px;margin-bottom:14px}'
    + '.kpis{display:flex;gap:10px;margin-bottom:16px}'
    + '.kpi{flex:1;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px}'
    + '.kpi .l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280}'
    + '.kpi .v{font-size:22px;font-weight:700;margin-top:3px}'
    + 'table{width:100%;border-collapse:collapse;font-size:11px}'
    + 'th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left}'
    + 'th{background:#f3f4f6;text-transform:uppercase;font-size:9.5px;letter-spacing:.04em;color:#374151}'
    + 'td.n,th.n{text-align:center}'
    + '</style></head><body>'
    + '<h1>' + __esc(opts.title || 'QA Audit Report') + '</h1>'
    + '<div class="sub">' + __esc(opts.subtitle || '') + ' &middot; generated ' + new Date().toLocaleString('en-GB') + '</div>'
    + '<div class="kpis">'
    + '<div class="kpi"><div class="l">Audits done</div><div class="v">' + n + '</div></div>'
    + '<div class="kpi"><div class="l">Average score</div><div class="v">' + avg + '%</div></div>'
    + '<div class="kpi"><div class="l">Meetings approved</div><div class="v">' + approved + '</div></div>'
    + '<div class="kpi"><div class="l">Meetings rejected</div><div class="v">' + rejected + '</div></div>'
    + '</div>'
    + '<table><thead><tr>' + thead + '</tr></thead><tbody>'
    + (body || '<tr><td colspan="' + cols.length + '" style="text-align:center;color:#9ca3af;padding:24px">No audits in this selection</td></tr>')
    + '</tbody></table>'
    + '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},350);};</scr' + 'ipt>'
    + '</body></html>';
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups for this site to download the PDF report.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}

function StatCard({ label, value, sub, tone = 'primary', spark }) {
  const t = window.TONE[tone] || window.TONE.primary;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)',
      padding: 'var(--pad-card)', boxShadow: 'var(--shadow-sm)', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: t.fg, opacity: 0.85 }} />
      <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)' }}>{label}</div>
      <div className="tnum" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 34, color: 'var(--ink)', lineHeight: 1.05, marginTop: 8 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function AnalyticsView({ audits, threshold }) {
  const { SECTIONS, PARAMS, fmtDate } = window.QA;
  const [f, setF] = useStateAn({ mgr: '', tl: '', auditor: '', q: '', from: '', to: '' });
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const reset = () => setF({ mgr: '', tl: '', auditor: '', q: '', from: '', to: '' });
  const todayISO = new Date().toISOString().slice(0, 10);

  // ZSM / Team Lead options derived from REAL audit data (not the sample roster)
  const managers = useMemoAn(() => {
    const m = {};
    audits.forEach(a => { if (a.mgrEmail) m[a.mgrEmail] = a.mgrName || a.mgrEmail; });
    return Object.entries(m).map(([email, name]) => ({ email, name })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [audits]);
  const teamLeads = useMemoAn(() => {
    const m = {};
    audits.forEach(a => { if (a.tlEmail && (!f.mgr || a.mgrEmail === f.mgr)) m[a.tlEmail] = a.tlName || a.tlEmail; });
    return Object.entries(m).map(([email, name]) => ({ email, name })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [audits, f.mgr]);

  const rows = useMemoAn(() => audits.filter(a => {
    if (f.mgr && a.mgrEmail !== f.mgr) return false;
    if (f.tl && a.tlEmail !== f.tl) return false;
    if (f.auditor && a.auditorEmail !== f.auditor) return false;
    if (f.q && !a.agentName.toLowerCase().includes(f.q.toLowerCase())) return false;
    if (f.from && a.callDate < f.from) return false;
    if (f.to && a.callDate > f.to) return false;
    return true;
  }), [audits, f]);

  // distinct auditors seen in the data (for the Auditor filter)
  const auditors = useMemoAn(() => {
    const m = {};
    audits.forEach(a => { if (a.auditorEmail) m[a.auditorEmail] = a.auditorName || a.auditorEmail; });
    return Object.entries(m).map(([email, name]) => ({ email, name }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [audits]);

  // ---- PDF export ----
  const downloadToday = () => exportAuditsPDF(audits.filter(a => a.callDate === todayISO),
    { title: "Today’s Audits", subtitle: fmtDate(todayISO) });
  const downloadCurrent = () => {
    const bits = [];
    const au = auditors.find(x => x.email === f.auditor); if (au) bits.push('Auditor: ' + au.name);
    if (f.mgr) { const m = managers.find(x => x.email === f.mgr); if (m) bits.push('ZSM: ' + m.name); }
    if (f.tl) { const t = teamLeads.find(x => x.email === f.tl); if (t) bits.push('TL: ' + t.name); }
    if (f.from || f.to) bits.push('Dates: ' + (f.from || '…') + ' → ' + (f.to || '…'));
    if (f.q) bits.push('Search: ' + f.q);
    exportAuditsPDF(rows, { title: 'QA Audit Report', subtitle: bits.join('  ·  ') || 'All audits' });
  };

  const kpi = useMemoAn(() => {
    const n = rows.length;
    const avg = n ? Math.round(rows.reduce((s, a) => s + a.overall, 0) / n) : 0;
    const passed = rows.filter(a => a.overall >= threshold).length;
    return { n, avg, passed, failed: n - passed, rate: n ? Math.round((passed / n) * 100) : 0 };
  }, [rows, threshold]);

  // weekly trend
  const trend = useMemoAn(() => {
    if (!rows.length) return [];
    const byWeek = {};
    rows.forEach(a => {
      const d = new Date(a.callDate + 'T00:00:00');
      const wk = Math.floor(d.getTime() / (7 * 864e5));
      (byWeek[wk] = byWeek[wk] || []).push(a.overall);
    });
    return Object.keys(byWeek).sort().map(k => Math.round(byWeek[k].reduce((s, v) => s + v, 0) / byWeek[k].length));
  }, [rows]);

  const scoreboard = useMemoAn(() => {
    const map = {};
    rows.forEach(a => {
      const m = map[a.agentName] || (map[a.agentName] = { name: a.agentName, tlName: a.tlName, n: 0, total: 0, sec: {} });
      m.n++; m.total += a.overall;
      SECTIONS.forEach(s => {
        if (a.sectionPct[s.key] != null) { m.sec[s.key] = m.sec[s.key] || { sum: 0, c: 0 }; m.sec[s.key].sum += a.sectionPct[s.key]; m.sec[s.key].c++; }
      });
    });
    return Object.values(map).map(m => ({
      ...m, avg: Math.round(m.total / m.n),
      secAvg: Object.fromEntries(SECTIONS.map(s => [s.key, m.sec[s.key] ? Math.round(m.sec[s.key].sum / m.sec[s.key].c) : null])),
    })).sort((a, b) => b.avg - a.avg);
  }, [rows]);

  const miss = useMemoAn(() => {
    return PARAMS.map(p => {
      let applicable = 0, missed = 0;
      rows.forEach(a => { const v = a.answers[p.id]; if (v === 'Yes' || v === 'No') { applicable++; if (v === 'No') missed++; } });
      return { ...p, applicable, missed, pct: applicable ? Math.round((missed / applicable) * 100) : 0 };
    }).sort((a, b) => b.pct - a.pct);
  }, [rows]);

  return (
    <div>
      <ViewHeader title="Analytics & Reporting" sub="Aggregate quality performance across agents, teams and the full evaluation framework."
        action={<div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" size="sm" onClick={downloadToday}>↓ Today’s audits (PDF)</Button>
          <Button size="sm" onClick={downloadCurrent} disabled={!rows.length} style={{ opacity: rows.length ? 1 : 0.5 }}>↓ Export PDF ({rows.length})</Button>
        </div>} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--gap)', marginBottom: 'var(--gap)' }} className="kpi-grid">
        <StatCard label="Total audits" value={kpi.n} tone="primary" sub="in current filter" />
        <StatCard label="Average score" value={kpi.avg + '%'} tone={kpi.avg >= threshold ? 'ok' : 'warn'} sub={`pass threshold ${threshold}%`} />
        <StatCard label="Passed" value={kpi.passed} tone="ok" sub={kpi.n ? kpi.rate + '% pass rate' : '—'} />
        <StatCard label="Failed" value={kpi.failed} tone="bad" sub={kpi.n ? (100 - kpi.rate) + '% below bar' : '—'} />
      </div>

      {/* filters + trend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 'var(--gap)', marginBottom: 'var(--gap)', alignItems: 'stretch' }} className="filter-trend-grid">
        <Card title="Filters" action={<div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button type="button" onClick={() => setF(o => ({ ...o, from: todayISO, to: todayISO }))} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', background: 'none', border: 'none' }}>Today</button>
          <button type="button" onClick={reset} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary-strong)', background: 'none', border: 'none' }}>Reset all</button>
        </div>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }} className="filter-grid">
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
            <Field label="Search LRM"><TextInput value={f.q} onChange={v => set('q', v)} placeholder="Name…" /></Field>
            <Field label="From"><TextInput type="date" value={f.from} onChange={v => set('from', v)} /></Field>
            <Field label="To"><TextInput type="date" value={f.to} onChange={v => set('to', v)} /></Field>
          </div>
        </Card>
        <Card title="Weekly avg trend" subtitle={`${trend.length} week${trend.length === 1 ? '' : 's'}`}>
          {trend.length ? <TrendLine data={trend} threshold={threshold} height={92} /> : <div style={{ height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 13 }}>No data</div>}
        </Card>
      </div>

      {/* scoreboard */}
      <Card title="LRM performance scoreboard" subtitle="Per-agent section averages, ranked by overall score." pad={false} style={{ marginBottom: 'var(--gap)' }}>
        {scoreboard.length ? (
          <div style={{ overflowX: 'auto' }}>
            <Table>
              <thead><tr>
                <th style={{ ...thStyle, left: 0 }}>LRM</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>Audits</th>
                {SECTIONS.map(s => <th key={s.key} style={{ ...thStyle, textAlign: 'center' }}>{s.short}</th>)}
                <th style={{ ...thStyle, textAlign: 'center' }}>Overall</th>
              </tr></thead>
              <tbody>
                {scoreboard.map((m, i) => (
                  <tr key={m.name} style={{ transition: 'background 0.12s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', width: 18 }}>{i + 1}</span>
                        <Avatar name={m.name} size={30} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{m.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{m.tlName}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}><Badge tone="neutral" mono>{m.n}</Badge></td>
                    {SECTIONS.map(s => {
                      const v = m.secAvg[s.key];
                      const tone = v == null ? 'neutral' : scoreTone(v, threshold);
                      return <td key={s.key} className="tnum" style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: v == null ? 'var(--ink-3)' : `var(--${tone === 'neutral' ? 'ink-3' : tone})` }}>{v == null ? '—' : v}</td>;
                    })}
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <span className="tnum" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: `var(--${scoreTone(m.avg, threshold) === 'neutral' ? 'ink' : scoreTone(m.avg, threshold)})` }}>
                        {m.avg}<span style={{ fontSize: 11 }}>%</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : <EmptyState title="No audits match these filters" body="Try widening the date range or clearing filters." />}
      </Card>

      {/* miss analysis */}
      <Card title="Parameter miss analysis" subtitle="Where calls fall short most often — your coaching priorities.">
        {rows.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px 36px' }} className="miss-grid">
            <HBars invert rows={miss.slice(0, Math.ceil(miss.length / 2)).map(p => ({ label: p.label, value: p.pct, display: `${p.pct}% · ${p.missed}/${p.applicable}` }))} />
            <HBars invert rows={miss.slice(Math.ceil(miss.length / 2)).map(p => ({ label: p.label, value: p.pct, display: `${p.pct}% · ${p.missed}/${p.applicable}` }))} />
          </div>
        ) : <EmptyState title="No data to analyze" />}
      </Card>
    </div>
  );
}

Object.assign(window, { AnalyticsView, StatCard, exportAuditsPDF });
