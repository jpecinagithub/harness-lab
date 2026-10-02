#!/usr/bin/env node
/**
 * HARNESS LAB — CLI harness (the same harness as the browser & desktop demos).
 *
 *   node harness-cli.mjs --mock "Remember that the code is 4177, then tell me what 12*8 is"
 *   node harness-cli.mjs "What is 144/12 + 7?"            # needs HARNESS_API_KEY
 *   node harness-cli.mjs                                   # interactive REPL
 *
 * Real-model mode talks to any OpenAI-compatible API:
 *   export HARNESS_API_KEY="sk-..."                        # required (unless --mock)
 *   export HARNESS_BASE_URL="https://api.openai.com/v1"    # optional
 *   export HARNESS_MODEL="gpt-4o-mini"                     # optional
 *
 * The main loop below is identical to the one taught in HARNESS LAB.
 * Node 18+ required (uses global fetch). No dependencies.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import readline from 'readline';

// ---------------------------------------------------------------- tools ---
function safeCalc(input) {
  const s = String(input).trim().slice(0, 120).replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**');
  if (!/^[\d\s+\-*/().%^,]+$/.test(s) || !/\d/.test(s) || !/[+\-*/%^]/.test(s)) throw new Error('not arithmetic');
  // eslint-disable-next-line no-new-func
  const v = Function('"use strict";return(' + s.replace(/,/g, '') + ')')();
  if (typeof v !== 'number' || !isFinite(v)) throw new Error('not finite');
  return Math.round(v * 1e10) / 1e10;
}

const DOCS = [
  ['Main loop', 'messages → model → tool_calls → execute → append → repeat until a final answer.'],
  ['Tool calling', 'The model requests structured actions via JSON; the harness executes them.'],
  ['MCP', 'Host → Client → Server over JSON-RPC; servers expose Tools, Resources, Prompts.'],
  ['Memory', 'Short-term = context window; long-term = vector stores / memory tools.'],
  ['Secondary loops', 'Planning, reflection and delegation loops wrap the main loop.'],
];

const store = (() => {
  const dir = join(homedir(), '.harness-lab');
  const file = join(dir, 'memory.json');
  let mem = {};
  try { mkdirSync(dir, { recursive: true }); if (existsSync(file)) mem = JSON.parse(readFileSync(file, 'utf8')); } catch {}
  const save = () => { try { writeFileSync(file, JSON.stringify(mem, null, 2)); } catch {} };
  return {
    get: (k) => (k in mem ? mem[k] : null),
    set: (k, v) => { mem[k] = v; save(); },
    facts: () => Object.entries(mem).filter(([k]) => k.startsWith('mem:')).map(([k, v]) => ({ key: k.slice(4), value: v })),
  };
})();

