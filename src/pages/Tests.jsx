import React, { useState } from 'react';
import { Play } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { allQuestions } from '../data/modules/index.js';
import { LEVELS } from '../data/levels.js';
import Quiz, { QuizResults } from '../components/Quiz.jsx';

function shuffle(a) { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; }

export function useRandomQuiz(count, levelFilter) {
  const { lang } = useLang();
  return React.useMemo(() => {
    let pool = allQuestions(lang);
    if (levelFilter) pool = pool.filter((q) => q.level === levelFilter);
    return shuffle(pool).slice(0, count);
  }, [lang, levelFilter, count]);
}

export default function Tests() {
  const { t, lang } = useLang();
  const [level, setLevel] = useState(0);
  const [started, setStarted] = useState(0);
  const [result, setResult] = useState(null);
  const questions = useRandomQuiz(10, level || null);

  React.useEffect(() => { setStarted(0); setResult(null); }, [level, lang]);

  return (
    <div>
      <h1 className="section-title">{t('tests.title')}</h1>
      <p className="section-sub">{t('tests.sub')}</p>
      {!started ? (
        <div className="card">
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>{t('tests.pickLevel')}</div>
          <div className="seg" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
            <button className={level === 0 ? 'on' : ''} onClick={() => setLevel(0)}>{t('tests.all')}</button>
            {LEVELS.map((lv) => (
              <button key={lv.n} className={level === lv.n ? 'on' : ''} onClick={() => setLevel(lv.n)}>{lv.n}</button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setStarted(Date.now())}>
            <Play size={15} /> {t('tests.start')} · {t('tests.n')}
          </button>
        </div>
      ) : !result ? (
        <div key={started}>
          <Quiz moduleId={level ? `L${level}` : 'all'} questions={questions} standalone
            onDone={(score, total) => setResult({ score, total })} />
        </div>
      ) : (
        <div>
          <QuizResults score={result.score} total={result.total}
            onRetake={() => { setResult(null); setStarted(Date.now()); }} />
          <button className="btn" style={{ marginTop: 14 }} onClick={() => { setResult(null); setStarted(0); }}>
            {t('tests.pickLevel')}
          </button>
        </div>
      )}
    </div>
  );
}
