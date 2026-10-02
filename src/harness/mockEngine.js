// HARNESS LAB — shared harness engine (simulated model + real tools).
// The SAME main loop and tool set power: the JS Sandbox, the live browser demo,
// the downloadable desktop file and the CLI script. The model is scripted on
// purpose (zero cost, mechanics fully visible); swap MODEL for a real API call
// and the loop below becomes a production harness.

export function estimateTokens(text) {
  if (!text) return 0;
  return Math.max(1, Math.ceil(String(text).length / 4));
}

// ---------- safe arithmetic ----------
function tokenizeExpr(s) {
  const tokens = [];
  let i = 0;
  const clean = s.replace(/×/g, '*').replace(/÷/g, '/').replace(/\^/g, '**').replace(/,/g, '');
  while (i < clean.length) {
    const c = clean[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let num = '';
      while (i < clean.length && /[0-9.]/.test(clean[i])) num += clean[i++];
      if (num.split('.').length > 2) throw new Error('bad number');
      tokens.push({ t: 'n', v: parseFloat(num) });
      continue;
    }
    if ('+-*/()%'.includes(c) || (c === '*' && clean[i + 1] === '*')) {
      if (c === '*' && clean[i + 1] === '*') { tokens.push({ t: 'op', v: '**' }); i += 2; }
      else { tokens.push({ t: c === '(' || c === ')' ? 'p' : 'op', v: c }); i++; }
      continue;
    }
    throw new Error('bad char: ' + c);
  }
  return tokens;
}
function parseExpr(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  function expr() {
    let v = term();
    while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = tokens[pos++].v; const r = term(); v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term() {
    let v = factor();
    while (peek() && peek().t === 'op' && (peek().v === '*' || peek().v === '/' || peek().v === '%')) {
      const op = tokens[pos++].v; const r = factor();
      v = op === '*' ? v * r : op === '/' ? v / r : v % r;
    }
    return v;
  }
  function factor() {
    let v = unary();
    if (peek() && peek().t === 'op' && peek().v === '**') { pos++; v = Math.pow(v, factor()); }
    return v;
  }
  function unary() {
    if (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = tokens[pos++].v; const v = unary(); return op === '-' ? -v : v;
    }
    const tk = tokens[pos++];
    if (!tk) throw new Error('unexpected end');
    if (tk.t === 'n') return tk.v;
    if (tk.t === 'p' && tk.v === '(') { const v = expr(); const c = tokens[pos++]; if (!c || c.v !== ')') throw new Error('missing )'); return v; }
    throw new Error('unexpected token');
  }
  const v = expr();
  if (pos !== tokens.length) throw new Error('trailing input');
  return v;
}
export function safeCalc(input) {
  const s = String(input).trim().slice(0, 120);
  if (!/^[\d\s+\-*/().%^×÷,]+$/.test(s)) throw new Error('not an arithmetic expression');
  if (!/\d/.test(s) || !/[+\-*/%^×÷]/.test(s)) throw new Error('not an arithmetic expression');
  const v = parseExpr(tokenizeExpr(s));
  if (!isFinite(v)) throw new Error('result is not finite');
  return Math.round(v * 1e10) / 1e10;
}

// ---------- demo knowledge base for web_search ----------
const DOCS = [
  { en: 'Main loop', es: 'Bucle principal',
    enT: 'The main loop is the heartbeat of every harness: send messages to the model, parse tool calls, execute them, append results, repeat until the model answers without tools or a stop condition fires.',
    esT: 'El bucle principal es el corazón de todo harness: envía mensajes al modelo, interpreta los tool calls, los ejecuta, añade los resultados y repite hasta que el modelo responde sin tools o se cumple una condición de parada.' },
  { en: 'Tool calling', es: 'Llamadas a herramientas',
    enT: 'Tool calling lets the model request structured actions via JSON. The harness describes each tool with a name, a description and a JSON Schema; the model replies with tool_calls the harness executes.',
    esT: 'Las llamadas a herramientas permiten al modelo pedir acciones estructuradas en JSON. El harness describe cada tool con nombre, descripción y JSON Schema; el modelo responde con tool_calls que el harness ejecuta.' },
  { en: 'MCP', es: 'MCP',
    enT: 'The Model Context Protocol (MCP) standardizes how harnesses discover tools: a Host runs Clients that speak JSON-RPC to Servers exposing Tools, Resources and Prompts over stdio or SSE.',
    esT: 'El Model Context Protocol (MCP) estandariza cómo los harnesses descubren herramientas: un Host ejecuta Clientes que hablan JSON-RPC con Servidores que exponen Tools, Resources y Prompts por stdio o SSE.' },
  { en: 'Memory', es: 'Memoria',
    enT: 'Harness memory has two tiers: short-term (the context window — messages, compaction, summaries) and long-term (vector stores, RAG, memory tools like memory_write). Forgetting on purpose is a feature.',
    esT: 'La memoria del harness tiene dos niveles: corto plazo (la ventana de contexto — mensajes, compactación, resúmenes) y largo plazo (vector stores, RAG, tools de memoria como memory_write). Olvidar a propósito es una funcionalidad.' },
  { en: 'Secondary loops', es: 'Bucles secundarios',
    enT: 'Secondary loops sit around the main loop: planning (plan → act → replan), reflection (verify and self-repair) and delegation (subagents, human approval gates). Add one only when the main loop hurts.',
    esT: 'Los bucles secundarios rodean al bucle principal: planificación (planificar → actuar → replanificar), reflexión (verificar y autorreparar) y delegación (subagentes, puertas de aprobación humana). Añade uno solo cuando el bucle principal duela.' },
  { en: 'Skills', es: 'Skills',
    enT: 'A skill is packaged behavior: a curated system prompt plus a bundle of tools, versioned and routed per task. Skills tell the model HOW to work; tools tell it WHAT it can touch.',
    esT: 'Una skill es comportamiento empaquetado: un system prompt curado más un paquete de tools, versionado y enrutado por tarea. Las skills dicen al modelo CÓMO trabajar; las tools, QUÉ puede tocar.' },
];

// ---------- intent routing (the "simulated model" brain) ----------
function findCalcs(text) {
  const out = [];
  const re = /(\d+(?:\s*[+\-*/^%×÷]\s*\d+(?:\s*[+\-*/^%×÷]\s*\d+)*))/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const expr = m[1].trim();
    if (/\d/.test(expr) && expr.length <= 60) {
      try { safeCalc(expr); out.push(expr); } catch { /* not valid arithmetic */ }
    }
  }
  return [...new Set(out)];
}

