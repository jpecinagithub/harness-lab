import React from 'react';
import { Calculator, Brain, StickyNote, Search } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import HarnessDemo from '../components/HarnessDemo.jsx';
import Downloads from '../components/Downloads.jsx';

const TOOL_CARDS = [
  { icon: Calculator, name: 'calculator', en: 'Safe arithmetic evaluator — the harness never lets the model do math in prose.', es: 'Evaluador aritmético seguro — el harness nunca deja que el modelo haga cuentas en prosa.' },
  { icon: Brain, name: 'memory_write / memory_read', en: 'Long-term memory backed by localStorage. Facts persist between sessions.', es: 'Memoria de largo plazo sobre localStorage. Los datos persisten entre sesiones.' },
  { icon: StickyNote, name: 'notes_write', en: 'Timestamped notes. A second write path with different retention semantics.', es: 'Notas con fecha. Una segunda vía de escritura con distinta semántica de retención.' },
  { icon: Search, name: 'web_search', en: 'Demo knowledge base about harness engineering (stand-in for RAG / real search).', es: 'Base de conocimiento demo sobre harness engineering (sustituto de RAG / búsqueda real).' },
];

export default function LabPage() {
  const { t, lang } = useLang();
  return (
    <div>
      <h1 className="section-title">{t('lab.title')}</h1>
      <p className="section-sub">{t('lab.sub')}</p>

      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{t('lab.chatTitle')}</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>{t('lab.chatSub')}</p>
      <HarnessDemo />

      <h2 style={{ fontSize: 20, margin: '34px 0 14px' }}>{t('lab.toolsTitle')}</h2>
      <div className="grid-2" style={{ marginBottom: 34 }}>
        {TOOL_CARDS.map((c, i) => (
          <div key={i} className="card" style={{ boxShadow: 'none', display: 'flex', gap: 14 }}>
            <c.icon size={24} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <code className="inline">{c.name}</code>
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 14 }}>{c[lang]}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{t('lab.dlTitle')}</h2>
      <p className="muted" style={{ marginTop: 0, marginBottom: 16 }}>{t('lab.dlSub')}</p>
      <Downloads />
    </div>
  );
}
