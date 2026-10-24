// The ice slide, a trial room's puzzle, made and solved by the game's own code: makeSlide and
// solveSlide (src/cubegen/trials/solve.js), slideStop (src/core/trials.js). On ice you slide
// until a rock or the rim stops you. The maker throws rocks onto the field at random and keeps
// the field only if the solver says it is good: the fewest slides to the goal in the depth's
// band, no stop you cannot get back from, and enough wrong turns. "Every stop" shows what the
// solver found: a breadth-first search over the stops (learn/paths.html), each with its number
// of slides from the start.
import { makeSlide, solveSlide, slideGraph, slideStart, slideBand } from '../../src/cubegen/trials/solve.js';
import { slideStop } from '../../src/core/trials.js';
import { mulberry32 } from '../../src/core/util.js';
import { canvas, loop, html, t as tr } from '../deck.js';

const W = 640, H = 330, SD = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const KEYS = { ArrowRight: 0, ArrowLeft: 1, ArrowDown: 2, ArrowUp: 3 };

export default function mount(el) {
  const { g } = canvas(el, W, H);
  const row = html(el, `<div><div class="row"><label>${tr('depth', 'Tiefe')} <select class="depth"><option value="3">3</option><option value="10">10</option></select></label>
    <button class="new">${tr('New puzzle', 'Neues Rätsel')}</button><button class="again">${tr('Start again', 'Von vorn')}</button>
    <button class="way">${tr("The solver's way", 'Der Weg des Lösers')}</button><label><input type="checkbox" class="stops"> ${tr('every stop', 'jeder Halt')}</label></div>
    <div class="row"><button data-d="3">↑</button><button data-d="1">←</button><button data-d="2">↓</button><button data-d="0">→</button>
    <span class="muted small">${tr('or the arrow keys (click the puzzle first)', 'oder die Pfeiltasten (klick zuerst aufs Rätsel)')}</span></div></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  el.dataset.keys = 'arrows';
  el.tabIndex = 0;
  let F, sol, graph, at, slides, done, thrown, anim = null, seed = 1 + Math.floor(Math.random() * 1e6), queue = [];

  function make() {
    const depth = +$('.depth').value, size = depth >= 10 ? 7 : 6, R = mulberry32(seed), side = Math.floor(R() * 4);
    // one try at a time, so we can count the fields the maker threw away
    thrown = 0;
    let made = null;
    while (!made && thrown < 5000) { made = makeSlide(R, size, size, slideBand(depth), side, [0, 1, 2, 3].filter(s => s !== side), 1); if (!made) thrown++; }
    F = made.field; sol = solveSlide(F); graph = slideGraph(F);
    restart();
  }
  function restart() { at = slideStart(F); slides = 0; done = false; anim = null; queue = []; draw(); }
  function slide(d) {
    if (done || anim) { if (!done) queue.push(d); return; }
    const s = slideStop(F, at[0], at[1], d);
    const to = s === 'out' ? slideStart(F) : s;
    if (s !== 'out' && to[0] === at[0] && to[1] === at[1]) return;
    slides++;
    anim = { from: [...at], to, t: 0, out: s === 'out', d };
    at = to;
  }
  const C = () => Math.min(36, Math.floor(250 / F.w)), X0 = () => 40, Y0 = () => 40;
  const cell = (x, z) => [X0() + x * C(), Y0() + z * C()];

  function draw(pos = at) {
    const c = C();
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    // the rim, with its two gaps
    g.fillStyle = '#5a6678'; g.fillRect(X0() - 8, Y0() - 8, F.w * c + 16, F.h * c + 16);
    g.fillStyle = '#cfe8f4'; g.fillRect(X0(), Y0(), F.w * c, F.h * c);
    const gap = (p, col) => {
      const [x, y] = cell(p.x, p.z), [dx, dz] = SD[p.side];
      g.fillStyle = col;
      if (dx) g.fillRect(dx > 0 ? x + c : x - 8, y + 3, 8, c - 6); else g.fillRect(x + 3, dz > 0 ? y + c : y - 8, c - 6, 8);
    };
    gap(F.entry, '#70d6aa'); gap(F.goal, '#ffcf7a');
    const [gx, gy] = cell(F.goal.x, F.goal.z);
    g.fillStyle = '#ffcf7a88'; g.fillRect(gx + 4, gy + 4, c - 8, c - 8);
    g.strokeStyle = '#a8c8d8'; g.lineWidth = 1;
    for (let i = 1; i < F.w; i++) { g.beginPath(); g.moveTo(X0() + i * c, Y0()); g.lineTo(X0() + i * c, Y0() + F.h * c); g.stroke(); }
    for (let j = 1; j < F.h; j++) { g.beginPath(); g.moveTo(X0(), Y0() + j * c); g.lineTo(X0() + F.w * c, Y0() + j * c); g.stroke(); }
    for (let z = 0; z < F.h; z++) for (let x = 0; x < F.w; x++) if (F.rock[z * F.w + x]) {
      const [rx, ry] = cell(x, z);
      g.fillStyle = '#6a5a4a'; g.beginPath(); g.arc(rx + c / 2, ry + c / 2, c * 0.4, 0, 7); g.fill();
    }
    if ($('.stops').checked) {
      g.font = `bold ${Math.round(c * 0.4)}px 'IBM Plex Mono', monospace`; g.textAlign = 'center';
      for (const [k, d] of graph.dist) {
        const [x, z] = k.split(',').map(Number), [sx, sy] = cell(x, z);
        g.fillStyle = '#3a8cff'; g.fillText(d, sx + c / 2, sy + c / 2 + c * 0.15);
      }
      g.textAlign = 'left';
    }
    const [px, py] = [X0() + (pos[0] + 0.5) * c, Y0() + (pos[1] + 0.5) * c];
    g.fillStyle = '#5fd3ff'; g.beginPath(); g.arc(px, py, c * 0.3, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
    // what the maker and the solver say
    const lx = X0() + F.w * c + 50;
    g.fillStyle = '#d8dde6'; g.font = "15px 'Crimson Text', serif";
    const lines = [
      [tr('What the solver found:', 'Was der Löser herausgefunden hat:'), '#ffe4ae'],
      [tr(`fewest slides to the goal: ${sol.slides}`, `wenigste Rutscher bis zum Ziel: ${sol.slides}`), '#d8dde6'],
      [tr(`places you can stop: ${sol.stops}`, `Orte, an denen du anhalten kannst: ${sol.stops}`), '#d8dde6'],
      [tr(`stops that lead nowhere useful: ${sol.decoys}`, `Halte, die nirgendwohin führen: ${sol.decoys}`), '#d8dde6'],
      [tr(`traps you cannot get out of: ${sol.trapped}`, `Fallen, aus denen du nicht rauskommst: ${sol.trapped}`), '#d8dde6'],
      ['', ''],
      [tr(`The maker threw away ${thrown} field${thrown === 1 ? '' : 's'}`, `Der Bauer hat ${thrown} Feld${thrown === 1 ? '' : 'er'} weggeworfen,`), '#ffe4ae'],
      [tr('before this one.', 'bevor dieses kam.'), '#ffe4ae'],
    ];
    lines.forEach(([s, col], i) => { g.fillStyle = col; g.fillText(s, lx, 56 + i * 24); });
  }
  loop(el, dt => {
    if (!anim) { if (queue.length) slide(queue.shift()); return; }
    const dist = Math.hypot(anim.to[0] - anim.from[0], anim.to[1] - anim.from[1]) || 1;
    anim.t += dt * 9 / dist;
    const k = Math.min(1, anim.t), e = 1 - (1 - k) ** 2;
    draw(anim.out && k < 1 ? [anim.from[0] + SD[anim.d][0] * k * 1.2, anim.from[1] + SD[anim.d][1] * k * 1.2] : [anim.from[0] + (anim.to[0] - anim.from[0]) * e, anim.from[1] + (anim.to[1] - anim.from[1]) * e]);
    if (k >= 1) {
      anim = null;
      draw();
      if (at[0] === F.goal.x && at[1] === F.goal.z) {
        done = true;
        out.innerHTML = slides <= sol.slides ? tr(`Solved in <b>${slides}</b> slides: as few as the solver! The gate opens.`, `Gelöst mit <b>${slides}</b> Rutschern: so wenige wie der Löser! Das Tor geht auf.`)
          : tr(`Solved in <b>${slides}</b> slides. The solver needs only <b>${sol.slides}</b>. Can you find its way?`, `Gelöst mit <b>${slides}</b> Rutschern. Der Löser braucht nur <b>${sol.slides}</b>. Findest du seinen Weg?`);
      } else say();
    }
  });
  function say() {
    out.innerHTML = tr(`Slide onto the <b style="color:#ffcf7a">golden plate</b> at the rim. You came in through the green gap; sliding out of it puts you back at the start. Slides so far: <b>${slides}</b>.`,
      `Rutsch auf die <b style="color:#ffcf7a">goldene Platte</b> am Rand. Du bist durch die grüne Lücke hereingekommen; rutschst du hinaus, fängst du wieder am Anfang an. Rutscher bisher: <b>${slides}</b>.`);
  }
  el.addEventListener('keydown', e => { if (e.key in KEYS) { e.preventDefault(); slide(KEYS[e.key]); } });
  row.querySelectorAll('[data-d]').forEach(b => b.onclick = () => slide(+b.dataset.d));
  $('.new').onclick = () => { seed = 1 + Math.floor(Math.random() * 1e6); make(); say(); };
  $('.again').onclick = () => { restart(); say(); };
  $('.way').onclick = () => { restart(); queue = [...sol.way]; say(); };
  $('.depth').oninput = () => { make(); say(); };
  $('.stops').oninput = () => draw();
  make(); say();
}