export function detectIntents(text) {
  const intents = [];
  for (const expr of findCalcs(text)) intents.push({ kind: 'calc', expr });
  let m;
  const rememberRe = /(remember|recuerda|recorda|guarda?|memoriza|apunta)[^.!\n]{0,6}(?:que|:)?\s*([^.!?\n]{3,160})/i;
  if ((m = text.match(rememberRe))) {
    const fact = m[2].trim();
    const kv = fact.match(/(?:my\s+)?([\wáéíóúñü ]{1,30}?)\s+(?:is|es|son)\s+(.+)/i);
    let value = kv ? kv[2].trim() : fact;
    value = value.split(/,?\s*then\b/i)[0].trim(); // "X is 4177, then tell me…" → "4177"
    intents.push({ kind: 'remember', key: kv ? kv[1].trim().toLowerCase() : 'fact', value });
  }
  if (/(what did i tell you|what do you remember|qué te (dije|he dicho)|qué recuerdas|do you remember|acuérdate)/i.test(text))
    intents.push({ kind: 'recall' });
  const noteRe = /(?:take a note|anota|nota):?\s*([^.!?\n]{3,200})/i;
  if ((m = text.match(noteRe)) && !rememberRe.test(text)) intents.push({ kind: 'note', text: m[1].trim() });
  const searchRe = /(?:search|busca|find|encuentra)(?:\s+(?:for|info(?:rmation)?(?:\s+on|\s+about)?|sobre|acerca\s+de))?\s+([^.!?\n]{2,80})/i;
  if ((m = text.match(searchRe))) intents.push({ kind: 'search', query: m[1].trim() });
  return intents;
}

