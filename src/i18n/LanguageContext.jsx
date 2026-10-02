import React, { createContext, useContext, useEffect, useState } from 'react';
import { STRINGS } from './strings.js';

const LangCtx = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('hl-lang') || 'en');
  useEffect(() => {
    localStorage.setItem('hl-lang', lang);
    document.documentElement.lang = lang;
  }, [lang ]);
  const t = (path) => {
    const parts = path.split('.');
    let cur = STRINGS[lang];
    for (const p of parts) {
      if (cur == null) break;
      cur = cur[p];
    }
    if (cur == null) {
      cur = STRINGS.en;
      for (const p of parts) { if (cur == null) break; cur = cur[p]; }
    }
    return cur ?? path;
  };
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}
