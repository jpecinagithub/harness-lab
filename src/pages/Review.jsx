import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, ArrowRight } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useProgress } from '../hooks/ProgressContext.jsx';
import { byId } from '../data/modules/index.js';
import Quiz from '../components/Quiz.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function Review() {
  const { t, lang } = useLang();
  const { state, clearMistakes } = useProgress();
  const [retryIdx, setRetryIdx] = useState(null);

  if (retryIdx !== null) {
    const m = state.mistakes[retryIdx];
    return (
      <div>
        <div className="quiz-q">
          <h4>{m.q}</h4>
          {m.options.map((opt, i) => (
            <button key={i} className={`quiz-opt${i === m.answer ? ' correct' : i === m.picked ? ' wrong' : ''}`} disabled>
              <span className="letter">{LETTERS[i]}</span><span>{opt}</span>
            </button>
          ))}
          <div className="quiz-why">{t('quiz.why')} {m.why}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={() => setRetryIdx(null)}>{t('quiz.backToModule')}</button>
          {m.moduleId && byId(m.moduleId) && (
            <Link className="btn btn-primary" to={`/module/${m.moduleId}`}>{t('review.fromModule')}: {byId(m.moduleId)[lang].title} <ArrowRight size={15} /></Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="section-title">{t('review.title')}</h1>
      <p className="section-sub">{t('review.sub')}</p>
      {state.mistakes.length === 0 ? (
        <div className="empty">{t('review.empty')}</div>
      ) : (
        <div>
          <button className="btn btn-sm" style={{ marginBottom: 16 }} onClick={clearMistakes}>
            <Trash2 size={14} /> {t('review.clear')}
          </button>
          {state.mistakes.map((m, i) => (
            <div key={i} className="module-row" style={{ cursor: 'pointer' }} onClick={() => setRetryIdx(i)}>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: 14.5 }}>{m.q}</h4>
                <p>{t('review.fromModule')}: {m.moduleId} · {t('quiz.wrong')}: {LETTERS[m.picked]} → {LETTERS[m.answer]}</p>
              </div>
              <span className="score-pill">{t('review.retry')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
