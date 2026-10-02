import React, { useState, useRef } from 'react';
import { Play, RotateCcw, FlaskConical, Info } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext.jsx';
import { MODEL, makeTools, makeMemoryStore, estimateTokens } from '../../harness/mockEngine.js';

const PRESETS = {
  main: `// PRESET: the canonical main loop.
// messages[] is the single source of truth. The model decides;
// the harness executes. Tweak MAX_ITERS and watch the trace.
const MAX_ITERS = 6;

async function agentLoop(userMessage) {
  const messages = [{ role: 'user', content: userMessage }];

  for (let i = 1; i <= MAX_ITERS; i++) {
    emit({ type: 'turn', i });

    // 1. Ask the model. It returns text OR tool_calls.
    const res = await MODEL(messages, TOOLS);
    emit({ type: 'model', toolCalls: (res.toolCalls || []).length,
           inTokens: res.inTokens, outTokens: res.outTokens });

    // 2. Stop condition: no tool calls => final answer.
    if (!res.toolCalls || res.toolCalls.length === 0) {
      emit({ type: 'done', answer: res.content, iterations: i,
             inTokens: 0, outTokens: 0 });
      return res.content;
    }

    // 3. Execute every tool call, feed results back as messages.
    for (const tc of res.toolCalls) {
      emit({ type: 'tool_call', name: tc.name, args: tc.args });
      const out = await TOOLS[tc.name].run(tc.args, store);
      emit({ type: 'tool_result', name: tc.name, ok: true,
             out: JSON.stringify(out).slice(0, 220) });
      messages.push({ role: 'assistant', tool_calls: [tc] });
      messages.push({ role: 'tool', name: tc.name,
                      content: JSON.stringify(out) });
    }
  }
  emit({ type: 'done', answer: 'Max iterations reached.',
         iterations: MAX_ITERS });
}`,
  memory: `// PRESET: main loop + long-term memory discipline.
// A system prompt sets the behavior; memory_read primes short-term
// memory before the loop starts. Try: "remember my ship is Aurora"
// then in a second run: "what is my ship?"
const MAX_ITERS = 6;
const SYSTEM = 'You are a harness assistant. Use memory_write for ' +
  'facts the user asks you to remember, memory_read to recall them.';

async function agentLoop(userMessage) {
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: userMessage },
  ];

  // Prime: surface long-term memory into the working context.
  const known = await TOOLS.memory_read.run({}, store);
  if (known.facts && known.facts.length > 0) {
    messages.push({ role: 'system',
      content: 'Known facts: ' + JSON.stringify(known.facts) });
    emit({ type: 'tool_result', name: 'memory_read', ok: true,
           out: known.facts.length + ' facts primed' });
  }

  for (let i = 1; i <= MAX_ITERS; i++) {
    emit({ type: 'turn', i });
    const res = await MODEL(messages, TOOLS);
    emit({ type: 'model', toolCalls: (res.toolCalls || []).length,
           inTokens: res.inTokens, outTokens: res.outTokens });
    if (!res.toolCalls || res.toolCalls.length === 0) {
      emit({ type: 'done', answer: res.content, iterations: i });
      return res.content;
    }
    for (const tc of res.toolCalls) {
      emit({ type: 'tool_call', name: tc.name, args: tc.args });
      try {
        const out = await TOOLS[tc.name].run(tc.args, store);
        emit({ type: 'tool_result', name: tc.name, ok: true,
               out: JSON.stringify(out).slice(0, 220) });
        messages.push({ role: 'assistant', tool_calls: [tc] });
        messages.push({ role: 'tool', name: tc.name,
                        content: JSON.stringify(out) });
      } catch (err) {
        // Tool errors are data, not crashes: tell the model.
        emit({ type: 'tool_result', name: tc.name, ok: false,
               out: String(err.message) });
        messages.push({ role: 'assistant', tool_calls: [tc] });
        messages.push({ role: 'tool', name: tc.name,
                        content: JSON.stringify({ error: String(err.message) }) });
      }
    }
  }
  emit({ type: 'done', answer: 'Max iterations reached.',
         iterations: MAX_ITERS });
}`,
  planner: `// PRESET: a SECONDARY loop — plan, then execute, then replan.
// The planner is just another model call whose "tool" is a plan.
// The main loop below only executes; the outer loop supervises.
const MAX_ITERS = 6;

async function agentLoop(userMessage) {
  // ---- secondary loop: planning ----
  emit({ type: 'turn', i: 'plan' });
  const planRes = await MODEL(
    [{ role: 'system',
       content: 'Break the request into numbered steps.' },
     { role: 'user', content: userMessage }], TOOLS);
  const plan = planRes.toolCalls && planRes.toolCalls.length > 0
    ? planRes.toolCalls.map((t) => t.name + ' ' + JSON.stringify(t.args))
    : ['answer directly'];
  emit({ type: 'model', toolCalls: plan.length, note: 'plan: ' + plan.join(' | ') });

  // ---- main loop: execution ----
  const messages = [{ role: 'user', content: userMessage },
    { role: 'system', content: 'Plan: ' + plan.join('; ') + '. Follow it.' }];
  for (let i = 1; i <= MAX_ITERS; i++) {
    emit({ type: 'turn', i });
    const res = await MODEL(messages, TOOLS);
    emit({ type: 'model', toolCalls: (res.toolCalls || []).length,
           inTokens: res.inTokens, outTokens: res.outTokens });
    if (!res.toolCalls || res.toolCalls.length === 0) {
      emit({ type: 'done', answer: res.content, iterations: i });
      return res.content;
    }
    for (const tc of res.toolCalls) {
      emit({ type: 'tool_call', name: tc.name, args: tc.args });
      const out = await TOOLS[tc.name].run(tc.args, store);
      emit({ type: 'tool_result', name: tc.name, ok: true,
             out: JSON.stringify(out).slice(0, 220) });
      messages.push({ role: 'assistant', tool_calls: [tc] });
      messages.push({ role: 'tool', name: tc.name, content: JSON.stringify(out) });
    }
  }
  emit({ type: 'done', answer: 'Max iterations reached.', iterations: MAX_ITERS });
}`,
};

