// Ask only the lamps that reach, with the game's own lightCells (src/core/lightcells.js): the
// cube's ground in cells of one unit (a little round the cube, like src/render/lighthook.js CELLS,
// CELL0), each cell with the list of the lamps whose light comes into it, the strongest there
// first, at most `max` (16 on the high level, 6 on the lowest: src/game/quality.js). While drawing, a spot
// asks only the lamps on its cell's list, not all of the cube's.
import { lightCells } from '../../src/core/lightcells.js';
import { mulberry32 } from '../../src/core/util.js';
import { canvas, html, t as tr } from '../deck.js';

const W = 640, H = 300, CELLS = 20, FROM = -2, PX = 14, OX = 10, OY = 10;

export default function mount(el) {
  const { c, g, at } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label>${tr('lamps', 'Lampen')} <input type="range" class="n" min="4" max="90" value="46"> <b class="nv"></b></label>
    <label>${tr('at most a cell', 'höchstens pro Zelle')} <input type="range" class="max" min="1" max="16" value="16"> <b class="mv"></b></label>
    <button class="full">${tr('High (16)', 'Hoch (16)')}</button><button class="simple">${tr('Lowest (6)', 'Minimal (6)')}</button></div>`);
  const out = html(el, '<div class="out"></div>');
  html(el, `<p class="small muted" style="margin:6px 0 0">${tr('Point at a cell of the ground.', 'Zeig auf eine Zelle des Bodens.')}</p>`);
  const $ = s => row.querySelector(s);
  const R = mulberry32(3), all = [];
  for (let i = 0; i < 90; i++) all.push({ x: 0.5 + R() * 15, z: 0.5 + R() * 15, reach: 2.2 + R() * 2.6, intensity: 0.6 + R() * 1.4 });
  let hover = [8, 8];
  const sx = x => OX + (x - FROM) * PX, sy = z => OY + (z - FROM) * PX;

  function draw() {
    const n = +$('.n').value, max = +$('.max').value, lights = all.slice(0, n);
    $('.nv').textContent = n; $('.mv').textContent = max;
    const lists = lightCells(lights, { cells: CELLS, from: FROM, max }), full = lightCells(lights, { cells: CELLS, from: FROM, max: 90 });
    const list = (cells, k, m) => { const o = []; for (let j = 0; j < m; j++) { const v = cells[k * m + j]; if (v < 0) break; o.push(v); } return o; };
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    let sum = 0, cut = 0;
    for (let cz = 0; cz < CELLS; cz++) for (let cx = 0; cx < CELLS; cx++) {
      const k = cz * CELLS + cx, mine = list(lists, k, max).length, reach = list(full, k, 90).length;
      sum += mine; if (reach > mine) cut++;
      const v = Math.min(1, mine / 16);
      g.fillStyle = `rgb(${Math.round(20 + 200 * v)},${Math.round(18 + 150 * v)},${Math.round(30 + 60 * v)})`;
      g.fillRect(sx(FROM + cx) + 0.5, sy(FROM + cz) + 0.5, PX - 1, PX - 1);
      if (reach > mine) { g.fillStyle = '#ff6b6b'; g.fillRect(sx(FROM + cx) + PX / 2 - 1.5, sy(FROM + cz) + PX / 2 - 1.5, 3, 3); }
    }
    g.strokeStyle = '#ffffff55'; g.lineWidth = 1.5; g.strokeRect(sx(0), sy(0), 16 * PX, 16 * PX);
    // the cell pointed at, and the lamps on its list
    const [hx, hz] = hover, hk = (hz - FROM) * CELLS + (hx - FROM), mine = list(lists, hk, max), reach = list(full, hk, 90);
    const ccx = sx(hx) + PX / 2, ccz = sy(hz) + PX / 2;
    for (const i of reach) {
      const l = lights[i], on = mine.includes(i);
      g.strokeStyle = on ? '#5fd3ffaa' : '#ff6b6b55'; g.lineWidth = on ? 1.4 : 1;
      g.beginPath(); g.moveTo(ccx, ccz); g.lineTo(sx(l.x), sy(l.z)); g.stroke();
    }
    for (const [i, l] of lights.entries()) {
      const on = mine.includes(i);
      g.fillStyle = on ? '#5fd3ff' : reach.includes(i) ? '#ff8a7a' : '#ffcf7a';
      g.beginPath(); g.arc(sx(l.x), sy(l.z), on ? 4 : 2.6, 0, 7); g.fill();
    }
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(sx(hx), sy(hz), PX, PX);
    // the list
    const lx = 320;
    g.fillStyle = '#d8dde6'; g.font = "15px 'Crimson Text', serif";
    g.fillText(tr(`The list of this cell (${hx}, ${hz}):`, `Die Liste dieser Zelle (${hx}, ${hz}):`), lx, 26);
    g.font = "12px 'IBM Plex Mono', monospace";
    mine.forEach((i, j) => {
      const x = lx + (j % 3) * 104, y = 48 + Math.floor(j / 3) * 18;
      g.fillStyle = '#5fd3ff'; g.fillText(`${j + 1}. ${tr('lamp', 'Lampe')} ${i}`, x, y);
    });
    if (!mine.length) { g.fillStyle = '#8a96a8'; g.fillText(tr('(empty: no lamp reaches here)', '(leer: keine Lampe reicht hierher)'), lx, 48); }
    const left = reach.length - mine.length;
    if (left > 0) { g.fillStyle = '#ff8a7a'; g.fillText(tr(`+ ${left} more reach here, but the list is full`, `+ ${left} weitere reichen her, aber die Liste ist voll`), lx, 48 + Math.ceil(mine.length / 3) * 18 + 4); }
    g.font = "13px 'Crimson Text', serif"; g.fillStyle = '#8a96a8';
    g.fillText(tr('brighter cells: more lamps to ask · red dot: a full list', 'hellere Zellen: mehr Lampen zu fragen · roter Punkt: volle Liste'), lx, H - 14);
    const avg = sum / (CELLS * CELLS);
    out.innerHTML = tr(`A spot here asks <b>${mine.length}</b> lamps, not all <b>${n}</b>. On average a cell asks <b>${avg.toFixed(1)}</b>.`,
      `Ein Fleck hier fragt <b>${mine.length}</b> Lampen, nicht alle <b>${n}</b>. Im Schnitt fragt eine Zelle <b>${avg.toFixed(1).replace('.', ',')}</b>.`)
      + (cut ? tr(` In <b>${cut}</b> cells more lamps reach than the list holds: the faintest there are left out.`, ` In <b>${cut}</b> Zellen reichen mehr Lampen hin, als die Liste fasst: Die schwächsten dort fallen weg.`) : '');
  }
  c.addEventListener('pointermove', e => {
    const [x, y] = at(e), cx = Math.floor((x - OX) / PX) + FROM, cz = Math.floor((y - OY) / PX) + FROM;
    if (cx >= FROM && cz >= FROM && cx < FROM + CELLS && cz < FROM + CELLS) { hover = [cx, cz]; draw(); }
  });
  $('.full').onclick = () => { $('.max').value = 16; draw(); };
  $('.simple').onclick = () => { $('.max').value = 6; draw(); };
  row.querySelectorAll('input').forEach(i => i.oninput = draw);
  draw();
}