// ---------- tool registry ----------
export function makeTools() {
  return {
    calculator: {
      description: 'Evaluates an arithmetic expression. Args: {expression}. Use for any math.',
      parameters: { type: 'object', properties: { expression: { type: 'string' } }, required: ['expression'] },
      run: async ({ expression }) => ({ expression, result: safeCalc(expression) }),
    },
    memory_write: {
      description: 'Stores a fact in long-term memory. Args: {key, value}.',
      parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key', 'value'] },
      run: async ({ key, value }, store) => { store.set('mem:' + key, value); return { stored: { key, value } }; },
    },
    memory_read: {
      description: 'Reads facts from long-term memory. Args: {key?} — omit key to list all.',
      parameters: { type: 'object', properties: { key: { type: 'string' } } },
      run: async ({ key }, store) => {
        if (key) { const v = store.get('mem:' + key); return v == null ? { key, value: null } : { key, value: v }; }
        const all = store.all().filter(([k]) => k.startsWith('mem:')).map(([k, v]) => ({ key: k.slice(4), value: v }));
        return { facts: all };
      },
    },
    notes_write: {
      description: 'Appends a timestamped note. Args: {text}.',
      parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      run: async ({ text }, store) => {
        const notes = JSON.parse(store.get('notes') || '[]');
        notes.push({ ts: new Date().toISOString(), text });
        store.set('notes', JSON.stringify(notes));
        return { saved: text, total: notes.length };
      },
    },
    web_search: {
      description: 'Searches the demo knowledge base about harness engineering. Args: {query}.',
      parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      run: async ({ query }, store, lang) => {
        const q = query.toLowerCase().split(/\s+/);
        const scored = DOCS.map((d) => {
          const hay = ((d.en + ' ' + d.enT + ' ' + d.es + ' ' + d.esT)).toLowerCase();
          const score = q.reduce((s, w) => s + (w.length > 2 && hay.includes(w) ? 1 : 0), 0);
          return { d, score };
        }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 2);
        const L = lang === 'es' ? 'es' : 'en';
        return { query, results: scored.map(({ d }) => ({ title: d[L], snippet: d[L + 'T'] })) };
      },
    },
  };
}

export function makeMemoryStore(persist) {
  const mem = new Map();
  if (persist) {
    try {
      const raw = persist.get();
      if (raw) for (const [k, v] of JSON.parse(raw)) mem.set(k, v);
    } catch {}
  }
  const save = () => { try { persist && persist.set(JSON.stringify([...mem])); } catch {} };
  return {
    get: (k) => (mem.has(k) ? mem.get(k) : null),
    set: (k, v) => { mem.set(k, v); save(); },
    all: () => [...mem],
    clear: () => { mem.clear(); save(); },
  };
}

// ---------- the simulated model ----------
export async function MODEL(messages, tools, ctx = {}) {
  const { lang = 'en', store } = ctx;
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const userText = lastUser ? lastUser.content : '';
  const alreadyCalled = [];
  for (const m of messages) for (const tc of (m.tool_calls || [])) alreadyCalled.push(tc.name + ':' + JSON.stringify(tc.args));

  const intents = detectIntents(userText);
  const pending = [];
  for (const it of intents) {
    if (it.kind === 'calc') {
      const sig = 'calculator:' + JSON.stringify({ expression: it.expr });
      if (!alreadyCalled.includes(sig)) pending.push({ name: 'calculator', args: { expression: it.expr } });
    } else if (it.kind === 'remember') {
      const sig = 'memory_write:' + JSON.stringify({ key: it.key, value: it.value });
      if (!alreadyCalled.includes(sig)) pending.push({ name: 'memory_write', args: { key: it.key, value: it.value } });
    } else if (it.kind === 'recall') {
      if (!alreadyCalled.some((s) => s.startsWith('memory_read:'))) pending.push({ name: 'memory_read', args: {} });
    } else if (it.kind === 'note') {
      const sig = 'notes_write:' + JSON.stringify({ text: it.text });
      if (!alreadyCalled.includes(sig)) pending.push({ name: 'notes_write', args: { text: it.text } });
    } else if (it.kind === 'search') {
      const sig = 'web_search:' + JSON.stringify({ query: it.query });
      if (!alreadyCalled.includes(sig)) pending.push({ name: 'web_search', args: { query: it.query } });
    }
  }
  // tiny latency so the trace feels alive
  await new Promise((r) => setTimeout(r, 260));

  const inTok = estimateTokens(JSON.stringify(messages)) + estimateTokens(JSON.stringify(tools));
  if (pending.length > 0) {
    return { toolCalls: pending, inTokens: inTok, outTokens: estimateTokens(JSON.stringify(pending)) };
  }
  const content = finalAnswer(messages, lang, store);
  return { content, inTokens: inTok, outTokens: estimateTokens(content) };
}

function toolResultsOf(messages) {
  const out = [];
  for (const m of messages) if (m.role === 'tool') out.push({ name: m.name, data: JSON.parse(m.content) });
  return out;
}