const STR = {
  en: {
    api: [
      ['MODEL(messages, tools)', 'simulated model call → {content} or {toolCalls[]}'],
      ['TOOLS', 'registry: calculator · memory_write · memory_read · notes_write · web_search'],
      ['store', 'fresh long-term memory for this run (get/set)'],
      ['emit(event)', 'append a line to the trace below'],
      ['estimateTokens(text)', 'rough token counter (≈ chars / 4)'],
    ],
    errNoFn: 'Your code must define: async function agentLoop(userMessage)',
    errTooLong: 'Keep the code under 200 lines for readability.',
    timeout: 'Execution stopped: 20s cap reached (infinite loop guard).',
    modelCap: 'Execution stopped: 30 model calls cap reached.',
  },
  es: {
    api: [
      ['MODEL(messages, tools)', 'llamada al modelo simulado → {content} o {toolCalls[]}'],
      ['TOOLS', 'registro: calculator · memory_write · memory_read · notes_write · web_search'],
      ['store', 'memoria de largo plazo fresca para esta ejecución (get/set)'],
      ['emit(evento)', 'añade una línea a la traza de abajo'],
      ['estimateTokens(texto)', 'contador aproximado de tokens (≈ caracteres / 4)'],
    ],
    errNoFn: 'Tu código debe definir: async function agentLoop(userMessage)',
    errTooLong: 'Mantén el código por debajo de 200 líneas para legibilidad.',
    timeout: 'Ejecución detenida: límite de 20 s alcanzado (protección anti-bucle infinito).',
    modelCap: 'Ejecución detenida: límite de 30 llamadas al modelo alcanzado.',
  },
};

function renderTrace(ev, lang) {
  switch (ev.type) {
    case 'start': return <span><span className="t-turn">▶ input</span> {ev.text}</span>;
    case 'turn': return <span className="t-turn">── turn {ev.i} ──</span>;
    case 'model': return <span><span className="t-model">◈ model</span> → {ev.toolCalls} tool call(s){ev.inTokens != null && ` · ~${ev.inTokens + ev.outTokens} tokens`}{ev.note && ` · ${ev.note}`}</span>;
    case 'tool_call': return <span><span className="t-tool">⚙ {ev.name}</span> {JSON.stringify(ev.args)}</span>;
    case 'tool_result': return <span className={ev.ok === false ? 't-err' : ''}>{ev.ok === false ? '✖' : '↩'} {ev.name}: {ev.out}</span>;
    case 'done': return <span><span className="t-ok">✔ done</span> · {ev.iterations} iteration(s){ev.inTokens ? ` · ~${ev.inTokens + ev.outTokens} tokens` : ''}<br />{String(ev.answer).slice(0, 500)}</span>;
    case 'error': return <span className="t-err">✖ {ev.message}</span>;
    default: return <span>{JSON.stringify(ev)}</span>;
  }
}

