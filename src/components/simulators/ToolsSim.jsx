import React, { useState } from 'react';
import { Wrench, Plus, Trash2, Play } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext.jsx';
import { CodeBlock } from '../RichText.jsx';

const STR = {
  en: {
    title: 'Tool designer — what the model actually sees',
    sub: 'Design a tool the way the model will read it: name, description and JSON Schema. The description is a prompt — write it for the model, not for humans.',
    name: 'Tool name', desc: 'Description (the model reads this!)', descPh: 'e.g. Searches the company docs. Use when the user asks about…',
    params: 'Parameters', addParam: 'Add parameter', pname: 'name', ptype: 'type', preq: 'required', pdesc: 'description',
    preview: 'What the harness sends to the model', tryIt: 'Simulate a model call', result: 'Simulated execution',
    errors: { name: 'Name must match ^[a-zA-Z0-9_-]{1,64}$ (the model emits it verbatim).', param: 'Each parameter needs a name and a type.', desc: 'Write a description — without it the model will never call this tool well.' },
    ok: 'Schema valid. This is exactly the JSON your harness would attach to the model call.',
    callMade: 'The model would emit:', executed: 'Your harness executes it and appends:',
  },
  es: {
    title: 'Diseñador de tools — lo que el modelo ve realmente',
    sub: 'Diseña una tool como la leerá el modelo: nombre, descripción y JSON Schema. La descripción es un prompt — escríbela para el modelo, no para humanos.',
    name: 'Nombre de la tool', desc: 'Descripción (¡el modelo la lee!)', descPh: 'p. ej. Busca en la documentación interna. Úsala cuando el usuario pregunte sobre…',
    params: 'Parámetros', addParam: 'Añadir parámetro', pname: 'nombre', ptype: 'tipo', preq: 'requerido', pdesc: 'descripción',
    preview: 'Lo que el harness envía al modelo', tryIt: 'Simular una llamada del modelo', result: 'Ejecución simulada',
    errors: { name: 'El nombre debe cumplir ^[a-zA-Z0-9_-]{1,64}$ (el modelo lo emite literalmente).', param: 'Cada parámetro necesita nombre y tipo.', desc: 'Escribe una descripción — sin ella el modelo nunca usará bien esta tool.' },
    ok: 'Schema válido. Este es exactamente el JSON que tu harness adjuntaría a la llamada al modelo.',
    callMade: 'El modelo emitiría:', executed: 'Tu harness la ejecuta y añade:',
  },
};

const TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'];

export default function ToolsSim() {
  const { lang } = useLang();
  const S = STR[lang];
  const [name, setName] = useState('docs_search');
  const [desc, setDesc] = useState(lang === 'es'
    ? 'Busca en la documentación interna de la empresa. Úsala cuando el usuario pregunte por políticas, guías o procedimientos.'
    : 'Searches the company internal docs. Use when the user asks about policies, guides or procedures.');
  const [params, setParams] = useState([
    { name: 'query', type: 'string', required: true, desc: 'What to search for' },
    { name: 'limit', type: 'integer', required: false, desc: 'Max results (default 5)' },
  ]);
  const [simulated, setSimulated] = useState(false);

  const nameOk = /^[a-zA-Z0-9_-]{1,64}$/.test(name);
  const paramsOk = params.every((p) => p.name.trim() && TYPES.includes(p.type));
  const descOk = desc.trim().length > 10;
  const valid = nameOk && paramsOk && descOk;

  const schema = {
    type: 'function',
    function: {
      name,
      description: desc,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(params.map((p) => [p.name || 'unnamed', { type: p.type, description: p.desc }])),
        required: params.filter((p) => p.required && p.name).map((p) => p.name),
      },
    },
  };

  const sampleArgs = Object.fromEntries(params.map((p) => [p.name || 'unnamed',
    p.type === 'string' ? 'vacation policy' : p.type === 'integer' ? 3 : p.type === 'number' ? 1.5 : p.type === 'boolean' ? true : p.type === 'array' ? [] : {}]));

  const upd = (i, k, v) => setParams((p) => p.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <div className="sim-frame">
      <div className="sim-head"><Wrench size={16} style={{ color: 'var(--accent-text)' }} /> {S.title}</div>
      <div className="sim-body">
        <p className="muted" style={{ marginTop: 0 }}>{S.sub}</p>
        <div className="grid-2">
          <div>
            <label className="muted" style={{ fontSize: 13 }}>{S.name}</label>
            <input className="gloss-search" style={{ margin: '6px 0 12px' }} value={name} onChange={(e) => setName(e.target.value)} />
            <label className="muted" style={{ fontSize: 13 }}>{S.desc}</label>
            <textarea className="gloss-search" style={{ margin: '6px 0 12px', minHeight: 80, fontFamily: 'inherit' }}
              value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={S.descPh} />
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{S.params}</div>
            {params.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input className="gloss-search" style={{ margin: 0, flex: '1 1 90px', padding: '8px 10px' }} value={p.name}
                  onChange={(e) => upd(i, 'name', e.target.value)} placeholder={S.pname} />
                <select value={p.type} onChange={(e) => upd(i, 'type', e.target.value)}
                  style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px' }}>
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <label style={{ fontSize: 12.5, display: 'flex', gap: 4, alignItems: 'center' }}>
                  <input type="checkbox" checked={p.required} onChange={(e) => upd(i, 'required', e.target.checked)} /> {S.preq}
                </label>
                <button className="icon-btn" onClick={() => setParams((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => setParams((p) => [...p, { name: '', type: 'string', required: false, desc: '' }])}>
              <Plus size={14} /> {S.addParam}
            </button>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{S.preview}</div>
            <CodeBlock code={JSON.stringify(schema, null, 2)} lang="json" />
            {!valid && (
              <div className="callout warn">
                {!nameOk && <p>{S.errors.name}</p>}
                {!paramsOk && <p>{S.errors.param}</p>}
                {!descOk && <p>{S.errors.desc}</p>}
              </div>
            )}
            {valid && <div className="callout tip"><p>{S.ok}</p></div>}
            <button className="btn btn-sm btn-primary" disabled={!valid} onClick={() => setSimulated(true)}>
              <Play size={14} /> {S.tryIt}
            </button>
            {simulated && valid && (
              <div style={{ marginTop: 12 }}>
                <div className="muted" style={{ fontSize: 13 }}>{S.callMade}</div>
                <CodeBlock code={JSON.stringify({ tool_calls: [{ id: 'call_01', name, arguments: JSON.stringify(sampleArgs) }] }, null, 2)} lang="json" />
                <div className="muted" style={{ fontSize: 13 }}>{S.executed}</div>
                <CodeBlock code={JSON.stringify({ role: 'tool', name, content: JSON.stringify({ results: 3, top_hit: 'vacation-policy.md' }) }, null, 2)} lang="json" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
