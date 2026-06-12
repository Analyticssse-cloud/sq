// audit.jsx — single-stage audit form. The auditor is the signed-in user (captured automatically).
const { useState: useStateA, useMemo: useMemoA, useRef: useRefA } = React;

// Deep-link button to the lead's record in the Lighthouse console.
// Prefers the ready-made "Lead Link" from the Meeting Tracker sheet (href); falls back to
// building the URL from an entity id when only that is known (e.g. manual entry).
function LighthouseLink({ href, entityId, leadId, compact, style }) {
  const url = href || window.QA.lighthouseUrl(entityId);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={`Open ${leadId || 'lead'} in Lighthouse`}
      onClick={e => e.stopPropagation()}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-soft)'; e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--primary) 32%, transparent)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
        height: 30, padding: compact ? '0 9px' : '0 12px', borderRadius: 99,
        border: '1px solid var(--line)', background: 'var(--surface)',
        color: 'var(--primary-strong)', fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
        transition: 'background 0.15s, border-color 0.15s', ...style,
      }}>
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 4H5.5A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16h9a1.5 1.5 0 001.5-1.5V12" />
        <path d="M12 4h4v4 M16 4l-7 7" />
      </svg>
      {!compact && 'Lighthouse'}
    </a>
  );
}

// Entity id chip — the sheet's "Entity id" (Mongo ObjectId). Click to copy. Shows a
// truncated, monospace id; the full value is in the title + copied to clipboard.
function EntityIdChip({ entityId, style }) {
  const [copied, setCopied] = useStateA(false);
  const id = String(entityId || '').trim();
  if (!id) return null;
  const short = id.length > 12 ? id.slice(0, 6) + '…' + id.slice(-4) : id;
  const copy = (e) => {
    e.stopPropagation();
    try { navigator.clipboard.writeText(id); } catch (err) {}
    setCopied(true); setTimeout(() => setCopied(false), 1100);
  };
  return (
    <button type="button" onClick={copy} title={copied ? 'Copied!' : `Entity id ${id} — click to copy`}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--line-soft)'; }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px',
        borderRadius: 99, border: '1px solid var(--line-soft)', background: 'transparent',
        color: copied ? 'var(--ok)' : 'var(--ink-3)', fontFamily: 'var(--font-mono)',
        fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, color 0.15s', ...style,
      }}>
      <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {copied
          ? <path d="M5 10.5l3.2 3.2L15 6" />
          : <><rect x="7" y="7" width="9" height="9" rx="1.6" /><path d="M13 7V5.5A1.5 1.5 0 0011.5 4h-6A1.5 1.5 0 004 5.5v6A1.5 1.5 0 005.5 13H7" /></>}
      </svg>
      {copied ? 'Copied' : short}
    </button>
  );
}

