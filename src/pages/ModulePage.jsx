import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Target, ListChecks } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useProgress } from '../hooks/ProgressContext.jsx';
import { byId, MODULES } from '../data/modules/index.js';
import { LEVELS } from '../data/levels.js';
import RichText from '../components/RichText.jsx';
import Quiz, { QuizResults } from '../components/Quiz.jsx';
import LoopSim from '../components/simulators/LoopSim.jsx';
import Sandbox from '../components/simulators/Sandbox.jsx';
import MemorySim from '../components/simulators/MemorySim.jsx';
import ToolsSim from '../components/simulators/ToolsSim.jsx';
import McpSim from '../components/simulators/McpSim.jsx';
import { modIcon } from './Course.jsx';

const SIMS = { loop: LoopSim, sandbox: Sandbox, memory: MemorySim, tools: ToolsSim, mcp: McpSim };

export default function ModulePage() {
  const { id } = useParams();
  const { t, lang } = useLang();
  const { state } = useProgress();
  const navigate = useNavigate();
  const mod = byId(id);
  const [quizOn, setQuizOn] = useState(false);
  const [result, setResult] = useState(null);

  React.useEffect(() => { setQuizOn(false); setResult(null); window.scrollTo(0, 0); }, [id]);
  if (!mod) return <div className="empty">404</div>;

  const c = mod[lang];
  const Sim = mod.sim ? SIMS[mod.sim] : null;
  const simSlot = Sim ? (
    <div>
      <div className="callout key"><div className="callout-title">⚙ {t('module.trySim')}</div><p>{t('module.simHint')}</p></div>
      <Sim />
    </div>
  ) : null;
  const rec = state.modules[mod.id];
  const idx = MODULES.findIndex((m) => m.id === id);
  const next = MODULES[idx + 1];
  const level = LEVELS.find((l) => l.n === mod.level);

  return (
    <div>
      <Link to="/course" className="btn btn-sm btn-ghost" style={{ marginBottom: 18 }}>
        <ArrowLeft size={14} /> {t('module.back')}
      </Link>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 8 }}>
        <div style={{ width: 54, height: 54, borderRadius: 14, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-text)', flexShrink: 0 }}>
          {modIcon(mod.icon, 26)}
        </div>
        <div>
          <div className="chip" style={{ marginBottom: 6 }}>{level[lang].title} · {mod.id.toUpperCase()}</div>
          <h1 className="section-title" style={{ margin: 0 }}>{c.title}</h1>
        </div>
      </div>
      <p className="section-sub">{c.tagline}</p>

      <h3 style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 16 }}><Target size={17} style={{ color: 'var(--teal)' }} /> {t('module.objectives')}</h3>
      <div className="objectives">
        {c.objectives.map((o, i) => (
          <div key={i} className="objective"><span className="num">{i + 1}</span><span>{o}</span></div>
        ))}
      </div>

      <hr className="hr" />
      <RichText sections={c.sections} simSlot={simSlot} />

      <div className="takeaways">
        <h3><ListChecks size={16} style={{ verticalAlign: -3, marginRight: 6 }} />{t('module.takeaways')}</h3>
        <ul style={{ margin: 0, paddingLeft: 20 }}>{c.takeaways.map((k, i) => <li key={i}>{k}</li>)}</ul>
      </div>

      <hr className="hr" />
      <h2 style={{ fontSize: 22 }}>{t('module.quizTitle')}</h2>
      <p className="muted">{t('module.quizSub')}{rec ? ` · ${t('module.yourBest')}: ${rec.best}/8` : ''}</p>
      {!quizOn && !result && (
        <button className="btn btn-primary" onClick={() => setQuizOn(true)}>
          {rec ? t('module.retake') : t('module.startQuiz')} <ArrowRight size={16} />
        </button>
      )}
      {quizOn && !result && (
        <Quiz moduleId={mod.id} questions={c.quiz}
          onDone={(score, total, mistakes) => { setResult({ score, total, mistakes }); setQuizOn(false); window.scrollTo(0, document.body.scrollHeight); }} />
      )}
      {result && (
        <QuizResults score={result.score} total={result.total}
          onRetake={() => { setResult(null); setQuizOn(true); }}
          onBack={next ? () => navigate(`/module/${next.id}`) : null} />
      )}
      {result && next && (
        <Link to={`/module/${next.id}`} className="btn btn-primary" style={{ marginTop: 16 }}>
          {t('module.next')}: {next[lang].title} <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
