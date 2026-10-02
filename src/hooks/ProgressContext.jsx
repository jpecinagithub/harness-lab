import React, { createContext, useContext, useEffect, useState } from 'react';

const KEY = 'hl:v1';
const PASS = 70;

function blank() {
  return { modules: {}, mistakes: [], examBest: 0, examAttempts: 0, xp: 0, sandboxRuns: 0, labChats: 0 };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch { return blank(); }
}

const Ctx = createContext(null);

export function xpForLevel(xp) {
  return Math.floor(xp / 300) + 1;
}

export function ProgressProvider({ children }) {
  const [state, setState] = useState(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const recordQuiz = (moduleId, score, total, mistakes) => {
    setState((s) => {
      const prev = s.modules[moduleId];
      const passed = score / total >= PASS / 100;
      const best = Math.max(prev?.best ?? 0, score);
      const gained = passed && !prev?.passed ? score * 10 : (passed ? Math.max(0, (score - (prev?.best ?? 0)) * 10) : 0);
      return {
        ...s,
        xp: s.xp + gained,
        modules: { ...s.modules, [moduleId]: { best, passed: (prev?.passed || passed), attempts: (prev?.attempts ?? 0) + 1 } },
        mistakes: [...mistakes.map((m) => ({ ...m, ts: Date.now() })), ...s.mistakes].slice(0, 200),
      };
    });
  };

  const clearMistakes = () => setState((s) => ({ ...s, mistakes: [] }));
  const recordExam = (score) => setState((s) => ({
    ...s, examBest: Math.max(s.examBest, score), examAttempts: s.examAttempts + 1,
    xp: s.xp + (score >= 75 ? 200 : 20),
  }));
  const bump = (field) => setState((s) => ({ ...s, [field]: (s[field] ?? 0) + 1 }));
  const resetAll = () => setState(blank());

  return (
    <Ctx.Provider value={{ state, recordQuiz, clearMistakes, recordExam, bump, resetAll, xpForLevel }}>
      {children}
    </Ctx.Provider>
  );
}

export function useProgress() { return useContext(Ctx); }
export { PASS };