// Inline call-recording player: play/pause + scrubber + open-in-tab. `compact` = button only.
function RecordingPlayer({ url, compact }) {
  const ref = useRefA(null);
  const [playing, setPlaying] = useStateA(false);
  const [cur, setCur] = useStateA(0);
  const [dur, setDur] = useStateA(0);
  const [err, setErr] = useStateA(false);
  const fmt = s => { if (!isFinite(s) || s < 0) return '0:00'; const m = Math.floor(s / 60); const ss = Math.floor(s % 60); return m + ':' + String(ss).padStart(2, '0'); };
  if (!url) return compact ? null : <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>No recording linked</span>;

  const toggle = (e) => {
    if (e) e.stopPropagation();
    const a = ref.current; if (!a) return;
    if (a.paused) { a.play().then(() => setPlaying(true)).catch(() => setErr(true)); }
    else { a.pause(); setPlaying(false); }
  };
  const seek = (e) => {
    e.stopPropagation();
    const a = ref.current; if (!a || !dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * dur;
  };

  const playBtn = (
    <button type="button" onClick={toggle} title={playing ? 'Pause recording' : 'Play recording'}
      style={{
        width: compact ? 30 : 34, height: compact ? 30 : 34, flex: '0 0 auto', borderRadius: '50%',
        border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)',
      }}>
      {playing
        ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1.5" width="3" height="9" rx="1" /><rect x="7" y="1.5" width="3" height="9" rx="1" /></svg>
        : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.8v8.4a.6.6 0 00.92.5l6.5-4.2a.6.6 0 000-1L3.92 1.3A.6.6 0 003 1.8z" /></svg>}
    </button>
  );
  const audioEl = (
    <audio ref={ref} src={url} preload="none"
      onLoadedMetadata={e => setDur(e.target.duration)}
      onTimeUpdate={e => setCur(e.target.currentTime)}
      onEnded={() => { setPlaying(false); setCur(0); }}
      onError={() => setErr(true)} />
  );

  if (compact) return <span style={{ display: 'inline-flex' }} onClick={e => e.stopPropagation()}>{playBtn}{audioEl}</span>;

  const pct = dur ? (cur / dur) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%' }}>
      {playBtn}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div onClick={seek} style={{ height: 6, background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 99, overflow: 'hidden', cursor: 'pointer' }}>
          <div style={{ width: pct + '%', height: '100%', background: 'var(--primary)', borderRadius: 99, transition: 'width 0.2s linear' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, fontFamily: 'var(--font-mono)', color: err ? 'var(--bad)' : 'var(--ink-3)' }}>
          <span>{err ? 'Recording unavailable' : (playing || cur ? fmt(cur) : 'Call recording')}</span>
          <span>{fmt(dur)}</span>
        </div>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" title="Open recording in a new tab" onClick={e => e.stopPropagation()}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        style={{ flex: '0 0 auto', width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'background 0.15s' }}>
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4H5.5A1.5 1.5 0 004 5.5v9A1.5 1.5 0 005.5 16h9a1.5 1.5 0 001.5-1.5V12" /><path d="M12 4h4v4 M16 4l-7 7" /></svg>
      </a>
      {audioEl}
    </div>
  );
}

// Approve / Reject toggle button used in the submit rail.
function DecisionBtn({ active, tone, label, sym, onClick }) {
  const t = window.TONE[tone];
  return (
    <button type="button" onClick={onClick} aria-pressed={active} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      height: 46, borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700,
      border: '1.5px solid ' + (active ? t.fg : 'var(--line)'),
      background: active ? t.fg : 'var(--surface)', color: active ? '#fff' : 'var(--ink-2)',
      boxShadow: active ? 'var(--shadow-sm)' : 'none', transition: 'all 0.15s',
    }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: active ? 'rgba(255,255,255,0.22)' : t.bg, color: active ? '#fff' : t.fg }}>{sym}</span>
      {label}
    </button>
  );
}

