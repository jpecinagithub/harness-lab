# HARNESS LAB — Content brief (contract for writers)

Portal: **HARNESS LAB · LLM Harness Engineering Academy**. Bilingual EN/ES training portal
(Vite + React, same shape as AI Fundamentals Academy). Topic: **Harness Engineering** —
how to design and build the software "harness" (el arnés) around an LLM: the main loop,
secondary loops, memory, tools, skills and MCP, ending with a real deployable harness
(browser demo + desktop single-file + CLI).

## Output location
One file per module: `~/workspace/harness-lab/src/data/modules/mNN.js` (m01 … m24),
each a JS module with `export default {...}`. Plus ONE glossary file:
`~/workspace/harness-lab/src/data/glossary.js` exporting a default array.

## Module schema (exact — the app parses this)

```js
export default {
  id: "m05",            // "m01".."m24"
  level: 2,             // 1..6
  n: 2,                 // 1..4, position inside the level
  icon: "Repeat",       // any lucide-react icon name (PascalCase)
  sim: "loop",          // null or one of: "loop" | "sandbox" | "memory" | "tools" | "mcp"
  en: { /* ModuleLang */ },
  es: { /* ModuleLang, same shape, professional European Spanish */ },
};
// ModuleLang:
{
  title: "The Agent Loop, Step by Step",
  tagline: "One sentence hook for the module.",
  objectives: ["3 concrete learning objectives, learner can…", "...", "..."],
  sections: [
    { kind: "text", heading: "…", body: "Paragraph one.\n\nParagraph two with `inline code` and **bold**." },
    { kind: "code", heading: "…", lang: "javascript", code: "…real JS…", note: "Optional 1-line note under the block." },
    { kind: "callout", tone: "key", title: "…", body: "…" },   // tone: key | tip | warn
    { kind: "compare", heading: "…", headers: ["A", "B"], rows: [["…","…"],["…","…"]] },
    { kind: "checklist", heading: "…", items: ["…","…","…","…"] },
  ],
  takeaways: ["4 crisp takeaways, 1 line each", "…", "…", "…"],
  quiz: [
    { q: "…", options: ["…","…","…","…"], answer: 2, why: "1–2 sentences explaining the correct answer." },
    // … exactly 8
  ],
}
```

## Hard rules
- **4–6 sections** per module. Every module has ≥1 `text` and ≥1 `code` (code may be
  shorter conceptual snippets in L1; L2/L5/L6 modules need ≥2 code sections with real,
  runnable-concept JavaScript — no pseudocode with `...`, max ~45 lines per block).
- **Depth over quizzes.** Each module ≈ 1200–1800 words per language. Explain the *how*:
  concrete mechanics, trade-offs, failure modes, numbers (token budgets, iteration caps,
  latency). The user explicitly wants deep engineering content, not just test prep.
- **Quiz: exactly 8 questions.** Options must be plausible (no joke distractors).
  `answer` distribution per module: each index 0–3 used **at least once**; across the
  4 modules of a level the 32 answers must be roughly even (±3). `why` always present.
- **Spanish**: professional European Spanish (vosotros avoided; use neutral/usted-neutral
  imperative-free phrasing). Keep the English term **"harness"** in Spanish text too
  (it is the technical term; gloss it on first use per module: *harness* (arnés)).
  Keep `loop`, `tool call`, `MCP`, `prompt` in English with brief gloss where needed.
- **Code in both languages is identical** (code is language-neutral); only `heading`
  and `note` are translated. Comments inside code: English (code convention).
- No placeholders, no lorem, no "TODO". No emojis in content (UI handles icons).
- The featured `sim` renders after the 2nd section — write the surrounding text so it
  references the interactive ("try it below").

## Module outline (follow exactly; titles may be polished but keep meaning)

### L1 · Foundations — "The harness around the model"
- m01 What a Harness Really Is — LLM as engine, harness as chassis; what code does
  around the model; the request/response boundary; why raw chat is not a product.
- m02 Anatomy of a Harness — the 7 parts: main loop, tool registry, memory store,
  system prompt/skills, policies & guardrails, I/O & streaming, observability.
  Include a `compare` (harness part → responsibility → fails if missing).
- m03 Harness vs Agent vs Framework — crisp definitions; when "agent" applies;
  frameworks (LangChain/LangGraph/AutoGen) vs hand-rolled harness; build-vs-buy guide.
- m04 Your First Mental Model — the "REPL with tools" model; messages[] as the core
  data structure; tokens & cost awareness from day one (with numbers).

### L2 · The Main Loop — "One loop to run them all" (sim: m05→loop, m06→sandbox, m07→tools)
- m05 The Agent Loop, Step by Step — messages → model call → tool_calls → execute →
  append results → repeat → final answer; termination conditions; the loop as a
  state machine. Include `code` with the canonical ~25-line loop.
- m06 Building the Loop in JavaScript — full walkthrough: async/await, the tools
  registry object, dispatch, error handling per tool, maxIterations guard, logging
  each turn. Code must be complete and coherent (a learner can paste it in the sandbox).
