import React from 'react';
import { KeyRound, Lightbulb, AlertTriangle, CheckCircle2, Copy, Check } from 'lucide-react';

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Tiny single-pass JS tokenizer → highlighted HTML
function highlightJS(code) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|\b(const|let|var|function|async|await|return|if|else|for|while|of|in|new|try|catch|throw|switch|case|break|continue|class|extends|import|export|default|from|null|undefined|true|false|this)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*\()/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code)) !== null) {
    out += esc(code.slice(last, m.index));
    const [full, comment, str, kw, num, fn] = m;
    if (comment) out += `<span class="tok-c">${esc(full)}</span>`;
    else if (str) out += `<span class="tok-s">${esc(full)}</span>`;
    else if (kw) out += `<span class="tok-k">${esc(full)}</span>`;
    else if (num) out += `<span class="tok-n">${esc(full)}</span>`;
    else if (fn) out += `<span class="tok-f">${esc(full)}</span>`;
    else out += esc(full);
    last = m.index + full.length;
  }
  return out + esc(code.slice(last));
}

export function CodeBlock({ code, lang = 'javascript', note, title }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };
  return (
    <div className="codeblock">
      <div className="codeblock-head">
        <span>{title || lang}</span>
        <button className="btn btn-ghost btn-sm" onClick={copy} style={{ border: 'none', color: 'var(--faint)' }}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'OK' : ''}
        </button>
      </div>
      <pre><code dangerouslySetInnerHTML={{ __html: highlightJS(code) }} /></pre>
      {note && <div className="note">{note}</div>}
    </div>
  );
}

function inlineFmt(text) {
  const parts = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0, m, i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('`')) parts.push(<code key={i} className="inline">{tok.slice(1, -1)}</code>);
    else parts.push(<strong key={i}>{tok.slice(2, -2)}</strong>);
    last = m.index + tok.length; i++;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const CALLOUT_ICON = { key: KeyRound, tip: Lightbulb, warn: AlertTriangle };

export default function RichText({ sections, simSlot = null }) {
  return (
    <div className="prose">
      {sections.map((s, i) => {
        const simHere = simSlot && i === 2 ? simSlot : null;
        let el = null;
        if (s.kind === 'text') {
          el = (
            <div key={i}>
              {s.heading && <h2>{s.heading}</h2>}
              {String(s.body).split('\n\n').map((p, j) => <p key={j}>{inlineFmt(p)}</p>)}
            </div>
          );
        } else if (s.kind === 'code') {
          el = (
            <div key={i}>
              {s.heading && <h2>{s.heading}</h2>}
              <CodeBlock code={s.code} lang={s.lang} note={s.note} />
            </div>
          );
        } else if (s.kind === 'callout') {
          const Icon = CALLOUT_ICON[s.tone] || KeyRound;
          el = (
            <div key={i} className={`callout ${s.tone}`}>
              <div className="callout-title"><Icon size={16} /> {s.title}</div>
              <p>{inlineFmt(s.body)}</p>
            </div>
          );
        } else if (s.kind === 'compare') {
          el = (
            <div key={i}>
              {s.heading && <h2>{s.heading}</h2>}
              <table className="compare-table">
                <thead><tr>{s.headers.map((h, k) => <th key={k}>{h}</th>)}</tr></thead>
                <tbody>{s.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{inlineFmt(c)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        } else if (s.kind === 'checklist') {
          el = (
            <div key={i}>
              {s.heading && <h2>{s.heading}</h2>}
              <ul className="checklist">{s.items.map((it, k) => <li key={k}><CheckCircle2 /> <span>{inlineFmt(it)}</span></li>)}</ul>
            </div>
          );
        }
        return <React.Fragment key={i}>{el}{simHere}</React.Fragment>;
      })}
    </div>
  );
}
