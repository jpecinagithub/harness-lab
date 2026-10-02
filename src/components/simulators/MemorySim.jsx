import React, { useState } from 'react';
import { Brain, Eraser, Plus } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext.jsx';

const STR = {
  en: {
    title: 'Memory — the context window budget',
    sub: 'Every token in the window costs money and attention. Fill it, then compact it: compare truncation vs summarization.',
    window: 'Window', used: 'used', free: 'free',
    addUser: '+ user message (120)', addTool: '+ tool result (400)', addSchemas: '+ tool schemas (900)',
    compact: 'Compact now', strategy: 'Compaction strategy', trunc: 'Truncate oldest', sum: 'Summarize',
    log: 'Memory log', empty: 'The window is empty. Add some messages.',
    warn: 'Over 90% — the model is flying blind on the oldest content. Compact!',
    sumText: 'Summary: user is building a harness; discussed main loop, tool calling and costs.',
    didTrunc: 'Truncated oldest messages, freed', didSum: 'Summarized oldest messages into 300 tokens, freed',
    tokens: 'tokens',
  },
  es: {
    title: 'Memoria — el presupuesto de la ventana de contexto',
    sub: 'Cada token en la ventana cuesta dinero y atención. Llénala y luego compáctala: compara truncar con resumir.',
    window: 'Ventana', used: 'usados', free: 'libres',
    addUser: '+ mensaje usuario (120)', addTool: '+ resultado tool (400)', addSchemas: '+ schemas tools (900)',
    compact: 'Compactar ahora', strategy: 'Estrategia de compactación', trunc: 'Truncar lo antiguo', sum: 'Resumir',
    log: 'Registro de memoria', empty: 'La ventana está vacía. Añade mensajes.',
    warn: 'Más del 90% — el modelo vuela a ciegas sobre el contenido antiguo. ¡Compacta!',
    sumText: 'Resumen: el usuario está construyendo un harness; se habló del bucle principal, tool calling y costes.',
    didTrunc: 'Mensajes antiguos truncados, liberados', didSum: 'Mensajes antiguos resumidos en 300 tokens, liberados',
    tokens: 'tokens',
  },
};

const WINDOW = 8000;
const COLORS = { system: '#82aaff', user: '#4ade80', tool: '#2dd4bf', schemas: '#c792ea', summary: '#ffc53d' };

export default function MemorySim() {
  const { lang } = useLang();
  const S = STR[lang];
  const [items, setItems] = useState([]);
  const [strategy, setStrategy] = useState('sum');
  const [log, setLog] = useState([]);

  const used = items.reduce((s, i) => s + i.tok, 0);
  const pct = Math.min(100, (used / WINDOW) * 100);

  const add = (kind, label, tok) => {
    setItems((p) => [...p, { kind, label, tok, id: Date.now() + Math.random() }]);
    setLog((l) => [`+ ${label} (${tok})`, ...l].slice(0, 12));
  };

  const compact = () => {
    if (items.length < 2) return;
    const keepFrom = Math.ceil(items.length * 0.4);
    const dropped = items.slice(0, keepFrom);
    const freed = dropped.reduce((s, i) => s + i.tok, 0);
    if (strategy === 'trunc') {
      setItems(items.slice(keepFrom));
      setLog((l) => [`✂ ${S.didTrunc} ${freed} ${S.tokens}`, ...l].slice(0, 12));
    } else {
      const summary = { kind: 'summary', label: S.sumText, tok: 300, id: Date.now() };
      setItems([summary, ...items.slice(keepFrom)]);
      setLog((l) => [`∑ ${S.didSum} ${freed - 300} ${S.tokens}`, ...l].slice(0, 12));
    }
  };

  let acc = 0;
  return (
    <div className="sim-frame">
      <div className="sim-head"><Brain size={16} style={{ color: 'var(--accent-text)' }} /> {S.title}</div>
      <div className="sim-body">
        <p className="muted" style={{ marginTop: 0 }}>{S.sub}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
          <span className="muted">{S.window}: {WINDOW.toLocaleString()} tokens</span>
          <span><strong>{used.toLocaleString()}</strong> {S.used} · {(WINDOW - used).toLocaleString()} {S.free}</span>
        </div>
        <div className="tokenbar" style={{ marginBottom: 8 }}>
          {items.map((it) => {
            const w = (it.tok / WINDOW) * 100;
            const left = (acc / WINDOW) * 100; acc += it.tok;
            return <div key={it.id} title={`${it.label} (${it.tok})`} style={{ width: `${w}%`, marginLeft: 0, background: COLORS[it.kind] || '#888', position: 'relative', left: 0 }} />;
          })}
        </div>
        {pct > 90 && <div className="callout warn" style={{ margin: '0 0 12px' }}><p>{S.warn}</p></div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button className="btn btn-sm" onClick={() => add('user', 'user message', 120)}><Plus size={14} /> {S.addUser}</button>
          <button className="btn btn-sm" onClick={() => add('tool', 'tool result', 400)}><Plus size={14} /> {S.addTool}</button>
          <button className="btn btn-sm" onClick={() => add('schemas', 'tool schemas', 900)}><Plus size={14} /> {S.addSchemas}</button>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
          <span className="muted" style={{ fontSize: 13 }}>{S.strategy}:</span>
          <div className="seg">
            <button className={strategy === 'trunc' ? 'on' : ''} onClick={() => setStrategy('trunc')}>{S.trunc}</button>
            <button className={strategy === 'sum' ? 'on' : ''} onClick={() => setStrategy('sum')}>{S.sum}</button>
          </div>
          <button className="btn btn-sm btn-primary" onClick={compact}><Eraser size={14} /> {S.compact}</button>
        </div>
        <div className="grid-2">
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{S.window}</div>
            <div className="trace" style={{ maxHeight: 220 }}>
              {items.length === 0 && <div className="trace-line" style={{ color: 'var(--faint)' }}>{S.empty}</div>}
              {items.map((it) => (
                <div key={it.id} className="trace-line">
                  <span style={{ color: COLORS[it.kind] }}>■</span> {it.label.slice(0, 90)} <span className="muted">({it.tok})</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{S.log}</div>
            <div className="trace" style={{ maxHeight: 220 }}>
              {log.length === 0 && <div className="trace-line" style={{ color: 'var(--faint)' }}>—</div>}
              {log.map((l, i) => <div key={i} className="trace-line">{l}</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