export default function Sandbox({ compact = false }) {
  const { t, lang } = useLang();
  const S = STR[lang];
  const [code, setCode] = useState(PRESETS.main);
  const [input, setInput] = useState('');
  const [trace, setTrace] = useState([]);
  const [running, setRunning] = useState(false);
  const [preset, setPreset] = useState('main');

  const run = async () => {
    if (running) return;
    if (!/async\s+function\s+agentLoop\s*\(/.test(code)) {
      setTrace([{ type: 'error', message: S.errNoFn }]);
      return;
    }
    if (code.split('\n').length > 200) {
      setTrace([{ type: 'error', message: S.errTooLong }]);
      return;
    }
    setRunning(true);
    const events = [];
    const emit = (ev) => { events.push(ev); if (events.length < 400) setTrace([...events]); };
    try {
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      let modelCalls = 0;
      const guardedModel = async (messages, tools) => {
        if (++modelCalls > 30) throw new Error(S.modelCap);
        return MODEL(messages, tools, { lang, store });
      };
      const store = makeMemoryStore(null);
      const TOOLS = makeTools();
      const factory = new AsyncFunction('MODEL', 'TOOLS', 'emit', 'estimateTokens', 'store', code + '\nreturn agentLoop;');
      const agentLoop = await factory(guardedModel, TOOLS, emit, estimateTokens, store);
      if (typeof agentLoop !== 'function') throw new Error(S.errNoFn);
      const userMessage = input.trim() || (lang === 'es'
        ? 'Recuerda que el código es 4177 y dime cuánto es 12 * 8'
        : 'Remember that the code is 4177, then tell me what 12 * 8 is');
      await Promise.race([
        agentLoop(userMessage),
        new Promise((_, rej) => setTimeout(() => rej(new Error(S.timeout)), 20000)),
      ]);
      try { const s = JSON.parse(localStorage.getItem('hl:v1') || '{}'); s.sandboxRuns = (s.sandboxRuns || 0) + 1; localStorage.setItem('hl:v1', JSON.stringify(s)); } catch {}
    } catch (err) {
      emit({ type: 'error', message: String(err.message || err).slice(0, 300) });
    } finally {
      setTrace([...events]);
      setRunning(false);
    }
  };

  const loadPreset = (k) => { setPreset(k); setCode(PRESETS[k]); setTrace([]); };

  return (
    <div className="sim-frame">
      <div className="sim-head">
        <FlaskConical size={16} style={{ color: 'var(--accent-text)' }} /> {t('sandbox.title')}
        <span className="chip teal" style={{ marginLeft: 'auto' }}>javascript · mock LLM</span>
      </div>
      <div className="sim-body">
        {!compact && <p className="muted" style={{ marginTop: 0 }}>{t('sandbox.sub')}</p>}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>{t('sandbox.presets')}:</span>
          {['main', 'memory', 'planner'].map((k) => (
            <button key={k} className={`btn btn-sm${preset === k ? ' btn-primary' : ''}`} onClick={() => loadPreset(k)}>
              {t(`sandbox.p${['main', 'memory', 'planner'].indexOf(k) + 1}`)}
            </button>
          ))}
          <button className="btn btn-sm btn-ghost" onClick={() => { setCode(PRESETS[preset]); setTrace([]); }}>
            <RotateCcw size={14} />
          </button>
        </div>
        <textarea className="editor" value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} />
        <div className="callout tip" style={{ marginTop: 14 }}>
          <div className="callout-title"><Info size={15} /> {t('sandbox.apiTitle')}</div>
          {S.api.map(([k, v], i) => (
            <div key={i} style={{ fontSize: 13.5, marginBottom: 4 }}><code className="inline">{k}</code> <span className="muted">— {v}</span></div>
          ))}
          <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>{t('sandbox.apiBody')}</p>
        </div>
        <label className="muted" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>{t('sandbox.input')}</label>
        <div className="chat-input" style={{ border: '1px solid var(--border-soft)', borderRadius: 12, marginBottom: 14 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('sandbox.inputPh')} onKeyDown={(e) => e.key === 'Enter' && run()} />
          <button className="btn btn-primary" onClick={run} disabled={running}>
            <Play size={15} /> {running ? t('sandbox.running') : t('sandbox.run')}
          </button>
        </div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{t('sandbox.trace')}</div>
        <div className="trace" style={{ minHeight: 120 }}>
          {trace.length === 0 && <div className="trace-line" style={{ color: 'var(--faint)' }}>// {t('sandbox.mockNote').slice(0, 60)}…</div>}
          {trace.map((ev, i) => <div key={i} className="trace-line">{renderTrace(ev, lang)}</div>)}
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{t('sandbox.mockNote')}</p>
      </div>
    </div>
  );
}
