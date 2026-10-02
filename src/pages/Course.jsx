import React from 'react';
import { Link } from 'react-router-dom';
import * as icons from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useProgress } from '../hooks/ProgressContext.jsx';
import { LEVELS } from '../data/levels.js';
import { byLevel } from '../data/modules/index.js';

export function modIcon(name, size = 22) {
  const C = icons[name] || icons.CircleHelp;
  return <C size={size} />;
}

export default function Course() {
  const { t, lang } = useLang();
  const { state } = useProgress();
  return (
    <div>
      <h1 className="section-title">{t('course.title')}</h1>
      <p className="section-sub">{t('course.sub')}</p>
      {LEVELS.map((lv) => {
        const mods = byLevel(lv.n);
        const done = mods.filter((m) => state.modules[m.id]?.passed).length;
        const LevelIcon = icons[lv.icon] || icons.Boxes;
        return (
          <div key={lv.n} id={`level-${lv.n}`} style={{ marginBottom: 30, scrollMarginTop: 80 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-text)' }}>
                <LevelIcon size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{lv.n}. {lv[lang].title}</h2>
                <div className="muted" style={{ fontSize: 13.5 }}>{lv[lang].tagline} · {done}/{mods.length} {t('course.completed')}</div>
              </div>
            </div>
            {mods.map((m) => {
              const rec = state.modules[m.id];
              return (
                <Link key={m.id} to={`/module/${m.id}`} className={`module-row${rec?.passed ? ' done' : ''}`} style={{ textDecoration: 'none' }}>
                  <div className="icon">{modIcon(m.icon)}</div>
                  <div>
                    <h4>{m[lang].title}</h4>
                    <p>{m[lang].tagline}</p>
                  </div>
                  <span className={`score-pill${rec?.passed ? ' pass' : ''}`}>
                    {rec ? `${t('module.yourBest')}: ${rec.best}/8` : '8Q'}
                  </span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
