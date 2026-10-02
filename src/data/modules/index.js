// Central module registry. Content files are authored by the content team
// (see CONTENT_BRIEF.md); each exports {id, level, n, icon, sim, en, es}.
import m01 from './m01.js';
import m02 from './m02.js';
import m03 from './m03.js';
import m04 from './m04.js';
import m05 from './m05.js';
import m06 from './m06.js';
import m07 from './m07.js';
import m08 from './m08.js';
import m09 from './m09.js';
import m10 from './m10.js';
import m11 from './m11.js';
import m12 from './m12.js';
import m13 from './m13.js';
import m14 from './m14.js';
import m15 from './m15.js';
import m16 from './m16.js';
import m17 from './m17.js';
import m18 from './m18.js';
import m19 from './m19.js';
import m20 from './m20.js';
import m21 from './m21.js';
import m22 from './m22.js';
import m23 from './m23.js';
import m24 from './m24.js';

export const MODULES = [m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12,
  m13, m14, m15, m16, m17, m18, m19, m20, m21, m22, m23, m24];

export const byId = (id) => MODULES.find((m) => m.id === id);
export const byLevel = (n) => MODULES.filter((m) => m.level === n).sort((a, b) => a.n - b.n);
export const allQuestions = (lang) => MODULES.flatMap((m) =>
  m[lang].quiz.map((q) => ({ ...q, moduleId: m.id, level: m.level })));