function AgentCombo({ agents, value, onPick }) {
  const [open, setOpen] = useStateA(false);
  const [q, setQ] = useStateA(value || '');
  const ref = useRefA(null);
  React.useEffect(() => { setQ(value || ''); }, [value]);
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);
  // case-insensitive + whitespace-tolerant match (handles trailing spaces in the sheet)
  const norm = s => String(s || '').trim().toLowerCase();
  const matches = agents.filter(a => norm(a.name).includes(norm(q))).slice(0, 6);
  const exactPick = v => agents.find(a => norm(a.name) === norm(v));
  const showPanel = open && (matches.length > 0 || q.trim() !== '' || agents.length === 0);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <TextInput value={q} placeholder="Start typing a name…" autoComplete="off"
        onChange={v => { setQ(v); setOpen(true); const exact = exactPick(v); if (exact) onPick(exact); }}
        onFocus={() => setOpen(true)} />
      {showPanel && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40,
          background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-lg)', overflow: 'hidden', padding: 4,
        }}>
          {matches.map(a => (
            <button key={a.email || a.name} type="button" onClick={() => { onPick(a); setQ(a.name); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Avatar name={a.name} size={28} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{a.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{a.tlName} · {a.email}</div>
              </div>
            </button>
          ))}
          {matches.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.45 }}>
              {agents.length === 0
                ? 'No LRMs loaded. Add people to the EmployeeMaster sheet, then reload.'
                : <>No LRM matches “<span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{q.trim()}</span>”. Check the spelling in EmployeeMaster.</>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// LeadPicker — the TL's audit queue, shown directly (no typing needed to reveal it).
// Defaults to the signed-in TL's assigned queue; "All pending" shows every un-audited
// meeting. Each row carries a recording player + Lighthouse link. Selecting one
// auto-fills LRM / Lead ID / dates downstream.
function LeadPicker({ pending, auditorEmail, auditorName, onPick }) {
  const { fmtDate } = window.QA;
  const [q, setQ] = useStateA('');
  const [tab, setTab] = useStateA('mine');
  const [dateFilter, setDateFilter] = useStateA(''); // '' = all dates; otherwise a scheduleISO
  const norm = s => String(s || '').trim().toLowerCase();
  const mine = pending.filter(m => m.assignedAuditorEmail && norm(m.assignedAuditorEmail) === norm(auditorEmail));
  const base = tab === 'mine' ? mine : pending;

  // Distinct scheduled dates in the current queue (each with a count) — powers the date chips.
  const dateOptions = (() => {
    const map = new Map();
    base.forEach(m => { const k = m.scheduleISO || ''; if (k) map.set(k, (map.get(k) || 0) + 1); });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  })();
  const shortDate = iso => {
    const d = new Date(iso + 'T00:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const matches = base
    .filter(m => !dateFilter || m.scheduleISO === dateFilter)
    .filter(m => [m.leadId, m.lrmName, m.city].some(x => norm(x).includes(norm(q))))
    .sort((a, b) => (a.scheduleISO || '').localeCompare(b.scheduleISO || ''));

  const Tab = ({ id, label, n }) => {
    const on = tab === id;
    return (
      <button type="button" onClick={() => setTab(id)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 99,
        border: '1px solid ' + (on ? 'transparent' : 'var(--line)'), background: on ? 'var(--primary)' : 'var(--surface)',
        color: on ? '#fff' : 'var(--ink-2)', fontSize: 12.5, fontWeight: 600,
      }}>{label}<span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, opacity: 0.85 }}>{n}</span></button>
    );
  };

  const DateChip = ({ active, label, n, onClick }) => (
    <button type="button" onClick={onClick} style={{
      flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 99,
      border: '1px solid ' + (active ? 'var(--primary)' : 'var(--line)'), background: active ? 'var(--primary-soft)' : 'var(--surface)',
      color: active ? 'var(--primary-strong)' : 'var(--ink-2)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
    }}>{label}<span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8 }}>{n}</span></button>
  );

  return (
    <div>
      <TextInput value={q} placeholder="Filter this queue — Lead ID, LRM or city…" autoComplete="off" onChange={setQ} />
      <div style={{
        marginTop: 10, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)',
        overflow: 'hidden', background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', gap: 8, padding: 10, borderBottom: '1px solid var(--line-soft)' }}>
          <Tab id="mine" label="My queue" n={mine.length} />
          <Tab id="all" label="All pending" n={pending.length} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 10px', borderBottom: '1px solid var(--line-soft)', overflowX: 'auto' }}>
          <span style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', paddingRight: 2 }}>
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="4.5" width="13" height="12" rx="2" /><path d="M3.5 8h13 M7 3v3 M13 3v3" /></svg>
            Schedule
          </span>
          <DateChip active={dateFilter === ''} label="All dates" n={base.length} onClick={() => setDateFilter('')} />
          {dateOptions.map(([iso, n]) => (
            <DateChip key={iso} active={dateFilter === iso} label={shortDate(iso)} n={n} onClick={() => setDateFilter(iso)} />
          ))}
        </div>
        <div style={{ maxHeight: 340, overflowY: 'auto', padding: 4 }}>
          {matches.map(m => {
            const assignedMe = norm(m.assignedAuditorEmail) === norm(auditorEmail);
            return (
              <div key={m.leadId} role="button" tabIndex={0}
                onClick={() => onPick(m)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(m); } }}
                style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '8px 11px', borderRadius: 8, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 700, color: 'var(--primary-strong)' }}>{m.leadId}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.lrmName}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--ink-3)' }}>{m.city} · {m.meetingType.replace(/_/g, ' ')} · {fmtDate(m.scheduleISO)}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <RecordingPlayer url={m.recordingUrl} compact />
                  <LighthouseLink href={m.leadLink} entityId={m.entityId} leadId={m.leadId} compact />
                  {assignedMe
                    ? <Badge tone="primary" style={{ fontSize: 10.5 }}>You</Badge>
                    : <span style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{m.assignedAuditorName ? m.assignedAuditorName.split(' ')[0] : ''}</span>}
                </span>
              </div>
            );
          })}
          {matches.length === 0 && (
            <div style={{ padding: '16px 12px', fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.5, textAlign: 'center' }}>
              {tab === 'mine'
                ? <>No pending meetings assigned to <b>{auditorName || 'you'}</b>. Try <span style={{ color: 'var(--primary-strong)', fontWeight: 600 }}>All pending</span>.</>
                : (pending.length === 0 ? 'No pending meetings in the tracker — every scheduled meeting has been audited. 🎉' : 'No meetings match your filter.')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AuditView({ agents, meetings = [], audits = [], onSubmit, threshold, session, busy }) {
  const { SECTIONS, PARAMS, scoreAudit, normItem, fmtDate } = window.QA;
  const blankAnswers = () => Object.fromEntries(PARAMS.map(p => [p.id, 'Yes']));

  const [agent, setAgent] = useStateA(null);
  const [agentName, setAgentName] = useStateA('');
  const [meta, setMeta] = useStateA({ auditDate: '2026-06-08', meetingDate: '', leadId: '', entityId: '' });
  const [answers, setAnswers] = useStateA(blankAnswers());
  const [notes, setNotes] = useStateA({ strengths: '', improvements: '', actionItems: '' });
  const [manualAuditor, setManualAuditor] = useStateA(() => { try { return localStorage.getItem('qa_auditor_email') || ''; } catch (e) { return ''; } });
  const [selectedMeeting, setSelectedMeeting] = useStateA(null);
  const [manualMode, setManualMode] = useStateA(false);
  const [toast, setToast] = useStateA(null);
  const [decision, setDecision] = useStateA('');  // TL's Approve / Reject on the meeting

  // Auditor = the signed-in Google account when the deployment exposes it; otherwise a
  // manually-entered email (persisted) so a blank login can never block an audit.
  const detected = !!(session && session.email);
  const auditorEmail = (detected ? session.email : manualAuditor).trim();
  const auditorName = detected ? session.name : window.QA.nameFromEmail(auditorEmail);

  // pending = scheduled meetings that don't yet have an audit (joined on leadId)
  const pending = useMemoA(() => {
    const done = new Set(audits.map(a => a.leadId));
    return meetings.filter(m => !done.has(m.leadId));
  }, [meetings, audits]);
  const myQueueCount = useMemoA(() =>
    pending.filter(m => String(m.assignedAuditorEmail || '').toLowerCase() === auditorEmail.toLowerCase()).length,
    [pending, auditorEmail]);

  const { sectionPct, overall } = useMemoA(() => scoreAudit(answers), [answers]);
  const pass = overall >= threshold;

  const setAns = (id, v) => setAnswers(a => ({ ...a, [id]: v }));
  const bulkSection = (sKey, v) => setAnswers(a => {
    const next = { ...a };
    SECTIONS.find(s => s.key === sKey).items.forEach((_, ii) => next[`${sKey}-${ii}`] = v);
    return next;
  });

  const pickAgent = a => { setAgent(a); setAgentName(a.name); };

  // pick a scheduled meeting -> resolve the LRM from the directory and auto-fill everything
  const pickLead = m => {
    const a = agents.find(x => String(x.email).toLowerCase() === String(m.lrmEmail).toLowerCase())
      || { name: m.lrmName, email: m.lrmEmail, tlEmail: '', mgrEmail: '', adosEmail: '' };
    setSelectedMeeting(m);
    setManualMode(false);
    setDecision('');
    setAgent(a); setAgentName(a.name);
    setMeta(mm => ({ ...mm, leadId: m.leadId, entityId: m.entityId || '', meetingDate: m.scheduleISO || '' }));
  };
  const clearLead = () => {
    setSelectedMeeting(null);
    setDecision('');
    setAgent(null); setAgentName('');
    setMeta(mm => ({ ...mm, leadId: '', entityId: '', meetingDate: '' }));
  };

  const reset = () => {
    setAgent(null); setAgentName(''); setAnswers(blankAnswers());
    setNotes({ strengths: '', improvements: '', actionItems: '' });
    setMeta(m => ({ ...m, leadId: '', entityId: '', meetingDate: '' }));
    setSelectedMeeting(null); setManualMode(false); setDecision('');
  };

  const submit = async () => {
    if (!agent) { setToast({ type: 'bad', msg: 'Select an LRM before submitting.' }); return; }
    if (!meta.leadId.trim()) { setToast({ type: 'bad', msg: 'Lead ID is required.' }); return; }
    if (!auditorEmail) { setToast({ type: 'bad', msg: 'Enter your email under “Audited by” — your login could not be auto-detected.' }); return; }
    if (!decision) { setToast({ type: 'bad', msg: 'Approve or reject the meeting before submitting.' }); return; }
    const res = await onSubmit({ agentName: agent.name, leadId: meta.leadId.trim(), entityId: (meta.entityId || '').trim(), leadLink: (selectedMeeting && selectedMeeting.leadLink) || window.QA.lighthouseUrl((meta.entityId || '').trim()), auditDate: meta.auditDate, meetingDate: meta.meetingDate, auditorEmail, auditorName, meetingDecision: decision, answers: { ...answers }, notes: { ...notes } });
    if (res && res.success === false) { setToast({ type: 'bad', msg: res.message || 'Could not save the audit.' }); return; }
    const o = res && res.overall != null ? res.overall : overall;
    setToast({ type: 'ok', msg: `Audit saved for ${agent.name} · ${o}% · meeting ${decision.toLowerCase()} · report dispatched to LRM, TL, ZSM & ADOS.` });
    reset();
    setTimeout(() => setToast(null), 5000);
  };

  const prof = { name: agent?.name || '', email: agent?.email || '', tlEmail: agent?.tlEmail || '', mgrEmail: agent?.mgrEmail || '', adosEmail: agent?.adosEmail || '' };

  return (
    <div>
      <ViewHeader title="New Audit"
        sub="Score a sales call against the SolarSquare quality framework. Sections weight equally." />

      {toast && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, padding: '13px 18px',
          borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 500,
          color: toast.type === 'ok' ? 'var(--ok)' : 'var(--bad)',
          background: toast.type === 'ok' ? 'var(--ok-soft)' : 'var(--bad-soft)',
          border: `1px solid color-mix(in oklch, ${toast.type === 'ok' ? 'var(--ok)' : 'var(--bad)'} 22%, transparent)`,
        }}>
          <span style={{ fontSize: 16 }}>{toast.type === 'ok' ? '✓' : '!'}</span>{toast.msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 'var(--gap)', alignItems: 'start' }} className="audit-grid">
        {/* LEFT: form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', minWidth: 0 }}>
          <Card title="Audit profile"
            subtitle={selectedMeeting ? null : (manualMode ? 'Manual entry — type the LRM and Lead ID yourself.' : 'Pick a scheduled meeting from the tracker — the rest fills in automatically.')}
            action={selectedMeeting
              ? <button type="button" onClick={clearLead} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--primary-strong)', background: 'none', border: 'none' }}>Change meeting</button>
              : <button type="button" onClick={() => { setManualMode(m => !m); clearLead(); }} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-3)', background: 'none', border: 'none', textDecoration: 'underline', textUnderlineOffset: 2 }}>{manualMode ? 'Use the meeting picker' : 'Enter manually instead'}</button>}>

            {/* picker / selection banner */}
            {!manualMode && (selectedMeeting ? (
              <div style={{ marginBottom: 16, borderRadius: 'var(--radius-sm)', background: 'var(--primary-softer)', border: '1px solid var(--line-soft)', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '12px 14px' }}>
                  <span className="tnum" style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--primary-strong)' }}>{selectedMeeting.leadId}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{selectedMeeting.lrmName}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{selectedMeeting.city} · {selectedMeeting.meetingType.replace(/_/g, ' ')} · scheduled {fmtDate(selectedMeeting.scheduleISO)}</div>
                  </div>
                  {String(selectedMeeting.assignedAuditorEmail || '').toLowerCase() === auditorEmail.toLowerCase()
                    ? <Badge tone="primary">Your team</Badge>
                    : <Badge tone="neutral">Auditor: {selectedMeeting.assignedAuditorName || '—'}</Badge>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: '1px solid var(--line-soft)', flexWrap: 'wrap' }}>
                  <LighthouseLink href={selectedMeeting.leadLink} entityId={selectedMeeting.entityId} leadId={selectedMeeting.leadId} />
                  <EntityIdChip entityId={selectedMeeting.entityId} />
                  <div style={{ flex: 1, minWidth: 220 }}><RecordingPlayer url={selectedMeeting.recordingUrl} /></div>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <Field label="Meeting to audit" hint={myQueueCount ? `${myQueueCount} in your queue` : `${pending.length} pending`}>
                  <LeadPicker pending={pending} auditorEmail={auditorEmail} auditorName={auditorName} onPick={pickLead} />
                </Field>
              </div>
            ))}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="profile-grid">
              <Field label="LRM name" hint={manualMode ? 'autocomplete' : 'auto-filled'} span={1}>
                {manualMode
                  ? <AgentCombo agents={agents} value={agentName} onPick={pickAgent} />
                  : <TextInput value={agentName} locked placeholder="select a meeting" />}
              </Field>
              <Field label="LRM email"><TextInput value={prof.email} locked placeholder="auto-filled" /></Field>
              <Field label="Lead ID">
                {manualMode
                  ? <TextInput value={meta.leadId} onChange={v => setMeta(m => ({ ...m, leadId: v }))} placeholder="LMH000000" />
                  : <TextInput value={meta.leadId} locked placeholder="from meeting" />}
              </Field>
              {manualMode && (
                <Field label="Entity id" hint="for Lighthouse link" span={1}>
                  <div>
                    <TextInput value={meta.entityId} onChange={v => setMeta(m => ({ ...m, entityId: v }))} placeholder="24-char id from the tracker" />
                    {meta.entityId.trim() && <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}><LighthouseLink entityId={meta.entityId.trim()} leadId={meta.leadId} /><EntityIdChip entityId={meta.entityId.trim()} /></div>}
                  </div>
                </Field>
              )}
              <Field label="City / Cluster"><TextInput value={selectedMeeting ? selectedMeeting.cluster : ''} locked placeholder="auto-filled" /></Field>
              <Field label="Team Lead"><TextInput value={prof.tlEmail} locked placeholder="auto-filled" /></Field>
              <Field label="ZSM"><TextInput value={prof.mgrEmail} locked placeholder="auto-filled" /></Field>
              <Field label="ADOS"><TextInput value={prof.adosEmail} locked placeholder="auto-filled" /></Field>
              <Field label="Audit date"><TextInput type="date" value={meta.auditDate} onChange={v => setMeta(m => ({ ...m, auditDate: v }))} /></Field>
              <Field label="Meeting scheduled date"><TextInput type="date" value={meta.meetingDate} onChange={v => setMeta(m => ({ ...m, meetingDate: v }))} locked={!manualMode} /></Field>
              <Field label="Audited by" hint={detected ? 'your login' : 'enter your email'}>
                {detected
                  ? <TextInput value={`${session.name} · ${session.email}`} locked />
                  : <div>
                      <TextInput type="email" value={manualAuditor} placeholder="you@solarsquare.in"
                        onChange={v => { setManualAuditor(v); try { localStorage.setItem('qa_auditor_email', v); } catch (e) {} }} />
                      <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--warn)', lineHeight: 1.4 }}>⚠ Login not auto-detected — type your email (saved for next time).</span>
                    </div>}
              </Field>
            </div>
          </Card>

          {SECTIONS.map((s, si) => {
            const pct = sectionPct[s.key];
            const tone = scoreTone(pct, threshold);
            return (
              <Card key={s.key} pad={false}
                title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 22, height: 22, borderRadius: 7, background: 'var(--primary-soft)', color: 'var(--primary-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{si + 1}</span>
                  {s.name}
                </span>}
                action={<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" onClick={() => bulkSection(s.key, 'Yes')} style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-3)', background: 'none', border: 'none', textDecoration: 'underline', textUnderlineOffset: 2 }}>All yes</button>
                  <Badge tone={pct == null ? 'neutral' : tone} mono>{pct == null ? 'N/A' : pct + '%'}</Badge>
                </div>}>
                <div>
                  {s.items.map((item, ii) => {
                    const it = normItem(item);
                    const id = `${s.key}-${ii}`;
                    return (
                      <div key={id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                        padding: '12px var(--pad-card)', minHeight: 'var(--row-h)',
                        borderBottom: ii < s.items.length - 1 ? '1px solid var(--line-soft)' : 'none',
                      }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 14, color: 'var(--ink)', lineHeight: 1.4 }}>{it.label}</span>
                          {it.eg.map((e, ei) => (
                            <span key={ei} style={{ display: 'block', fontSize: 12.5, color: 'var(--ink-3)', fontStyle: 'italic', lineHeight: 1.45, marginTop: 2 }}>({e})</span>
                          ))}
                        </span>
                        <SegToggle value={answers[id]} onChange={v => setAns(id, v)} size="sm" />
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}

          <Card title="Qualitative notes" subtitle="Shared with the LRM and their TL in the dispatched report.">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Strengths"><TextArea rows={2} value={notes.strengths} onChange={v => setNotes(n => ({ ...n, strengths: v }))} placeholder="What went well on this call…" /></Field>
              <Field label="Areas to improve"><TextArea rows={2} value={notes.improvements} onChange={v => setNotes(n => ({ ...n, improvements: v }))} placeholder="What to work on…" /></Field>
              <Field label="Action items"><TextArea rows={2} value={notes.actionItems} onChange={v => setNotes(n => ({ ...n, actionItems: v }))} placeholder="Concrete next steps…" /></Field>
            </div>
          </Card>
        </div>

        {/* RIGHT: sticky live score */}
        <div style={{ position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }} className="audit-rail">
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-3)' }}>Live score</div>
              <ScoreRing value={overall} size={132} stroke={12} threshold={threshold} />
              <Badge tone={pass ? 'ok' : 'bad'} style={{ fontSize: 13, padding: '5px 14px' }}>{pass ? '✓ Passing' : '✕ Below threshold'} · {threshold}%</Badge>
              <div style={{ width: '100%', height: 1, background: 'var(--line-soft)' }} />
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {SECTIONS.map(s => {
                  const pct = sectionPct[s.key];
                  const tone = pct == null ? 'neutral' : scoreTone(pct, threshold);
                  return (
                    <div key={s.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 8px', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{s.name}</span>
                      <span className="tnum" style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'var(--font-mono)', color: `var(--${tone === 'neutral' ? 'ink-3' : tone})` }}>{pct == null ? 'N/A' : pct + '%'}</span>
                      <div style={{ gridColumn: '1 / -1', height: 5, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ width: (pct || 0) + '%', height: '100%', background: `var(--${tone === 'neutral' ? 'ink-3' : tone})`, borderRadius: 99, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--ink-3)' }}>Meeting decision</span>
                {decision
                  ? <Badge tone={decision === 'Approved' ? 'ok' : 'bad'}>{decision === 'Approved' ? '✓ Approved' : '✕ Rejected'}</Badge>
                  : <span style={{ fontSize: 11, color: 'var(--warn)', fontWeight: 600 }}>Required</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <DecisionBtn active={decision === 'Approved'} tone="ok" label="Approve" sym="✓" onClick={() => setDecision('Approved')} />
                <DecisionBtn active={decision === 'Rejected'} tone="bad" label="Reject" sym="✕" onClick={() => setDecision('Rejected')} />
              </div>
              <p style={{ margin: 0, fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>Your call on whether this meeting proceeds — saved with the audit and sent to the LRM, TL, ZSM &amp; ADOS.</p>
            </div>
          </Card>
          <Button onClick={submit} disabled={busy} style={{ width: '100%', justifyContent: 'center', height: 46, opacity: busy ? 0.5 : 1 }}>
            {busy ? 'Saving…' : 'Submit audit & dispatch report'}
          </Button>
          <p style={{ fontSize: 11.5, color: 'var(--ink-3)', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
            On submit, a scored report is emailed to the LRM, their Team Lead, ZSM and ADOS.
          </p>
        </div>
      </div>
    </div>
  );
}

function ViewHeader({ title, sub, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 22, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ fontSize: 26, color: 'var(--ink)', letterSpacing: '-0.02em' }}>{title}</h1>
        {sub && <p style={{ margin: '6px 0 0', color: 'var(--ink-3)', fontSize: 14, maxWidth: 620, lineHeight: 1.5 }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

Object.assign(window, { AuditView, ViewHeader });
