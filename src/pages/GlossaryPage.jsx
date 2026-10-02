import React, { useState } from 'react';
import { useLang } from '../i18n/LanguageContext.jsx';
import glossary from '../data/glossary.js';

export default function GlossaryPage() {
  const { t, lang } = useLang();
  const [q, setQ] = useState('');
  const terms = glossary.filter((g) =>
    (g.term + ' ' + g.en + ' ' + g.es).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <h1 className="section-title">{t('gloss.title')}</h1>
      <p className="section-sub">{t('gloss.sub')}</p>
      <input className="gloss-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('gloss.search')} />
      {terms.map((g, i) => (
        <div key={i} className="gloss-term">
          <h4>{g.term}</h4>
          <p>{g[lang]}</p>
        </div>
      ))}
    </div>
  );
}
