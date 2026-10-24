// Sharing the lightmap's paint pots, like assignChannels in src/render/bake.js: the lightmap keeps
// every lamp's shadow in a channel (one colour of one of its pictures: three pictures of four, one
// for the sun, so eleven for lamps). Two lamps whose light overlaps must not share one, or their
// shadows would mix up; lamps far apart can. The brightest lamp first, each takes the first pot
// none of its neighbours has (greedy colouring, like colouring a map so that no two countries
// next to each other have the same colour). A lamp left without a pot shines without a shadow.
// (The game also lets a lamp share the pot of one right next to it, the lanterns on a string:
// left out here.)
import { canvas, html, t as tr } from '../deck.js';

const W = 640, H = 300, REACH = 0.85;
const POTS = ['#ff6b6b', '#ffcf3a', '#5fd3ff', '#70d6aa', '#b98cff', '#ff9a3a', '#3a8cff', '#ff7ad8', '#a6e05a', '#ffffff', '#c48a5a'];

export default function mount(el) {
  const { c, g, at } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label>${tr('pots', 'Farbtöpfe')} <input type="range" class="k" min="1" max="11" value="4"> <b class="kv"></b></label>
    <button class="add">${tr('+ lamp', '+ Lampe')}</button><button class="del">${tr('− lamp', '− Lampe')}</button><button class="mix">${tr('Jumble', 'Durcheinander')}</button></div>`);
  const out = html(el, '<div class="out"></div>');
  html(el, `<p class="small muted" style="margin:6px 0 0">${tr('Drag the lamps. The circles show how far their light reaches; a line joins lamps whose light overlaps.', 'Zieh die Lampen. Die Kreise zeigen, wie weit ihr Licht reicht; eine Linie verbindet Lampen, deren Licht sich überlappt.')}</p>`);
  const $ = s => row.querySelector(s);
  let lamps = [], drag = null;
  const add = () => lamps.push({ x: 40 + Math.random() * (W - 80), y: 30 + Math.random() * (H - 60), r: 45 + Math.random() * 55 });
  function jumble() { lamps = []; for (let i = 0; i < 14; i++) add(); }
  const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * REACH;

  function assign() {
    const k = +$('.k').value, order = [...lamps].sort((a, b) => b.r - a.r);
    for (const l of order) l.pot = -1;
    for (const l of order) {
      const taken = new Set(order.filter(o => o !== l && o.pot >= 0 && near(o, l)).map(o => o.pot));
      for (let p = 0; p < k; p++) if (!taken.has(p)) { l.pot = p; break; }
    }
  }
  function draw() {
    assign();
    $('.kv').textContent = $('.k').value;
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    for (const l of lamps) {
      const col = l.pot >= 0 ? POTS[l.pot] : '#8a96a8';
      const grd = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      grd.addColorStop(0, col + '55'); grd.addColorStop(1, col + '00');
      g.fillStyle = grd; g.beginPath(); g.arc(l.x, l.y, l.r, 0, 7); g.fill();
      g.strokeStyle = col + '66'; g.lineWidth = 1; g.beginPath(); g.arc(l.x, l.y, l.r * REACH, 0, 7); g.stroke();
    }
    g.lineWidth = 1.2;
    for (let i = 0; i < lamps.length; i++) for (let j = i + 1; j < lamps.length; j++) if (near(lamps[i], lamps[j])) {
      g.strokeStyle = lamps[i].pot >= 0 && lamps[i].pot === lamps[j].pot ? '#ff4040' : '#ffffff40';
      g.beginPath(); g.moveTo(lamps[i].x, lamps[i].y); g.lineTo(lamps[j].x, lamps[j].y); g.stroke();
    }
    g.font = "bold 12px 'IBM Plex Mono', monospace"; g.textAlign = 'center';
    for (const l of lamps) {
      g.beginPath(); g.arc(l.x, l.y, 10, 0, 7);
      if (l.pot >= 0) { g.fillStyle = POTS[l.pot]; g.fill(); g.fillStyle = '#000'; g.fillText(l.pot + 1, l.x, l.y + 4); }
      else { g.fillStyle = '#07080c'; g.fill(); g.strokeStyle = '#d8dde6'; g.lineWidth = 2; g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]); }
    }
    g.textAlign = 'left';
    const none = lamps.filter(l => l.pot < 0).length;
    out.innerHTML = tr(`<b>${lamps.length}</b> lamps share <b>${$('.k').value}</b> pots. `, `<b>${lamps.length}</b> Lampen teilen sich <b>${$('.k').value}</b> Farbtöpfe. `)
      + (none ? tr(`<b style="color:#ff9a8a">${none}</b> found no free pot: ${none === 1 ? 'it shines' : 'they shine'} without a shadow (dashed).`, `<b style="color:#ff9a8a">${none}</b> ${none === 1 ? 'hat' : 'haben'} keinen freien Topf gefunden: ${none === 1 ? 'Sie leuchtet' : 'Sie leuchten'} ohne Schatten (gestrichelt).`)
        : tr('Every lamp has a pot, and no two neighbours share one.', 'Jede Lampe hat einen Topf, und keine zwei Nachbarn teilen sich einen.'));
  }
  c.addEventListener('pointerdown', e => {
    const [x, y] = at(e);
    drag = lamps.find(l => Math.hypot(l.x - x, l.y - y) < 16) ?? null;
    if (drag) c.setPointerCapture(e.pointerId);
  });
  c.addEventListener('pointermove', e => { if (!drag) return; const [x, y] = at(e); drag.x = Math.max(10, Math.min(W - 10, x)); drag.y = Math.max(10, Math.min(H - 10, y)); draw(); });
  c.addEventListener('pointerup', () => { drag = null; });
  $('.k').oninput = draw;
  $('.add').onclick = () => { add(); draw(); };
  $('.del').onclick = () => { lamps.pop(); draw(); };
  $('.mix').onclick = () => { jumble(); draw(); };
  jumble();
  draw();
}
