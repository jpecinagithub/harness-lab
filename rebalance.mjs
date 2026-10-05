// Rebalance quiz answer positions via AST-safe rotation.
// For each module+language, correct answers are redistributed to exactly
// [2,2,2,2] across the 8 questions. ONLY option order and the answer integer
// move; the correct TEXT and its pointer move together atomically (asserted).
// No option text is ever added, removed, or reworded.
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import * as acorn from 'acorn';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (arr, rand) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const files = readdirSync('./src/data/modules').filter((f) => /^m\d{2}\.js$/.test(f)).sort();
let totalRotated = 0;

for (const f of files) {
  const path = './src/data/modules/' + f;
  const src = readFileSync(path, 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 2022, sourceType: 'module' });
  const edits = []; // {start, end, text}

  // Find: export default { en: { quiz: [...] }, es: { quiz: [...] } }
  const def = ast.body.find((n) => n.type === 'ExportDefaultDeclaration');
  const root = def.declaration;
  if (root.type !== 'ObjectExpression') throw new Error(f + ': unexpected root');
  for (const langProp of root.properties) {
    const lang = langProp.key.name || langProp.key.value; // en | es
    const langObj = langProp.value;
    const quizProp = langObj.properties.find((p) => (p.key.name || p.key.value) === 'quiz');
    const questions = quizProp.value.elements;
    if (questions.length !== 8) throw new Error(`${f}.${lang}: ${questions.length} questions`);

    const rand = mulberry32([...(f + lang)].reduce((a, c) => a + c.charCodeAt(0), 7));
    const targets = shuffled([0, 1, 2, 3, 0, 1, 2, 3], rand);

    questions.forEach((qNode, qi) => {
      const optProp = qNode.properties.find((p) => (p.key.name || p.key.value) === 'options');
      const ansProp = qNode.properties.find((p) => (p.key.name || p.key.value) === 'answer');
      const optVals = optProp.value.elements.map((e) => {
        if (e.type !== 'Literal' || typeof e.value !== 'string') throw new Error(`${f}.${lang} q${qi + 1}: non-string option`);
        return e.value;
      });
      const cur = ansProp.value.value;
      const correctText = optVals[cur];
      const t = targets[qi];
      // rotate: newOptions[j] = old[(c + j - t + 4) % 4]
      const newOrder = [0, 1, 2, 3].map((j) => optVals[(cur + j - t + 8) % 4]);
      if (newOrder[t] !== correctText) throw new Error(`${f}.${lang} q${qi + 1}: rotation logic error`);
      const newOptSrc = 'options: [' + newOrder.map((s) => JSON.stringify(s)).join(', ') + ']';
      edits.push({ start: optProp.start, end: optProp.value.end, text: newOptSrc });
      edits.push({ start: ansProp.value.start, end: ansProp.value.end, text: String(t) });
      totalRotated++;
    });
  }

  // apply from end to start to preserve offsets
  edits.sort((a, b) => b.start - a.start);
  let out = src;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  writeFileSync(path, out);
  console.log(f + ': rebalanced');
}

// Post-verify by re-import (cache-bust via query string)
for (const f of files) {
  const mod = (await import('./src/data/modules/' + f + '?v=' + Date.now())).default;
  for (const L of ['en', 'es']) {
    mCheck(mod, f, L);
  }
}
function mCheck(mod, f, L) {
  const seen = new Set();
  mod[L].quiz.forEach((q, i) => {
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) throw new Error(`${f}.${L} q${i + 1}: bad answer`);
    seen.add(q.answer);
    if (q.options.length !== 4) throw new Error(`${f}.${L} q${i + 1}: options != 4`);
  });
  if (seen.size !== 4) throw new Error(`${f}.${L}: indices not all used`);
}
console.log(`\nOK: ${totalRotated} questions rotated, all assertions passed.`);
