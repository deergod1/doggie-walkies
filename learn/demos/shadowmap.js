// A shadow map in 2D: before drawing, the light takes a picture of how far it can see in every
// direction (a lamp: all round; the sun: straight along its rays). Then every spot asks: "am I
// further from the light than what its picture saw that way?" If so, something is in the way: a
// shadow. In 2D the picture is just a row of distances (the strip at the bottom); in 3D a lamp
// needs six square pictures, one for each side of a cube round it (src/render/bake.js), the sun
// one. With few pixels in the picture, the shadows come out jagged.
import { canvas, html, t as tr } from '../deck.js';

const W = 640, H = 300, RH = 220, S = 4;
const BLOCKS = [[150, 60, 200, 110], [300, 130, 380, 150], [430, 40, 450, 120], [520, 150, 580, 190], [90, 160, 120, 190]];

export default function mount(el) {
  const { c, g, at } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label><input type="radio" name="sm-kind" class="lampk" checked> ${tr('a lamp', 'eine Lampe')}</label>
    <label><input type="radio" name="sm-kind" class="sunk"> ${tr('the sun', 'die Sonne')}</label>
    <label>${tr('pixels in the picture', 'Pixel im Bild')} <input type="range" class="res" min="3" max="9" step="1" value="7"> <b class="rv"></b></label></div>`);
  const group = 'sm-kind-' + Math.random().toString(36).slice(2);
  row.querySelectorAll('input[type=radio]').forEach(r => { r.name = group; });
  const out = html(el, '<div class="out"></div>');
  html(el, `<p class="small muted" style="margin:6px 0 0">${tr('Drag the lamp. Point anywhere in the room to ask its question.', 'Zieh die Lampe. Zeig irgendwo in den Raum, um seine Frage zu stellen.')}</p>`);
  const $ = s => row.querySelector(s);
  const lamp = { x: 250, y: 100 };
  const SUN = [Math.cos(0.6), Math.sin(0.6)], ACROSS = [-SUN[1], SUN[0]];
  let hover = { x: 470, y: 170 }, drag = false;

  // how far a ray from (x, y) along (dx, dy) goes before it hits a block (Infinity: nothing; the
  // room's walls cast no shadow into the room)
  function rayDist(x, y, dx, dy) {
    let best = Infinity;
    for (const [x0, y0, x1, y1] of BLOCKS) {
      const tx0 = (x0 - x) / dx, tx1 = (x1 - x) / dx, ty0 = (y0 - y) / dy, ty1 = (y1 - y) / dy;
      const tn = Math.max(Math.min(tx0, tx1), Math.min(ty0, ty1)), tf = Math.min(Math.max(tx0, tx1), Math.max(ty0, ty1));
      if (tf >= Math.max(tn, 0) && tn > 0) best = Math.min(best, tn);
    }
    return best;
  }
  const inBlock = (x, y) => BLOCKS.some(([x0, y0, x1, y1]) => x >= x0 && x < x1 && y >= y0 && y < y1);
  // the sun's rays start on a line beyond the room's top left corner; lanes across them
  const sunStart = p => (p[0] * SUN[0] + p[1] * SUN[1]) + 60, lane = p => p[0] * ACROSS[0] + p[1] * ACROSS[1];
  const corners = [[0, 0], [W, 0], [0, RH], [W, RH]].map(lane), lane0 = Math.min(...corners), lane1 = Math.max(...corners);

  // the picture: N distances
  function picture(sun, n) {
    const map = new Float32Array(n);
    for (let k = 0; k < n; k++) {
      if (!sun) { const a = (k + 0.5) / n * Math.PI * 2; map[k] = rayDist(lamp.x, lamp.y, Math.cos(a), Math.sin(a)); continue; }
      // the lane's ray, from where it comes into the room
      const s = lane0 + (k + 0.5) / n * (lane1 - lane0), ox = ACROSS[0] * s - SUN[0] * 900, oy = ACROSS[1] * s - SUN[1] * 900;
      let t = 0;
      for (const tt of [(0 - ox) / SUN[0], (0 - oy) / SUN[1]]) t = Math.max(t, tt);
      let hit = Infinity;
      for (let u = t; u < t + 1400; u += 1.5) {
        const x = ox + SUN[0] * u, y = oy + SUN[1] * u;
        if (x > W || y > RH) break;
        if (x >= 0 && y >= 0 && inBlock(x, y)) { hit = sunStart([x, y]); break; }
      }
      map[k] = hit;
    }
    return map;
  }
  // the question one spot asks: { mine, seen, k, lit }
  function ask(sun, map, x, y) {
    const n = map.length;
    if (!sun) {
      const dx = x - lamp.x, dy = y - lamp.y, a = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      const k = Math.min(n - 1, Math.floor(a / (Math.PI * 2) * n)), mine = Math.hypot(dx, dy);
      return { mine, seen: map[k], k, lit: mine <= map[k] + 1 };
    }
    const k = Math.max(0, Math.min(n - 1, Math.floor((lane([x, y]) - lane0) / (lane1 - lane0) * n))), mine = sunStart([x, y]);
    return { mine, seen: map[k], k, lit: mine <= map[k] + 1 };
  }

  function draw() {
    const sun = $('.sunk').checked, n = 2 ** +$('.res').value, map = picture(sun, n);
    $('.rv').textContent = n;
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < RH; y += S) for (let x = 0; x < W; x += S) {
      if (inBlock(x + S / 2, y + S / 2)) continue;
      const q = ask(sun, map, x + S / 2, y + S / 2);
      const b = !q.lit ? 0.06 : sun ? 0.85 : Math.max(0.06, 1 - q.mine / 420);
      g.fillStyle = `rgb(${Math.round(255 * b)},${Math.round(225 * b)},${Math.round(160 * b)})`;
      g.fillRect(x, y, S, S);
    }
    g.fillStyle = '#5a4e44';
    for (const [x0, y0, x1, y1] of BLOCKS) g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const q = ask(sun, map, hover.x, hover.y);
    // what the light saw that way, and the spot's own distance
    g.lineWidth = 2;
    if (!sun) {
      const a = (q.k + 0.5) / n * Math.PI * 2, a0 = q.k / n * Math.PI * 2, a1 = (q.k + 1) / n * Math.PI * 2;
      g.fillStyle = '#5fd3ff22'; g.beginPath(); g.moveTo(lamp.x, lamp.y); g.arc(lamp.x, lamp.y, Math.min(q.seen, 700), a0, a1); g.closePath(); g.fill();
      g.strokeStyle = '#5fd3ff'; g.beginPath(); g.moveTo(lamp.x, lamp.y); g.lineTo(lamp.x + Math.cos(a) * Math.min(q.seen, 700), lamp.y + Math.sin(a) * Math.min(q.seen, 700)); g.stroke();
      g.strokeStyle = q.lit ? '#70d6aa' : '#ff8a7a'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(lamp.x, lamp.y); g.lineTo(hover.x, hover.y); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(lamp.x, lamp.y, 8, 0, 7); g.fill(); g.strokeStyle = '#ffcf7a'; g.stroke();
    } else {
      const s = lane0 + (q.k + 0.5) / n * (lane1 - lane0), dxs = (lane1 - lane0) / n / 2;
      g.fillStyle = '#5fd3ff1c';
      const p = (sv, u) => [ACROSS[0] * sv + SUN[0] * u, ACROSS[1] * sv + SUN[1] * u];
      const u0 = -60 - 0, u1 = q.seen === Infinity ? 1200 : q.seen - 60;
      g.beginPath(); g.moveTo(...p(s - dxs, u0)); g.lineTo(...p(s + dxs, u0)); g.lineTo(...p(s + dxs, u1)); g.lineTo(...p(s - dxs, u1)); g.fill();
      g.strokeStyle = '#ffcf7a'; g.fillStyle = '#ffcf7a';
      for (let k = 0; k < 4; k++) { const ox = 30 + k * 22, oy = 14; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + SUN[0] * 18, oy + SUN[1] * 18); g.stroke(); }
      g.font = "13px 'Crimson Text', serif"; g.fillText(tr('sunlight', 'Sonnenlicht'), 120, 26);
    }
    g.fillStyle = q.lit ? '#70d6aa' : '#ff8a7a'; g.beginPath(); g.arc(hover.x, hover.y, 5, 0, 7); g.fill();
    // the picture as a strip: one square a pixel, brighter where the light sees far
    const sy = RH + 22, sw = W - 40;
    g.fillStyle = '#d8dde6'; g.font = "13px 'Crimson Text', serif";
    g.fillText(sun ? tr('the sun\'s picture: how far it sees along each lane', 'das Bild der Sonne: wie weit sie entlang jeder Bahn sieht')
      : tr('the lamp\'s picture: how far it sees in each direction, all the way round', 'das Bild der Lampe: wie weit sie in jede Richtung sieht, einmal rundherum'), 20, sy - 6);
    for (let k = 0; k < n; k++) {
      const v = map[k] === Infinity ? 1 : Math.min(1, map[k] / (sun ? 900 : 500));
      g.fillStyle = `rgb(${Math.round(40 + 200 * v)},${Math.round(40 + 180 * v)},${Math.round(50 + 130 * v)})`;
      g.fillRect(20 + k * sw / n, sy, sw / n + 0.5, 30);
    }
    g.strokeStyle = '#5fd3ff'; g.lineWidth = 2; g.strokeRect(20 + q.k * sw / n, sy - 2, sw / n, 34);
    const f = v => Math.round(v / 20), who = sun ? tr('sun', 'Sonne') : tr('lamp', 'Lampe');
    out.innerHTML = q.seen === Infinity
      ? tr(`The picture says the ${who} sees nothing in the way in this direction: <b style="color:#70d6aa">lit</b>.`, `Das Bild sagt, die ${who} sieht in dieser Richtung nichts im Weg: <b style="color:#70d6aa">hell</b>.`)
      : tr(`This spot is <b>${f(q.mine)}</b> steps from the ${sun ? 'sun\'s line' : 'lamp'}. The picture says the ${who} sees <b>${f(q.seen)}</b> steps that way. ${q.lit ? 'Not further: <b style="color:#70d6aa">lit</b>.' : 'Further: something is in the way, <b style="color:#ff8a7a">shadow</b>.'}`,
        `Dieser Fleck ist <b>${f(q.mine)}</b> Schritte von ${sun ? 'der Linie der Sonne' : 'der Lampe'} weg. Das Bild sagt, die ${who} sieht in diese Richtung <b>${f(q.seen)}</b> Schritte weit. ${q.lit ? 'Nicht weiter: <b style="color:#70d6aa">hell</b>.' : 'Weiter: Etwas ist im Weg, <b style="color:#ff8a7a">Schatten</b>.'}`)
      + (n <= 16 ? tr(' With so few pixels the shadows have steps.', ' Mit so wenigen Pixeln haben die Schatten Stufen.') : '');
  }
  c.addEventListener('pointerdown', e => {
    const [x, y] = at(e);
    if (!$('.sunk').checked && Math.hypot(x - lamp.x, y - lamp.y) < 22) { drag = true; c.setPointerCapture(e.pointerId); }
    else if (y < RH) { hover = { x, y }; draw(); }
  });
  c.addEventListener('pointermove', e => {
    const [x, y] = at(e);
    if (drag) { if (!inBlock(x, y) && y < RH - 4 && y > 4 && x > 4 && x < W - 4) { lamp.x = x; lamp.y = y; } }
    else if (y < RH) hover = { x, y };
    draw();
  });
  c.addEventListener('pointerup', () => { drag = false; });
  row.querySelectorAll('input').forEach(i => i.oninput = draw);
  draw();
}