function finalAnswer(messages, lang, store) {
  const L = lang === 'es' ? 'es' : 'en';
  const results = toolResultsOf(messages);
  const T = {
    en: {
      calc: (e, r) => `${e} = **${r}**`,
      remembered: (k, v) => `Got it — I'll remember that **${k}** is **${v}**.`,
      recallSome: (facts) => `Here's what I remember:\n${facts.map((f) => `• **${f.key}**: ${f.value}`).join('\n')}`,
      recallNone: `My memory is empty right now. Tell me something with "remember …" and I'll keep it.`,
      noted: (t, n) => `Noted: "${t}" (note #${n}).`,
      search: (q, rs) => rs.length ? `Top results for "${q}":\n${rs.map((r) => `• **${r.title}** — ${r.snippet}`).join('\n')}` : `No demo docs matched "${q}". Try "main loop", "MCP", "memory", "tools" or "skills".`,
      fallback: `I'm a simulated model inside a teaching harness, so I only act through tools here: ask me to **calculate** something, **remember** a fact, **recall** what I know, take a **note**, or **search** the demo docs.`,
      simTag: '\n\n_(Simulated model — in production this answer is generated by the LLM.)_',
    },
    es: {
      calc: (e, r) => `${e} = **${r}**`,
      remembered: (k, v) => `Entendido — recordaré que **${k}** es **${v}**.`,
      recallSome: (facts) => `Esto es lo que recuerdo:\n${facts.map((f) => `• **${f.key}**: ${f.value}`).join('\n')}`,
      recallNone: `Mi memoria está vacía ahora mismo. Dime algo con «recuerda …» y lo guardaré.`,
      noted: (t, n) => `Anotado: «${t}» (nota n.º ${n}).`,
      search: (q, rs) => rs.length ? `Mejores resultados para «${q}»:\n${rs.map((r) => `• **${r.title}** — ${r.snippet}`).join('\n')}` : `Ningún documento demo coincide con «${q}». Prueba con «main loop», «MCP», «memory», «tools» o «skills».`,
      fallback: `Soy un modelo simulado dentro de un harness didáctico, así que aquí solo actúo mediante tools: pídeme **calcular** algo, **recordar** un dato, **recuperar** lo que sé, tomar una **nota** o **buscar** en la documentación demo.`,
      simTag: '\n\n_(Modelo simulado — en producción esta respuesta la genera el LLM.)_',
    },
  }[L];
  if (results.length === 0) return T.fallback + T.simTag;
  const parts = [];
  for (const { name, data } of results) {
    if (name === 'calculator') parts.push(T.calc(data.expression, data.result));
    else if (name === 'memory_write') parts.push(T.remembered(data.stored.key, data.stored.value));
    else if (name === 'memory_read') parts.push(data.facts.length ? T.recallSome(data.facts) : T.recallNone);
    else if (name === 'notes_write') parts.push(T.noted(data.saved, data.total));
    else if (name === 'web_search') parts.push(T.search(data.query, data.results));
  }
  return parts.join('\n\n') + T.simTag;
}

// ---------- the canonical main loop (the one learners study) ----------
export async function runHarness(userText, { emit = () => {}, store, lang = 'en', maxIters = 6 } = {}) {
  const TOOLS = makeTools();
  const messages = [{ role: 'user', content: userText }];
  let totalIn = 0, totalOut = 0;
  emit({ type: 'start', text: userText });
  for (let i = 1; i <= maxIters; i++) {
    emit({ type: 'turn', i });
    const res = await MODEL(messages, TOOLS, { lang, store });
    totalIn += res.inTokens || 0; totalOut += res.outTokens || 0;
    emit({ type: 'model', inTokens: res.inTokens, outTokens: res.outTokens, toolCalls: (res.toolCalls || []).length });
    if (res.toolCalls && res.toolCalls.length > 0) {
      for (const tc of res.toolCalls) {
        emit({ type: 'tool_call', name: tc.name, args: tc.args });
        let out;
        try {
          out = await TOOLS[tc.name].run(tc.args, store, lang);
          emit({ type: 'tool_result', name: tc.name, ok: true, out: JSON.stringify(out).slice(0, 300) });
        } catch (err) {
          out = { error: String(err.message || err) };
          emit({ type: 'tool_result', name: tc.name, ok: false, out: out.error });
        }
        messages.push({ role: 'assistant', content: '', tool_calls: [tc] });
        messages.push({ role: 'tool', name: tc.name, content: JSON.stringify(out) });
      }
    } else {
      emit({ type: 'done', answer: res.content, iterations: i, inTokens: totalIn, outTokens: totalOut });
      return res.content;
    }
  }
  const forced = lang === 'es'
    ? 'Alcancé el máximo de iteraciones sin una respuesta final. Sube `maxIters` o añade una condición de parada mejor.'
    : 'Hit max iterations without a final answer. Raise `maxIters` or add a better stop condition.';
  emit({ type: 'done', answer: forced, iterations: maxIters, inTokens: totalIn, outTokens: totalOut, forced: true });
  return forced;
}
