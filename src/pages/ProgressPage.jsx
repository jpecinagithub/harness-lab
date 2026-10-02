import React from 'react';
import { Trash2, Zap } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useProgress, xpForLevel } from '../hooks/ProgressContext.jsx';
import { LEVELS } from '../data/levels.js';
import { byLevel } from '../data/modules/index.js';

export default function ProgressPage() {
  const { t, lang } = useLang();
  const { state, resetAll } = useProgress();
  const mods = Object.values(state.modules);
  const doneCount = mods.filter((m) => m.passed).length;
  const avg = mods.length ? Math.round(mods.reduce((s, m) => s + m.best, 0) / mods.length / 8 * 100) : 0;
  const level = xpForLevel(state.xp);

  const reset = () => { if (window.confirm(t('progress.resetConfirm'))) resetAll(); };

  return (
    <div>
      <h1 className="section-title">{t('progress.title')}</h1>
      <p className="section-sub">{t('progress.sub')}</p>
      <div className="stat-row">
        <div className="stat"><div className="v"><Zap size={22} style={{ verticalAlign: -4, color: 'var(--gold)' }} /> {level}</div><div className="l">{t('progress.level')}</div></div>
        <div className="stat"><div className="v" style={{ color: 'var(--gold)' }}>{state.xp}</div><div className="l">{t('progress.xp')}</div></div>
        <div className="stat"><div className="v">{doneCount}/24</div><div className="l">{t('progress.modulesDone')}</div></div>
        <div className="stat"><div className="v">{avg}%</div><div className="l">{t('progress.avg')}</div></div>
      </div>
      <h2 style={{ fontSize: 20 }}>{t('progress.perLevel')}</h2>
      {LEVELS.map((lv) => {
        const ms = byLevel(lv.n);
        const done = ms.filter((m) => state.modules[m.id]?.passed).length;
        return (
          <div key={lv.n} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
              <span><strong>{lv.n}.</strong> {lv[lang].title}</span>
              <span className="muted">{done}/{ms.length}</span>
            </div>
            <div className="progress-track" style={{ marginTop: 0 }}>
              <div className="progress-fill" style={{ width: `${(done / ms.length) * 100}%` }} />
            </div>
          </div>
        );
      })}
      <hr className="hr" />
      <button className="btn" onClick={reset}><Trash2 size={15} /> {t('progress.reset')}</button>
    </div>
  );
}
