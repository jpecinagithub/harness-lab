# HARNESS LAB — Project definition

**LLM Harness Engineering Academy** · Bilingual EN/ES · Vite + React · No backend

## 1. What this is

A training portal that teaches **Harness Engineering**: the discipline of designing
and building the software *harness* (arnés) around a large language model. The LLM
is the engine; the harness is everything else — the code that turns a chat
endpoint into a reliable, observable, tool-using system.

The portal mirrors the structure and design language of the AI Fundamentals
Academy (sidebar course layout, module pages with rich content + quizzes, practice
tests, mistake review, glossary, final exam, progress in localStorage) but every
line of code, copy and branding is original.

## 2. Pedagogical arc

The course answers one question per level, in dependency order:

| Level | Question it answers |
|-------|---------------------|
| 1 · Foundations | What *is* a harness, and why isn't the raw model enough? |
| 2 · The Main Loop | How does the core `messages → model → tools → repeat` loop work, in real code? |
| 3 · Secondary Loops | When is one loop not enough? (planning, reflection, delegation, human-in-the-loop) |
| 4 · Memory | How do you give the model a past? (context budgets, compaction, vector memory, forgetting) |
| 5 · Tools, Skills & MCP | How do you give the model hands? (tool design, skill packaging, MCP servers) |
| 6 · Ship It | Where does the harness *live*? (browser demo, desktop file, CLI — the same harness, three shells) |

Each module goes deep: mechanics, trade-offs, failure modes, real numbers
(token budgets, iteration caps, latency). Quizzes check understanding; they are
not the point.

## 3. Signature interactive pieces

1. **Loop stepper** — an animated trace of one user message through the canonical
   agent loop (parallel tool calls included).
2. **JS Sandbox** — the learner edits a *real* harness loop in JavaScript and runs
   it against a simulated model with a visible execution trace. Presets: main loop,
   memory-augmented loop, planner (secondary loop). Guarded execution (20 s cap,
   30 model-call cap).
3. **Memory playground** — a context-window budget bar; fill it, then compact it
   (truncate vs summarize) and feel the trade-off.
4. **Tool designer** — write name + description + JSON Schema; see exactly what the
   harness sends the model and simulate a model call.
5. **MCP explorer** — Host → Client → Server diagram, primitive browsers
   (Tools/Resources/Prompts) and a playable JSON-RPC handshake.
6. **Harness Lab** — a working harness in the browser: chat UI running the real
   main loop with calculator, persistent memory, notes and a demo search index,
   with a per-answer "how the harness worked" trace.

## 4. The three deployable harnesses

All three share the **identical main loop and tool set** (calculator, memory,
notes, search) — learn once, run anywhere:

- **Browser** — the live demo inside the portal (`/lab`).
- **Desktop** — `public/downloads/harness-desktop.html`: one self-contained file,
  double-click to run offline, memory in localStorage.
- **CLI** — `public/downloads/harness-cli.mjs`: Node 18+, zero dependencies.
  `--mock` runs with the simulated model (no key); otherwise it drives any
  OpenAI-compatible API via `HARNESS_API_KEY`.

Honest limits, stated in the UI: the browser/desktop demos use a scripted
simulated model so the mechanics are visible at zero cost. Only the CLI with a
real key is a genuine production-style harness.

## 5. Stack & conventions

- Vite 6 + React 18 + react-router-dom + lucide-react. No backend; localStorage
  keys: `hl:v1` (progress), `hl-lang`, `hl-theme`, `hl-lab-mem`.
- Bilingual EN/ES with visible EN/ES toggle (EN default); content files carry
  both languages side by side (`src/data/modules/mNN.js`).
- Zero runtime network requests (no webfonts, no analytics) — the portal itself
  demonstrates the "runs anywhere" ethos.
- Dark-first "workshop blueprint" theme (signal orange `#ff7a1a` + circuit teal),
  light mode toggle.
- `vercel.json` SPA rewrite; the maintainer deploys via GitHub → Vercel
  (the agent never touches Vercel).

## 6. Content contract

`CONTENT_BRIEF.md` is the source of truth for writers: exact module schema,
24-module outline, quiz rules (8/module, balanced answer indices, explanations),
glossary (40 terms), and a validation checklist the coordinator must run.

## 7. Verification bar

- `node --check` on every content file + a schema validator (sections, quiz
  shape, answer distribution, no placeholders).
- `npm run build` clean.
- Headless-browser smoke test of key routes with zero app console errors.
- The CLI download is executed for real (`--mock`) before shipping.
