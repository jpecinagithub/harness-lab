import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Trophy } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useProgress } from '../hooks/ProgressContext.jsx';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function Quiz({ moduleId, questions, onDone, standalone = false }) {
  const { t, lang } = useLang();
  const { recordQuiz } = useProgress();
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [answers, setAnswers] = useState([]);

  const q = questions[idx];
  const finished = answers.length === questions.length;

  const pick = (i) => { if (picked === null) setPicked(i); };

  const next = () => {
    const entry = { moduleId, q: q.q, options: q.options, answer: q.answer, why: q.why, picked };
    const nextAnswers = [...answers, entry];
    setAnswers(nextAnswers);
    if (idx + 1 < questions.length) { setIdx(idx + 1); setPicked(null); }
    else {
      const score = nextAnswers.filter((a) => a.picked === a.answer).length;
      const mistakes = nextAnswers.filter((a) => a.picked !== a.answer);
      if (!standalone) recordQuiz(moduleId, score, questions.length, mistakes);
      onDone && onDone(score, questions.length, mistakes);
    }
  };

  if (finished && standalone) return null;

  return (
    <div>
      <div className="muted" style={{ marginBottom: 14, fontSize: 13.5 }}>
        {t('quiz.question')} {idx + 1} {t('quiz.of')} {questions.length}
      </div>
      <div className="quiz-q">
        <h4>{q.q}</h4>
        {q.options.map((opt, i) => {
          let cls = 'quiz-opt';
          if (picked !== null) {
            if (i === q.answer) cls += ' correct';
            else if (i === picked) cls += ' wrong';
          }
          return (
            <button key={i} className={cls} disabled={picked !== null} onClick={() => pick(i)}>
              <span className="letter">{LETTERS[i]}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {opt}
                {picked !== null && i === q.answer && <CheckCircle2 size={16} style={{ color: 'var(--ok)', flexShrink: 0 }} />}
                {picked !== null && i === picked && i !== q.answer && <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
              </span>
            </button>
          );
        })}
        {picked !== null && (
          <div className="quiz-why">
            <strong style={{ color: picked === q.answer ? 'var(--ok)' : 'var(--danger)' }}>
              {picked === q.answer ? t('quiz.correct') : t('quiz.wrong')}
            </strong>{' '}
            {t('quiz.why')} {q.why}
          </div>
        )}
      </div>
      <button className="btn btn-primary" disabled={picked === null} onClick={next}>
        {idx + 1 === questions.length ? t('quiz.finish') : t('quiz.next')} <ArrowRight size={16} />
      </button>
    </div>
  );
}

export function QuizResults({ score, total, mistakes, onRetake, onBack }) {
  const { t } = useLang();
  const pct = Math.round((score / total) * 100);
  const passed = pct >= 70;
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <Trophy size={40} style={{ color: passed ? 'var(--gold)' : 'var(--faint)' }} />
      <h2 style={{ margin: '12px 0 4px' }}>{t('quiz.results')}</h2>
      <div style={{ fontSize: 44, fontWeight: 850, color: passed ? 'var(--ok)' : 'var(--accent-text)' }}>{pct}%</div>
      <p className="muted">{t('quiz.score')}: {score}/{total} · {passed ? t('quiz.passed') : t('quiz.failed')}</p>
      <p className="muted" style={{ fontSize: 13 }}>+{score * 10} {t('quiz.xpEarned')}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
        <button className="btn" onClick={onRetake}><RotateCcw size={15} /> {t('module.retake')}</button>
        {onBack && <button className="btn btn-primary" onClick={onBack}>{t('quiz.backToModule')}</button>}
      </div>
    </div>
  );
}
