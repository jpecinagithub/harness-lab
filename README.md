# HARNESS LAB — LLM Harness Engineering Academy

Bilingual (EN/ES) training portal on **Harness Engineering**: how to design and
build the software *harness* around a large language model — the main loop,
secondary loops, memory, tools, skills and MCP — ending with a real harness you
can run in your browser, install on your desktop, or use from your terminal.

Same stack and structure as the AI Fundamentals Academy: **Vite + React**,
no backend, everything in `localStorage`.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # → dist/
```

## Deploy

Push to GitHub; connect the repo to Vercel (SPA rewrite is in `vercel.json`).
The maintainer handles Vercel — this repo only needs pushes to `main`.

## Project layout

```
src/
  harness/mockEngine.js      # shared harness engine: simulated model + real tools
                             # (calculator, memory, notes, demo search) + canonical loop
  data/modules/m01..m24.js   # 24 bilingual modules (EN/ES side by side)
  data/glossary.js           # 40-term bilingual glossary
  data/levels.js             # level metadata
  components/
    simulators/              # LoopSim, Sandbox (JS), MemorySim, ToolsSim, McpSim
    HarnessDemo.jsx          # live browser harness (chat + trace)
    Downloads.jsx            # desktop/CLI download cards
    RichText.jsx Quiz.jsx
  pages/                     # Dashboard, Course, ModulePage, Tests, Review,
                             # Glossary, Sandbox, Lab, FinalExam, Progress
  i18n/strings.js            # UI strings EN/ES
  hooks/ProgressContext.jsx  # localStorage progress (hl:v1)
public/downloads/
  harness-desktop.html       # single-file offline harness (double-click to run)
  harness-cli.mjs            # Node CLI harness (--mock or real API via HARNESS_API_KEY)
```

## Content contract

`CONTENT_BRIEF.md` defines the module schema, the 24-module outline, quiz rules
and the validation checklist. Validate content with:

```bash
node validate-content.mjs
```

## The three harnesses

Browser demo, desktop file and CLI share the **identical main loop and tool set**.
The browser/desktop demos use a scripted simulated model (zero cost, mechanics
visible); the CLI accepts a real API key (`HARNESS_API_KEY`, any OpenAI-compatible
endpoint) and then behaves as a genuine production-style harness.
