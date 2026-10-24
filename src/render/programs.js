// Compiled shaders stay. three.js deletes a shader program as soon as the last material using
// it is disposed, and the next material that needs it compiles it again, in the middle of a
// frame, waiting for the driver: every cube change threw away about a dozen (the old cube's
// materials go before the new cube's are drawn) and built them again, 100 ms and more on a fast
// machine; a lone shot, projectile or loot glow did the same each time. There are only some tens
// of variants, so each is kept for good once compiled: one more use than three.js counts.
//
// A program compiled while drawing (not ahead, render/warmup.js) held that frame up: counted
// (compiledWhileDrawing, the perf overlay: game/perf.js), and with the dev tools named in the
// console, so a variant the warm-up misses shows. (In Safari the compiling happens in another
// process: the frame after it comes late, nothing in the page's own time shows it.)
import { renderer, scene } from './scene.js';

const kept = new WeakSet();
let known = 0;   // kept programs are never deleted: any beyond these are new
const dev = new URLSearchParams(location.search).get('dev') === '1';
export const programStats = { compiledWhileDrawing: 0, last: '' };

// after rendering (main.js: drawn), and after compiling ahead (render/warmup.js)
export function keepPrograms(drawn = false) {
  const programs = renderer.info.programs;
  if (programs.length === known) return;
  for (const p of programs) if (!kept.has(p)) {
    kept.add(p); p.usedTimes++;
    if (drawn) {
      programStats.compiledWhileDrawing++;
      programStats.last = p.name || p.cacheKey.slice(-40);
      if (dev) console.warn('shader compiled while drawing (not warmed ahead):', p.name || '(unnamed)', drawnBy(p), p.cacheKey.slice(0, 60) + ' … ' + p.cacheKey.slice(-60));
    }
  }
  known = programs.length;
}
// (dev) what in the scene draws with a program: material type and object names
function drawnBy(p) {
  const out = new Set();
  scene.traverse(o => {
    for (const m of [].concat(o.material ?? [])) if (renderer.properties.get(m).currentProgram === p) {
      const names = [];
      for (let x = o; x && names.length < 4; x = x.parent) if (x.name || x.userData.part) names.push(x.name || x.userData.part);
      out.add(`${m.type}${m.name ? ' ' + m.name : ''} on ${names.join(' < ') || o.type}`);
    }
  });
  return [...out].slice(0, 3).join('; ') || '(not in the scene)';
}
