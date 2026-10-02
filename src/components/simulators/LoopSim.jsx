import React, { useState } from 'react';
import { Play, Pause, StepForward, StepBack, RotateCcw } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext.jsx';

const STR = {
  en: {
    title: 'Main loop — step by step',
    sub: 'Watch one user message travel through the canonical agent loop. Step manually or autoplay.',
    steps: [
      { phase: 'turn 1 · user', text: 'The user message is appended to messages[]. Nothing else exists yet — the loop always starts from the conversation history.' },
      { phase: 'turn 1 · model', text: 'MODEL(messages, tools) is called. The model sees the tool schemas and decides it needs two actions: memory_write (parallel-safe) and calculator. It returns tool_calls — not an answer.' },
      { phase: 'turn 1 · tools', text: 'The harness executes each tool call: memory_write stores code=4177, calculator returns 96. Results are appended as tool messages. The model never touches the outside world directly.' },
      { phase: 'turn 2 · model', text: 'The loop calls the model again with the enriched history. All intents are satisfied, so this time it returns a final text answer — no tool calls. That is the stop condition.' },
      { phase: 'done', text: 'Answer delivered to the user. Total: 2 iterations, ~5 model-relevant events. Every production harness — yours included — is this loop plus policies.' },
    ],
    userMsg: 'Remember that the launch code is 4177, then tell me what 12 * 8 is',
    answer: 'Got it — I\'ll remember that launch code is 4177.\n\n12 * 8 = 96',
    next: 'Next', prev: 'Back', auto: 'Autoplay', reset: 'Reset',
    stages: ['user message', 'model call', 'tool execution', 'model call', 'final answer'],
  },
  es: {
    title: 'Bucle principal — paso a paso',
    sub: 'Observa cómo un mensaje del usuario viaja por el bucle agente canónico. Avanza manualmente o en automático.',
    steps: [
      { phase: 'turno 1 · usuario', text: 'El mensaje del usuario se añade a messages[]. Aún no existe nada más — el bucle siempre parte del historial de conversación.' },
      { phase: 'turno 1 · modelo', text: 'Se llama a MODEL(messages, tools). El modelo ve los schemas de las tools y decide que necesita dos acciones: memory_write (seguras en paralelo) y calculator. Devuelve tool_calls — no una respuesta.' },
      { phase: 'turno 1 · tools', text: 'El harness ejecuta cada tool call: memory_write guarda code=4177, calculator devuelve 96. Los resultados se añaden como mensajes tool. El modelo nunca toca el mundo exterior directamente.' },
      { phase: 'turno 2 · modelo', text: 'El bucle vuelve a llamar al modelo con el historial enriquecido. Todas las intenciones están satisfechas, así que esta vez devuelve una respuesta final en texto — sin tool calls. Esa es la condición de parada.' },
      { phase: 'fin', text: 'Respuesta entregada al usuario. Total: 2 iteraciones, ~5 eventos relevantes. Todo harness de producción — incluido el tuyo — es este bucle más políticas.' },
    ],
    userMsg: 'Recuerda que el código de lanzamiento es 4177 y dime cuánto es 12 * 8',
    answer: 'Entendido — recordaré que el código de lanzamiento es 4177.\n\n12 * 8 = 96',
    next: 'Siguiente', prev: 'Atrás', auto: 'Automático', reset: 'Reiniciar',
    stages: ['mensaje usuario', 'llamada modelo', 'ejecución tools', 'llamada modelo', 'respuesta final'],
  },
};

const LOG = [
  { cls: 't-turn', en: '▶ turn 1 — messages[] has 1 message (user)', es: '▶ turno 1 — messages[] tiene 1 mensaje (user)' },
  { cls: 't-model', en: '◈ model call → tool_calls: [memory_write, calculator] (parallel)', es: '◈ llamada al modelo → tool_calls: [memory_write, calculator] (en paralelo)' },
  { cls: 't-tool', en: '⚙ memory_write {key:"launch code", value:"4177"} → ok', es: '⚙ memory_write {key:"launch code", value:"4177"} → ok' },
  { cls: 't-tool', en: '⚙ calculator {expression:"12 * 8"} → 96', es: '⚙ calculator {expression:"12 * 8"} → 96' },
  { cls: 't-model', en: '◈ model call → no tool calls → final answer', es: '◈ llamada al modelo → sin tool calls → respuesta final' },
  { cls: 't-ok', en: '✔ done in 2 iterations · ~1.2k tokens (est.)', es: '✔ fin en 2 iteraciones · ~1,2k tokens (est.)' },
];

export default function LoopSim() {
  const { lang } = useLang();
  const S = STR[lang];
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const timer = React.useRef(null);

  const go = (n) => setStep(Math.max(0, Math.min(S.steps.length - 1, n)));
  React.useEffect(() => {
    if (auto) {
      if (step >= S.steps.length - 1) { setAuto(false); return; }
      timer.current = setTimeout(() => go(step + 1), 2200);
    }
    return () => clearTimeout(timer.current);
  }, [auto, step]);

  const stageIdx = [0, 1, 2, 3, 4][step];
  const linesFor = (s) => LOG.slice(0, [1, 2, 4, 5, 6][s]);

  return (
    <div className="sim-frame">
      <div className="sim-head"><Play size={16} style={{ color: 'var(--accent-text)' }} /> {S.title}</div>
      <div className="sim-body">
        <p className="muted" style={{ marginTop: 0 }}>{S.sub}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {S.stages.map((st, i) => (
            <div key={i} className="chip" style={{
              background: i === stageIdx ? 'var(--accent)' : i < stageIdx ? 'var(--teal-soft)' : 'var(--surface-2)',
              color: i === stageIdx ? '#fff' : i < stageIdx ? 'var(--teal)' : 'var(--faint)',
            }}>{i + 1} · {st}</div>
          ))}
        </div>
        <div className="card" style={{ marginBottom: 16, boxShadow: 'none' }}>
          <div className="chip" style={{ marginBottom: 10 }}>{S.steps[step].phase}</div>
          <p style={{ margin: 0 }}>{S.steps[step].text}</p>
        </div>
        {step === 0 && (
          <div className="msg user" style={{ maxWidth: '100%', marginBottom: 16 }}>{S.userMsg}</div>
        )}
        {step === 4 && (
          <div className="msg agent" style={{ maxWidth: '100%', marginBottom: 16, whiteSpace: 'pre-line' }}>{S.answer}</div>
        )}
        <div className="trace" style={{ marginBottom: 16 }}>
          {linesFor(step).map((l, i) => <div key={i} className="trace-line"><span className={l.cls}>{l[lang]}</span></div>)}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => go(step - 1)} disabled={step === 0}><StepBack size={14} /> {S.prev}</button>
          <button className="btn btn-sm btn-primary" onClick={() => go(step + 1)} disabled={step === S.steps.length - 1}><StepForward size={14} /> {S.next}</button>
          <button className="btn btn-sm" onClick={() => { setAuto(!auto); if (!auto && step >= S.steps.length - 1) go(0); }}>
            {auto ? <Pause size={14} /> : <Play size={14} />} {S.auto}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => { setAuto(false); go(0); }}><RotateCcw size={14} /> {S.reset}</button>
        </div>
      </div>
    </div>
  );
}