const TOOLS = {
  calculator: {
    def: { type: 'function', function: { name: 'calculator', description: 'Evaluates an arithmetic expression.', parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] } } },
    run: async ({ expression }) => ({ expression, result: safeCalc(expression) }),
  },
  memory_write: {
    def: { type: 'function', function: { name: 'memory_write', description: 'Stores a fact in long-term memory.', parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] } } },
    run: async ({ key, value }) => { store.set('mem:' + key, value); return { stored: { key, value } }; },
  },
  memory_read: {
    def: { type: 'function', function: { name: 'memory_read', description: 'Reads facts from long-term memory.', parameters: { type: 'object', properties: { key: { type: 'string' } } } } },
    run: async ({ key }) => (key ? { key, value: store.get('mem:' + key) } : { facts: store.facts() }),
  },
  notes_write: {
    def: { type: 'function', function: { name: 'notes_write', description: 'Appends a timestamped note.', parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } },
    run: async ({ text }) => { const n = JSON.parse(store.get('notes') || '[]'); n.push({ ts: new Date().toISOString(), text }); store.set('notes', JSON.stringify(n)); return { saved: text, total: n.length }; },
  },
  web_search: {
    def: { type: 'function', function: { name: 'web_search', description: 'Searches the demo harness-engineering docs.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
    run: async ({ query }) => {
      const q = query.toLowerCase().split(/\s+/);
      const results = DOCS.map(([title, snippet]) => ({ title, snippet, s: q.reduce((a, w) => a + (w.length > 2 && (title + snippet).toLowerCase().includes(w) ? 1 : 0), 0) }))
        .filter((r) => r.s > 0).sort((a, b) => b.s - a.s).slice(0, 2).map(({ title, snippet }) => ({ title, snippet }));
      return { query, results };
    },
  },
};
const TOOL_DEFS = Object.values(TOOLS).map((t) => t.def);

// ------------------------------------------------------- simulated model ---
function detectIntents(text) {
  const intents = [];
  const re = /(\d+(?:\s*[+\-*/^%×÷]\s*\d+(?:\s*[+\-*/^%×÷]\s*\d+)*))/g;
  let m; const seen = new Set();
  while ((m = re.exec(text))) { try { safeCalc(m[1]); if (!seen.has(m[1])) { seen.add(m[1]); intents.push({ kind: 'calc', expr: m[1].trim() }); } } catch {} }
  const rm = text.match(/(remember|recuerda|recorda|guarda?|memoriza)[^.!\n]{0,6}(?:que|:)?\s*([^.!?\n]{3,160})/i);
  if (rm) { const kv = rm[2].trim().match(/(?:my\s+)?([\wáéíóúñü ]{1,30}?)\s+(?:is|es|son)\s+(.+)/i); let value = kv ? kv[2].trim() : rm[2].trim(); value = value.split(/,?\s*then\b/i)[0].trim(); intents.push({ kind: 'remember', key: kv ? kv[1].trim().toLowerCase() : 'fact', value }); }
  if (/(what did i tell you|what do you remember|qué te (dije|he dicho)|qué recuerdas|do you remember)/i.test(text)) intents.push({ kind: 'recall' });
  const nm = text.match(/(?:take a note|anota|nota):?\s*([^.!?\n]{3,200})/i);
  if (nm && !rm) intents.push({ kind: 'note', text: nm[1].trim() });
  const sm = text.match(/(?:search|busca|find|encuentra)(?:\s+(?:for|sobre|acerca\s+de))?\s+([^.!?\n]{2,80})/i);
  if (sm) intents.push({ kind: 'search', query: sm[1].trim() });
  return intents;
}

async function mockModel(messages) {
  const userText = [...messages].reverse().find((m) => m.role === 'user').content;
  const done = new Set(messages.flatMap((m) => (m.tool_calls || []).map((tc) => tc.name + JSON.stringify(tc.args))));
  const pending = [];
  for (const it of detectIntents(userText)) {
    const tc = it.kind === 'calc' ? { name: 'calculator', args: { expression: it.expr } }
      : it.kind === 'remember' ? { name: 'memory_write', args: { key: it.key, value: it.value } }
      : it.kind === 'recall' ? { name: 'memory_read', args: {} }
      : it.kind === 'note' ? { name: 'notes_write', args: { text: it.text } }
      : { name: 'web_search', args: { query: it.query } };
    if (!done.has(tc.name + JSON.stringify(tc.args))) pending.push(tc);
  }
  if (pending.length) return { toolCalls: pending };
  // compose final answer from tool results
  const parts = [];
  for (const m of messages) {
    if (m.role !== 'tool') continue;
    const d = JSON.parse(m.content);
    if (m.name === 'calculator') parts.push(`${d.expression} = ${d.result}`);
    else if (m.name === 'memory_write') parts.push(`Remembered: ${d.stored.key} = ${d.stored.value}`);
    else if (m.name === 'memory_read') parts.push(d.facts.length ? 'Memory:\n' + d.facts.map((f) => `  - ${f.key}: ${f.value}`).join('\n') : 'Memory is empty.');
    else if (m.name === 'notes_write') parts.push(`Noted (${d.total} total): ${d.saved}`);
    else if (m.name === 'web_search') parts.push(d.results.length ? d.results.map((r) => `* ${r.title}: ${r.snippet}`).join('\n') : `No docs matched "${d.query}".`);
  }
  return { content: parts.length ? parts.join('\n') : 'I am a simulated model: ask me to calculate, remember, recall, note or search.' };
}

// ------------------------------------------------------------ real model ---
async function realModel(messages) {
  const base = process.env.HARNESS_BASE_URL || 'https://api.openai.com/v1';
  const key = process.env.HARNESS_API_KEY;
  if (!key) throw new Error('Set HARNESS_API_KEY (or run with --mock).');
  const res = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model: process.env.HARNESS_MODEL || 'gpt-4o-mini',
      messages: messages.filter((m) => m.role !== 'tool' || true).map((m) =>
        m.role === 'tool' ? { role: 'tool', tool_call_id: m.tool_call_id, content: m.content } : m),
      tools: TOOL_DEFS,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const msg = data.choices[0].message;
  const toolCalls = (msg.tool_calls || []).map((tc) => ({ id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments || '{}') }));
  return toolCalls.length ? { toolCalls } : { content: msg.content || '' };
}

// --------------------------------------------------------------- the loop ---
const MAX_ITERS = 8;
async function agentLoop(userMessage, modelFn, log) {
  const messages = [{ role: 'user', content: userMessage }];
  for (let i = 1; i <= MAX_ITERS; i++) {
    log(`── turn ${i} ──`);
    const res = await modelFn(messages);
    if (!res.toolCalls || res.toolCalls.length === 0) { log(`✔ done in ${i} iteration(s)`); return res.content; }
    for (const tc of res.toolCalls) {
      log(`⚙ ${tc.name} ${JSON.stringify(tc.args)}`);
      let out;
      try { out = await TOOLS[tc.name].run(tc.args); log(`  ↩ ${JSON.stringify(out).slice(0, 160)}`); }
      catch (err) { out = { error: String(err.message) }; log(`  ✖ ${out.error}`); }
      messages.push({ role: 'assistant', content: '', tool_calls: [{ name: tc.name, args: tc.args }] });
      messages.push({ role: 'tool', tool_call_id: tc.id || ('call_' + i), name: tc.name, content: JSON.stringify(out) });
    }
  }
  return '[max iterations reached]';
}

// ------------------------------------------------------------------- cli ---
const args = process.argv.slice(2);
const mock = args.includes('--mock');
const message = args.filter((a) => a !== '--mock').join(' ').trim();
const modelFn = mock ? mockModel : realModel;

console.log(`harness-cli · ${mock ? 'MOCK model (no key needed)' : 'model: ' + (process.env.HARNESS_MODEL || 'gpt-4o-mini')} · tools: ${Object.keys(TOOLS).join(', ')}`);

async function handle(text) {
  console.log('\n> ' + text);
  const answer = await agentLoop(text, modelFn, (l) => console.log('  ' + l));
  console.log('\n' + answer + '\n');
}

if (message) {
  handle(message).catch((e) => { console.error('Error:', e.message); process.exit(1); });
} else {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'harness> ' });
  rl.prompt();
  rl.on('line', async (line) => {
    const t = line.trim();
    if (!t || t === 'exit' || t === 'quit') return rl.close();
    try { await handle(t); } catch (e) { console.error('Error:', e.message); }
    rl.prompt();
  });
}
