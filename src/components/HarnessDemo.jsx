import React, { useState, useRef, useEffect } from 'react';
import { Send, ChevronDown, ChevronRight, Trash2, Cpu } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { runHarness, makeMemoryStore } from '../harness/mockEngine.js';

function TraceView({ events, lang, label, hideLabel }) {
  const [open, setOpen] = useState(false);
  if (!events || events.length === 0) return null;
  const render = (ev, i) => {
    if (ev.type === 'turn') return <div key={i} className="trace-line"><span className="t-turn">── turn {ev.i} ──</span></div>;
    if (ev.type === 'model') return <div key={i} className="trace-line"><span className="t-model">◈ model</span> → {ev.toolCalls} tool call(s){ev.inTokens != null && ` · ~${ev.inTokens + ev.outTokens} tok`}</div>;
    if (ev.type === 'tool_call') return <div key={i} className="trace-line"><span className="t-tool">⚙ {ev.name}</span> {JSON.stringify(ev.args)}</div>;
    if (ev.type === 'tool_result') return <div key={i} className="trace-line"><span className={ev.ok ? '' : 't-err'}>{ev.ok ? '↩' : '✖'} {ev.name}</span>: {ev.out}</div>;
    if (ev.type === 'done') return <div key={i} className="trace-line"><span className="t-ok">✔ done</span> · {ev.iterations} iteration(s)</div>;
    return null;
  };
  return (
    <div className="trace-toggle">
      <button className="btn btn-sm btn-ghost" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {open ? hideLabel : label}
      </button>
      {open && <div className="trace" style={{ marginTop: 8, maxHeight: 260 }}>{events.map(render)}</div>}
    </div>
  );
}

function fmtAnswer(text) {
  // minimal markdown: **bold** and line breaks
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => p.startsWith('**') && p.endsWith('**')
    ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>);
}

export default function HarnessDemo() {
  const { t, lang } = useLang();
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const storeRef = useRef(null);
  const logRef = useRef(null);
  if (!storeRef.current) {
    storeRef.current = makeMemoryStore({
      get: () => localStorage.getItem('hl-lab-mem'),
      set: (v) => localStorage.setItem('hl-lab-mem', v),
    });
  }

  useEffect(() => { logRef.current?.scrollTo({ top: 99999 }); }, [msgs, busy]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    const events = [];
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    try {
      const answer = await runHarness(q, {
        lang, store: storeRef.current,
        emit: (ev) => { if (ev.type !== 'start') events.push(ev); },
      });
      setMsgs((m) => [...m, { role: 'agent', text: answer, events: [...events] }]);
      try { const s = JSON.parse(localStorage.getItem('hl:v1') || '{}'); s.labChats = (s.labChats || 0) + 1; localStorage.setItem('hl:v1', JSON.stringify(s)); } catch {}
    } finally { setBusy(false); }
  };

  const clearMem = () => { storeRef.current.clear(); setMsgs([]); };

  const suggestions = lang === 'es'
    ? ['¿Cuánto es 144 / 12 + 7?', 'Recuerda que mi nave se llama Aurora', '¿Qué recuerdas de mí?', 'Busca información sobre MCP']
    : ['What is 144 / 12 + 7?', 'Remember that my ship is called Aurora', 'What do you remember about me?', 'Search for MCP'];

  return (
    <div>
      <div className="chat-wrap">
        <div className="chat-log" ref={logRef}>
          {msgs.length === 0 && (
            <div className="empty" style={{ padding: '40px 20px' }}>
              <Cpu size={36} style={{ color: 'var(--faint)', marginBottom: 12 }} />
              <p style={{ maxWidth: 440, margin: '0 auto 16px' }}>{t('lab.chatSub')}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {suggestions.map((s, i) => (
                  <button key={i} className="btn btn-sm" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`} style={{ whiteSpace: 'pre-line' }}>
              {m.role === 'agent' ? fmtAnswer(m.text) : m.text}
              {m.role === 'agent' && (
                <TraceView events={m.events} lang={lang} label={t('lab.traceToggle')} hideLabel={t('lab.hideTrace')} />
              )}
            </div>
          ))}
          {busy && <div className="msg agent"><span className="muted">◌ …</span></div>}
        </div>
        <div className="chat-input">
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('lab.chatPh')}
            onKeyDown={(e) => e.key === 'Enter' && send()} disabled={busy} />
          <button className="btn btn-primary" onClick={() => send()} disabled={busy || !input.trim()}>
            <Send size={15} /> {t('lab.send')}
          </button>
          <button className="icon-btn" onClick={clearMem} title="clear memory" style={{ width: 42, height: 42 }}><Trash2 size={16} /></button>
        </div>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{t('lab.honest')}</p>
    </div>
  );
}
