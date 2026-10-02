import React, { useState } from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext.jsx';

export default function Header({ onMenu }) {
  const { t, lang, setLang } = useLang();
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const flipTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('hl-theme', next);
  };
  return (
    <header className="topbar">
      <button className="icon-btn mobile-nav-toggle" onClick={onMenu} aria-label="menu"><Menu size={18} /></button>
      <div className="topbar-title">{t('topbar.tagline')}</div>
      <div className="topbar-spacer" />
      <div className="seg" role="group" aria-label="language">
        <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
        <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>ES</button>
      </div>
      <button className="icon-btn" onClick={flipTheme} aria-label="theme">
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </header>
  );
}
