// Heuristic scan: flag quiz questions where the explanation doesn't align
// with the marked correct option (possible answer-key corruption).
import { MODULES } from './src/data/modules/index.js';

const STOP = new Set(
  'el la los las un una de del en y o que se su con por para como mas muy sin sobre entre hasta desde donde cuando porque pero este esta estos estas ese esa eso esto aquel aquello mi tu sus nos les al ante bajo tras durante mediante segun son es fue fueron ser hay han tiene tienen puede pueden debe deben hacer hace hacen cada todo todos toda todas mismo misma nunca siempre jamas tampoco ningun ninguna nada nadie alguien algo algun alguna algunos algunas vez veces tan tanto cual cuales cuyo cuya donde the a an of to in on and or is are was were be been being it its this that these those there their them they we you he she his her our your not no nor but if then than so such only also just very can will would should could may might must shall do does did done have has had having with from by for about into over after before between through during under again once here when where which who whom whose what how all any both each few more most other some than too just don doesn isn'.split(' ')
);
const ABSOLUTES = ['nunca', 'siempre', 'todos los casos', 'automáticamente', 'automatically', 'imposible', 'impossible', 'jamás', 'never', 'always', 'all cases'];
const toks = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w));

const flags = [];
for (const m of MODULES) {
  for (const L of ['en', 'es']) {
    m[L].quiz.forEach((q, i) => {
      const wt = new Set(toks(q.why));
      const ov = q.options.map((o) => toks(o).filter((t) => wt.has(t)).length);
      const ansOv = ov[q.answer];
      const bestOther = Math.max(...ov.filter((_, k) => k !== q.answer));
      const abs = ABSOLUTES.find((a) => q.options[q.answer].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(a));
      if (bestOther - ansOv >= 3 || (abs && ansOv <= 1)) {
        flags.push({ id: `${m.id}.${L} q${i + 1}`, ans: q.answer, ov, abs: abs || null });
      }
    });
  }
}
console.log('flagged: ' + flags.length + ' / 384');
for (const f of flags) console.log(JSON.stringify(f));
