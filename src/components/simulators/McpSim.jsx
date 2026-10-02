import React, { useState } from 'react';
import { Network, Play, StepForward, RotateCcw } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext.jsx';
import { CodeBlock } from '../RichText.jsx';

const STR = {
  en: {
    title: 'MCP — one server, any harness',
    sub: 'The Model Context Protocol decouples tools from harnesses. Explore a demo server and watch the JSON-RPC handshake that wires them together.',
    host: 'HOST', hostD: 'Your harness app (this portal, a CLI, an IDE)',
    client: 'CLIENT', clientD: 'MCP client · 1:1 with a server · JSON-RPC',
    server: 'SERVER', serverD: 'harness-docs · exposes Tools, Resources, Prompts',
    tabs: ['Tools', 'Resources', 'Prompts'], exchange: 'Protocol exchange', play: 'Play handshake', next: 'Next message', reset: 'Reset',
  },
  es: {
    title: 'MCP — un servidor, cualquier harness',
    sub: 'El Model Context Protocol desacopla las tools de los harnesses. Explora un servidor demo y observa el handshake JSON-RPC que los conecta.',
    host: 'HOST', hostD: 'Tu app harness (este portal, una CLI, un IDE)',
    client: 'CLIENTE', clientD: 'Cliente MCP · 1:1 con un servidor · JSON-RPC',
    server: 'SERVIDOR', serverD: 'harness-docs · expone Tools, Resources, Prompts',
    tabs: ['Tools', 'Recursos', 'Prompts'], exchange: 'Intercambio del protocolo', play: 'Ver handshake', next: 'Siguiente mensaje', reset: 'Reiniciar',
  },
};

const PRIMS = {
  tools: {
    'tools/list →': { tools: [{ name: 'docs_search', description: 'Search harness engineering docs' }, { name: 'calc', description: 'Evaluate arithmetic' }] },
  },
  resources: {
    'resources/list →': { resources: [{ uri: 'docs://main-loop', name: 'Main loop guide' }, { uri: 'docs://mcp-spec', name: 'MCP cheat sheet' }] },
  },
  prompts: {
    'prompts/list →': { prompts: [{ name: 'harness_review', description: 'Review a harness design for flaws' }] },
  },
};

const EXCHANGE = [
  { from: 'client → server', json: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: { tools: {} } } }, note: { en: 'Handshake: versions + capabilities.', es: 'Handshake: versiones + capacidades.' } },
  { from: 'server → client', json: { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05', serverInfo: { name: 'harness-docs', version: '1.0.0' } } }, note: { en: 'Server identifies itself.', es: 'El servidor se identifica.' } },
  { from: 'client → server', json: { jsonrpc: '2.0', id: 2, method: 'tools/list' }, note: { en: 'Discovery: what tools exist?', es: 'Descubrimiento: ¿qué tools existen?' } },
  { from: 'server → client', json: { jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'docs_search', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } }] } }, note: { en: 'Tool schemas arrive — the harness registers them like local tools.', es: 'Llegan los schemas — el harness los registra como tools locales.' } },
  { from: 'client → server', json: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'docs_search', arguments: { query: 'main loop' } } }, note: { en: 'The model wanted docs_search — the client forwards the call.', es: 'El modelo pidió docs_search — el cliente reenvía la llamada.' } },
  { from: 'server → client', json: { jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: 'Main loop: messages → model → tools → repeat…' }] } }, note: { en: 'Result flows back into the main loop as a tool message.', es: 'El resultado vuelve al bucle principal como mensaje tool.' } },
];

export default function McpSim() {
  const { lang } = useLang();
  const S = STR[lang];
  const [tab, setTab] = useState('tools');
  const [step, setStep] = useState(0);

  const Box = ({ title, desc, accent }) => (
    <div className="card" style={{ textAlign: 'center', boxShadow: 'none', borderTop: `3px solid ${accent}` }}>
      <div className="chip" style={{ marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13 }} className="muted">{desc}</div>
    </div>
  );

  return (
    <div className="sim-frame">
      <div className="sim-head"><Network size={16} style={{ color: 'var(--accent-text)' }} /> {S.title}</div>
      <div className="sim-body">
        <p className="muted" style={{ marginTop: 0 }}>{S.sub}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: 10, alignItems: 'stretch', marginBottom: 22 }}>
          <Box title={S.host} desc={S.hostD} accent="var(--accent)" />
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--faint)', fontSize: 22 }}>→</div>
          <Box title={S.client} desc={S.clientD} accent="var(--teal)" />
          <div style={{ display: 'flex', alignItems: 'center', color: 'var(--faint)', fontSize: 22 }}>→</div>
          <Box title={S.server} desc={S.serverD} accent="#82aaff" />
        </div>
        <div className="grid-2">
          <div>
            <div className="seg" style={{ marginBottom: 12 }}>
              {S.tabs.map((tb, i) => {
                const k = ['tools', 'resources', 'prompts'][i];
                return <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{tb}</button>;
              })}
            </div>
            {Object.entries(PRIMS[tab]).map(([label, body], i) => (
              <div key={i}>
                <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}><code className="inline">{label}</code></div>
                <CodeBlock code={JSON.stringify(body, null, 2)} lang="json" />
              </div>
            ))}
          </div>
          <div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>{S.exchange}</div>
            <div className="trace" style={{ maxHeight: 330 }}>
              {EXCHANGE.slice(0, step + 1).map((m, i) => (
                <div key={i} className="trace-line" style={{ marginBottom: 8 }}>
                  <span className={m.from.startsWith('client') ? 't-model' : 't-tool'}>{m.from}</span>
                  <span className="muted"> — {m.note[lang]}</span>
                  <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{JSON.stringify(m.json, null, 1)}</pre>
                </div>
              ))}
              {step === 0 && <div className="trace-line" style={{ color: 'var(--faint)' }}>// {S.play}…</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-sm btn-primary" disabled={step >= EXCHANGE.length - 1} onClick={() => setStep(step + 1)}>
                {step === 0 ? <Play size={14} /> : <StepForward size={14} />} {step === 0 ? S.play : S.next}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setStep(0)}><RotateCcw size={14} /> {S.reset}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
