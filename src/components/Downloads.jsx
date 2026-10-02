import React from 'react';
import { MonitorDown, TerminalSquare, Download, FileText } from 'lucide-react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { CodeBlock } from './RichText.jsx';

export default function Downloads() {
  const { t, lang } = useLang();
  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 18 }}>
        <div className="dl-card">
          <div className="dl-icon"><MonitorDown size={26} /></div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 6px' }}>{t('lab.dlDesktopT')}</h3>
            <p className="muted" style={{ fontSize: 14, margin: '0 0 14px' }}>{t('lab.dlDesktopD')}</p>
            <a className="btn btn-primary" href="/downloads/harness-desktop.html" download="harness-desktop.html">
              <Download size={15} /> {t('lab.download')} · HTML
            </a>
            <div className="callout tip" style={{ marginTop: 14 }}>
              <div className="callout-title">{t('lab.howDesktop')}</div>
              <p>{t('lab.howDesktopSteps')}</p>
            </div>
          </div>
        </div>
        <div className="dl-card">
          <div className="dl-icon"><TerminalSquare size={26} /></div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 6px' }}>{t('lab.dlCliT')}</h3>
            <p className="muted" style={{ fontSize: 14, margin: '0 0 14px' }}>{t('lab.dlCliD')}</p>
            <a className="btn btn-primary" href="/downloads/harness-cli.mjs" download="harness-cli.mjs">
              <Download size={15} /> {t('lab.download')} · .mjs
            </a>
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>{t('lab.howCli')}</div>
              <div className="muted" style={{ fontSize: 13 }}>{t('lab.cliMock')}</div>
              <CodeBlock code={'node harness-cli.mjs --mock'} lang="bash" />
              <div className="muted" style={{ fontSize: 13 }}>{t('lab.cliReal')}</div>
              <CodeBlock code={lang === 'es'
                ? '# cualquier API compatible con OpenAI\nexport HARNESS_API_KEY="tu-clave"\nnode harness-cli.mjs "Recuerda que mi nave es Aurora"'
                : '# any OpenAI-compatible API\nexport HARNESS_API_KEY="your-key"\nnode harness-cli.mjs "Remember that my ship is Aurora"'} lang="bash" />
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ boxShadow: 'none' }}>
        <h3 style={{ margin: '0 0 8px', display: 'flex', gap: 8, alignItems: 'center' }}><FileText size={18} /> {t('lab.sameTitle')}</h3>
        <p className="muted" style={{ margin: 0 }}>{t('lab.sameSub')}</p>
      </div>
    </div>
  );
}
