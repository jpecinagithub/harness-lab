import React, { useState } from 'react';
import { GraduationCap, Play } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useProgress } from '../hooks/ProgressContext.jsx';
import { useRandomQuiz } from './Tests.jsx';
import Quiz, { QuizResults } from '../components/Quiz.jsx';

export default function FinalExam() {
  const { t } = useLang();
  const { state, recordExam } = useProgress();
  const [started, setStarted] = useState(0);
  const [result, setResult] = useState(null);
  const questions = useRandomQuiz(40, null);

  return (
    <div>
      <h1 className="section-title">{t('exam.title')}</h1>
      <p className="section-sub">{t('exam.sub')}</p>
      {state.examBest > 0 && (
        <p className="muted">{t('exam.best')}: {state.examBest}% · {t('exam.attempts')}: {state.examAttempts}</p>
      )}
      {!started ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <GraduationCap size={44} style={{ color: 'var(--accent-text)' }} />
          <p className="muted" style={{ maxWidth: 480, margin: '12px auto 20px' }}>{t('exam.sub')}</p>
          <button className="btn btn-primary" onClick={() => setStarted(Date.now())}>
            <Play size={15} /> {t('exam.start')}
          </button>
        </div>
      ) : !result ? (
        <div key={started}>
          <Quiz moduleId="exam" questions={questions} standalone
            onDone={(score, total) => {
              const pct = Math.round((score / total) * 100);
              recordExam(pct);
              setResult({ score, total, pct });
            }} />
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>{result.pct}%</h2>
          <p className="muted">{result.pct >= 75 ? t('exam.passed') : t('exam.failed')}</p>
          <button className="btn btn-primary" onClick={() => { setResult(null); setStarted(Date.now()); }}>
            {t('exam.start')}
          </button>
        </div>
      )}
    </div>
  );
}
