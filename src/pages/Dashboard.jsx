import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Repeat, Layers, Brain, Wrench, Rocket, TerminalSquare, FlaskConical, CircleHelp } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useProgress } from '../hooks/ProgressContext.jsx';
import { LEVELS } from '../data/levels.js';
import { MODULES } from '../data/modules/index.js';

const LEVEL_ICONS = { Boxes, Repeat, Layers, Brain, Wrench, Rocket };

function levelProgress(levelN, modules) {
  const done = MODULES.filter((m) => m.level === levelN && modules[m.id]?.passed).length;
  return { done, total: MODULES.filter((m) => m.level === levelN).length };
}

export default function Dashboard() {
  const { t, lang } = useLang();
  const { state } = useProgress();
  const totalQ = MODULES.reduce((s, m) => s + m[lang].quiz.length, 0);
  const firstTodo = MODULES.find((m) => !state.modules[m.id]?.passed);

  return (
    <div>
      <div className="hero">
        <span className="chip">{t('dash.badge')}</span>
        <h1 style={{ marginTop: 14 }} dangerouslySetInnerHTML={{ __html: t('dash.title').replace('<hl>', '<span class="hl">').replace('</hl>', '</span>') }} />
        <p>{t('dash.sub')}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to={firstTodo ? `/module/${firstTodo.id}` : '/course'}>{t('dash.start')} <ArrowRight size={16} /></Link>
          <Link className="btn" to="/lab">{t('dash.openLab')}</Link>
          <Link className="btn" to="/sandbox">{t('dash.openSandbox')}</Link>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat"><div className="v">{MODULES.length}</div><div className="l">{t('dash.stats.modules')}</div></div>
        <div className="stat"><div className="v">{totalQ}</div><div className="l">{t('dash.stats.questions')}</div></div>
        <div className="stat"><div className="v">5</div><div className="l">{t('dash.stats.sims')}</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--gold)' }}>{state.xp}</div><div className="l">{t('dash.stats.xp')}</div></div>
      </div>

      <h2 className="section-title" style={{ fontSize: 22 }}>{t('dash.pathTitle')}</h2>
      <p className="section-sub">{t('dash.pathSub')}</p>
      <div className="grid-3" style={{ marginBottom: 34 }}>
        {LEVELS.map((lv) => {
          const Icon = LEVEL_ICONS[lv.icon] || Boxes;
          const { done, total } = levelProgress(lv.n, state.modules);
          return (
            <Link key={lv.n} className="level-card" to={`/course#level-${lv.n}`}>
              <Icon size={26} style={{ color: 'var(--accent-text)' }} />
              <h3>{lv.n}. {lv[lang].title}</h3>
              <p>{lv[lang].tagline} · {total} {t('dash.modulesWord')}</p>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${(done / total) * 100}%` }} /></div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{done}/{total}</div>
            </Link>
          );
        })}
      </div>

      <h2 className="section-title" style={{ fontSize: 22 }}>{t('dash.howTitle')}</h2>
      <div className="grid-3">
        {[
          { icon: Boxes, t: t('dash.how1t'), d: t('dash.how1d') },
          { icon: TerminalSquare, t: t('dash.how2t'), d: t('dash.how2d') },
          { icon: FlaskConical, t: t('dash.how3t'), d: t('dash.how3d') },
        ].map((c, i) => (
          <div key={i} className="card" style={{ boxShadow: 'none' }}>
            <c.icon size={24} style={{ color: 'var(--teal)', marginBottom: 10 }} />
            <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>{c.t}</h3>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>{c.d}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 26, display: 'flex', gap: 16, alignItems: 'center', boxShadow: 'none' }}>
        <CircleHelp size={30} style={{ color: 'var(--accent-text)', flexShrink: 0 }} />
        <div>
          <h3 style={{ margin: '0 0 4px' }}>{t('dash.continue')}</h3>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>{t('dash.continueSub')}</p>
        </div>
        <Link className="btn btn-primary" style={{ marginLeft: 'auto', flexShrink: 0 }}
          to={firstTodo ? `/module/${firstTodo.id}` : '/course'}>
          {firstTodo ? t('dash.resume') : t('dash.begin')}
        </Link>
      </div>
    </div>
  );
}
