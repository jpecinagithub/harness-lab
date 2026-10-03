import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, FlaskConical, History, BookMarked, TerminalSquare, Rocket, GraduationCap, BarChart3, Cog } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext.jsx';

const GROUPS = [
  { key: 'learn', links: [
    { to: '/', icon: LayoutDashboard, k: 'dashboard', end: true },
    { to: '/course', icon: BookOpen, k: 'course' },
  ]},
  { key: 'practice', links: [
    { to: '/tests', icon: FlaskConical, k: 'tests' },
    { to: '/review', icon: History, k: 'review' },
    { to: '/glossary', icon: BookMarked, k: 'glossary' },
  ]},
  { key: 'build', links: [
    { to: '/sandbox', icon: TerminalSquare, k: 'sandbox' },
    { to: '/lab', icon: Rocket, k: 'lab' },
  ]},
];

export default function Sidebar({ open, onClose }) {
  const { t } = useLang();
  const loc = useLocation();
  React.useEffect(() => { onClose && onClose(); }, [loc.pathname]);
  return (
    <aside className={`sidebar${open ? ' open' : ''}`}>
      <div className="brand">
        <div className="brand-mark"><Cog size={22} /></div>
        <div>
          <div className="brand-name">HARNESS LAB</div>
          <div className="brand-sub">LLM Harness Engineering</div>
        </div>
      </div>
      {GROUPS.map((g) => (
        <div key={g.key}>
          <div className="nav-group-label">{t(`nav.${g.key}`)}</div>
          {g.links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <l.icon /> {t(`nav.${l.k}`)}
            </NavLink>
          ))}
        </div>
      ))}
      <div className="nav-group-label">{t('nav.practice')}</div>
      <NavLink to="/exam" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><GraduationCap /> {t('nav.exam')}</NavLink>
      <NavLink to="/progress" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><BarChart3 /> {t('nav.progress')}</NavLink>
      <div style={{ marginTop: 'auto', padding: '14px 8px 4px' }}>
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border-soft)',
          borderRadius: 12, padding: '14px',
        }}>
          <div className="nav-group-label" style={{ padding: '0 0 8px' }}>{t('author.title')}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent), #ff3d00)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 13,
            }}>JP</div>
            <div style={{ fontWeight: 750, fontSize: 14 }}>{t('author.name')}</div>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.55 }}>{t('author.bio')}</p>
          <a href="mailto:jpecina@gmail.com" className="btn btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
            {t('author.contact')}: jpecina@gmail.com
          </a>
        </div>
        <div style={{ padding: '12px 4px 0', fontSize: 11, color: 'var(--faint)', lineHeight: 1.5 }}>
          {t('footer.built')}
        </div>
      </div>
    </aside>
  );
}