- m07 Tool-Calling Mechanics — how models emit tool calls (function calling vs
  ReAct text parsing); JSON Schema anatomy; parallel tool calls; handling malformed
  arguments; strict mode.
- m08 Termination, Streaming & Control — max iterations vs "done" signals; stop
  sequences; streaming tokens to UI while the loop runs; timeouts & cancellation;
  idempotency of tool execution.

### L3 · Secondary Loops — "Loops inside loops" (no sim; use callouts/compares)
- m09 Do You Need a Second Loop? — decision framework; complexity budget; the rule
  "one loop until it hurts"; symptoms that demand another loop.
- m10 The Planning Loop — plan → act → observe → replan; plan-and-execute pattern;
  when the planner is a separate model call; keeping plans in memory.
- m11 Reflection & Self-Critique — verify loops; the critic pattern; self-repairing
  code (run → error → fix); limits (loops that never converge).
- m12 Delegation & Human-in-the-Loop — subagents: spawn, fan-out/fan-in, result
  synthesis; approval gates; when to ask the human; escalation policies.

### L4 · Memory — "Giving the model a past" (sim: m13→memory, m15→memory)
- m13 The Context Window as Working Memory — budgets in tokens (with real numbers:
  128k/200k/1M windows); what fills the window; counting tokens in JS; the
  "context rot" problem.
- m14 Short-Term Memory: Compaction — truncation strategies; rolling summaries;
  summarizer model calls; what to keep verbatim (tool schemas, user goal).
- m15 Long-Term Memory — embeddings & vector stores; RAG as memory; episodic vs
  semantic vs procedural memory; memory as tools (`memory_write`/`memory_search`).
- m16 Forgetting on Purpose — decay & relevance scoring; privacy & deletion;
  memory hygiene; when memory hurts (stale facts, prompt injection via memory).

### L5 · Tools, Skills & MCP — "Hands for the model" (sim: m17→tools, m19→mcp, m20→mcp)
- m17 Designing Great Tools — naming & descriptions (the model reads them!);
  JSON Schema design; granularity (few powerful vs many small); error messages as
  feedback; dangerous tools & confirmation gates.
- m18 Skills: Packaged Behavior — skills as curated system prompts + tools bundles;
  SKILL.md-style packaging; routing: which skill is active; versioning skills.
- m19 MCP from Zero — Model Context Protocol architecture: Host → Client → Server;
  primitives: Tools, Resources, Prompts; the JSON-RPC flow; MCP vs plain function
  calling (when MCP wins).
- m20 Building an MCP Server — JS SDK walkthrough: defining a server, exposing
  tools/resources, stdio vs SSE transport, connecting your harness as a client.
  Code: a minimal but real MCP server skeleton.

### L6 · Ship It — "From laptop to the world" (sim: m21→sandbox)
- m21 The Browser Harness — architecture of an in-browser harness (this portal's
  live demo): what runs client-side, the mock-model pattern for teaching,
  swapping the mock for a real API; honest limits.
- m22 The Desktop Harness — the single-file downloadable harness: how one HTML
  file holds loop + tools + memory (localStorage); extending it with your own tools.
- m23 The CLI Harness — Node script anatomy; wiring a real API key (OpenAI-compatible
  endpoint); `--mock` mode for zero-key practice; the exact same loop, third shell.
- m24 Production Hardening — trace logging; cost & latency guards; safety
  (destructive tools, prompt injection); evals for harnesses; your 30-day roadmap
  from learner to builder.

## Glossary file
`~/workspace/harness-lab/src/data/glossary.js`:
```js
export default [
  { term: "Harness", en: "1–2 sentence definition.", es: "Definición en español." },
  // … 40 terms
];
```
Terms must include: harness, main loop, tool call, function calling, ReAct,
system prompt, context window, token, JSON Schema, MCP, MCP server, MCP client,
MCP host, resource (MCP), skill, subagent, planning loop, reflection loop,
human-in-the-loop, short-term memory, long-term memory, embeddings, vector store,
RAG, compaction, summarization, streaming, stop sequence, max iterations,
idempotency, fan-out/fan-in, approval gate, prompt injection, observability,
trace, temperature, tool registry, parallel tool calls, transport (stdio/SSE),
one-shot vs agentic. (40 total — add a few more if natural.)

## Validation checklist (run before finishing)
- [ ] 24 files m01–m24 exist, valid JS, `export default` parses (node --check).
- [ ] Every module: en+es, 4–6 sections, ≥1 code, 3 objectives, 4 takeaways, 8 quiz.
- [ ] Quiz answers: per-module each index 0–3 ≥1; per-level counts even ±3.
- [ ] No empty strings, no "TODO"/"lorem", code blocks non-trivial.
- [ ] Glossary: 40 terms, en+es definitions non-empty.
- [ ] Spanish reads as professional European Spanish; term "harness" kept in English.
