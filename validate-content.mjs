// Validates HARNESS LAB content files against CONTENT_BRIEF.md.
// Usage: node validate-content.mjs
import { readdirSync } from 'fs';

const errors = [];
const ok = (cond, msg) => { if (!cond) errors.push(msg); };

const files = readdirSync('./src/data/modules').filter((f) => /^m\d{2}\.js$/.test(f)).sort();
ok(files.length === 24, `expected 24 module files, found ${files.length}: ${files.join(',')}`);

const levelAnswers = {};
let totalWords = 0;

for (const f of files) {
  const id = f.replace('.js', '');
  let mod;
  try { mod = (await import(`./src/data/modules/${f}`)).default; }
  catch (e) { errors.push(`${id}: import failed: ${e.message}`); continue; }
  ok(mod.id === id, `${id}: id mismatch (${mod.id})`);
  ok(mod.level >= 1 && mod.level <= 6, `${id}: bad level`);
  ok(typeof mod.icon === 'string' && mod.icon.length > 0, `${id}: missing icon`);
  ok(mod.sim === null || ['loop', 'sandbox', 'memory', 'tools', 'mcp'].includes(mod.sim), `${id}: bad sim ${mod.sim}`);
  for (const L of ['en', 'es']) {
    const c = mod[L];
    const tag = `${id}.${L}`;
    if (!c) { errors.push(`${tag}: missing language block`); continue; }
    ok(c.title && c.title.length > 5, `${tag}: bad title`);
    ok(c.tagline && c.tagline.length > 5, `${tag}: bad tagline`);
    ok(Array.isArray(c.objectives) && c.objectives.length === 3, `${tag}: objectives != 3`);
    ok(Array.isArray(c.takeaways) && c.takeaways.length === 4, `${tag}: takeaways != 4`);
    ok(Array.isArray(c.sections) && c.sections.length >= 4 && c.sections.length <= 7, `${tag}: sections ${c.sections?.length} not in 4..7`);
    ok(c.sections.some((s) => s.kind === 'code'), `${tag}: no code section`);
    ok(c.sections.some((s) => s.kind === 'text'), `${tag}: no text section`);
    for (const [i, s] of c.sections.entries()) {
      ok(['text', 'code', 'callout', 'compare', 'checklist'].includes(s.kind), `${tag} s${i}: bad kind ${s.kind}`);
      if (s.kind === 'code') {
        ok(s.code && s.code.length > 60 && !s.code.includes('...'), `${tag} s${i}: code too short or placeholder`);
      }
    }
    ok(Array.isArray(c.quiz) && c.quiz.length === 8, `${tag}: quiz != 8`);
    const idxCount = [0, 0, 0, 0];
    for (const [i, q] of c.quiz.entries()) {
      ok(q.q && q.q.length > 10, `${tag} q${i}: bad question`);
      ok(Array.isArray(q.options) && q.options.length === 4 && q.options.every((o) => o && o.length > 0), `${tag} q${i}: bad options`);
      ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer <= 3, `${tag} q${i}: bad answer`);
      ok(q.why && q.why.length > 10, `${tag} q${i}: bad why`);
      idxCount[q.answer]++;
    }
    ok(idxCount.every((n) => n >= 1), `${tag}: answer indices not all used (${idxCount})`);
    levelAnswers[mod.level] = levelAnswers[mod.level] || [0, 0, 0, 0];
    idxCount.forEach((n, k) => (levelAnswers[mod.level][k] += n));
    const words = JSON.stringify(c).split(/\s+/).length;
    totalWords += words;
    if (words < 900) errors.push(`${tag}: only ~${words} words (want 1200-1800)`);
  }
  const blob = JSON.stringify(mod);
  for (const bad of ['TODO', 'lorem', 'Lorem', 'FIXME', 'XXX']) {
    if (blob.includes(bad)) errors.push(`${id}: contains "${bad}"`);
  }
}
for (const [lv, counts] of Object.entries(levelAnswers)) {
  const min = Math.min(...counts), max = Math.max(...counts);
  ok(max - min <= 6, `level ${lv}: answer distribution uneven ${counts} (want ±3)`);
}

// glossary
try {
  const g = (await import('./src/data/glossary.js')).default;
  ok(Array.isArray(g) && g.length >= 40, `glossary: ${g?.length} terms (want >=40)`);
  for (const [i, t] of g.entries()) {
    ok(t.term && t.en && t.es && t.en.length > 10 && t.es.length > 10, `glossary[${i}]: incomplete`);
  }
} catch (e) { errors.push('glossary import failed: ' + e.message); }

console.log(`modules: ${files.length}, total words (en+es): ${totalWords.toLocaleString()}`);
console.log('answer distribution per level:', JSON.stringify(levelAnswers));
if (errors.length) { console.log('\nERRORS (' + errors.length + '):'); errors.forEach((e) => console.log(' - ' + e)); process.exit(1); }
console.log('\nALL CONTENT CHECKS PASSED ✔');
