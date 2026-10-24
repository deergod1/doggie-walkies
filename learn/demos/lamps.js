// Many lamps, seen from above: every pixel adds up the light of every lamp, and for each lamp asks
// whether a wall is in the way (walking the line between them). It really runs here, on the
// computer's main chip (the game does it on the graphics card, much faster, but the bill grows the
// same way), so its time is real: add lamps and watch it slow down. Then the ways out:
//   only the nearest lamps (what many games do: the far ones go dark, and pop on as you come near)
//   work out once what stays (the game's way, src/render/bake.js): the fixed lamps' light is
//     baked when they change, a few lamps a frame, and comes on when it is done; only the moving
//     lamp (yours) is worked out every frame
//   data-show="bake": starts the third way
import { canvas, loop, html, t as tr, lang } from '../deck.js';
import { mulberry32 } from '../../src/core/util.js';

const W = 640, H = 320, S = 2, GW = W / S, GH = H / S, REACH = 42, HERO_REACH = 34, STEPS = 2, NEAREST = 4;
const COLORS = [[1, 0.7, 0.35], [1, 0.55, 0.25], [0.6, 1, 0.45], [0.75, 0.55, 1], [1, 0.85, 0.55], [0.45, 0.85, 1]];

export default function mount(el) {
  const { c, g, at } = canvas(el, W, H);
  const row = html(el, `<div><div class="row">
    <label><input type="radio" class="m-all" checked> ${tr('every lamp, every frame', 'jede Lampe, jedes Bild')}</label>
    <label><input type="radio" class="m-near"> ${tr(`only the ${NEAREST} nearest`, `nur die ${NEAREST} nächsten`)}</label>
    <label><input type="radio" class="m-bake"> ${tr('work out once what stays', 'einmal ausrechnen, was bleibt')}</label></div>
    <div class="row"><button class="more">${tr('+ 8 lamps', '+ 8 Lampen')}</button><button class="less">${tr('− 8 lamps', '− 8 Lampen')}</button>
    <label><input type="checkbox" class="shadows" checked> ${tr('shadows', 'Schatten')}</label></div></div>`);
  const group = 'lamps-' + Math.random().toString(36).slice(2);
  row.querySelectorAll('input[type=radio]').forEach(r => { r.name = group; });
  if (el.dataset.show === 'bake') row.querySelector('.m-bake').checked = true;
  const out = html(el, '<div class="out"></div>');
  html(el, `<p class="small muted" style="margin:6px 0 0">${tr('You are the cyan dot with a lamp: it follows the mouse. Drag a lamp to move it.', 'Du bist der türkise Punkt mit einer Lampe: Er folgt der Maus. Zieh eine Lampe, um sie zu verschieben.')}</p>`);
  const $ = s => row.querySelector(s);

  // the room: walls round it, pillars, and walls with doorways
  const solid = new Uint8Array(GW * GH);
  const box = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) solid[y * GW + x] = 1; };
  box(0, 0, GW, 4); box(0, GH - 4, GW, GH); box(0, 0, 4, GH); box(GW - 4, 0, GW, GH);
  box(104, 4, 108, 60); box(104, 84, 108, GH); box(216, 4, 220, 96); box(216, 120, 220, GH);
  for (const [x, y] of [[40, 40], [64, 104], [150, 50], [170, 110], [260, 40], [280, 110]]) box(x, y, x + 10, y + 10);
  const free = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH && !solid[(y | 0) * GW + (x | 0)];
  const R = mulberry32(11), lamps = [];
  function addLamps(n) {
    for (let i = 0; i < n && lamps.length < 128; i++) {
      let x, y;
      do { x = 6 + R() * (GW - 12); y = 6 + R() * (GH - 12); } while (!free(x, y) || !free(x + 2, y) || !free(x - 2, y) || !free(x, y + 2) || !free(x, y - 2));
      lamps.push({ x, y, c: COLORS[lamps.length % COLORS.length] });
    }
  }
  addLamps(16);
  const hero = { x: 60, y: 80 }, aim = { x: 60, y: 80 };
  const live = new Float32Array(GW * GH * 3), baked = new Float32Array(GW * GH * 3), baking = new Float32Array(GW * GH * 3);
  let bake = { next: 0, done: false, on: 0 }, drag = null, stats = { asks: 0, steps: 0 };
  const img = g.createImageData(GW, GH), small = document.createElement('canvas');
  small.width = GW; small.height = GH;
  const sg = small.getContext('2d');

  // a wall between a pixel and a lamp? walk the line in steps of one pixel
  function seen(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy));
    for (let i = 1; i < n; i++) {
      stats.steps++;
      if (solid[((y0 + dy * i / n) | 0) * GW + ((x0 + dx * i / n) | 0)]) return false;
    }
    return true;
  }
  // one lamp's light, added into buf
  function shine(buf, l, reach, gain = 1) {
    const shadows = $('.shadows').checked;
    const x0 = Math.max(0, Math.floor(l.x - reach)), x1 = Math.min(GW, Math.ceil(l.x + reach)), y0 = Math.max(0, Math.floor(l.y - reach)), y1 = Math.min(GH, Math.ceil(l.y + reach));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = y * GW + x;
      if (solid[i]) continue;
      const d = Math.hypot(x + 0.5 - l.x, y + 0.5 - l.y);
      if (d >= reach) continue;
      if (shadows && !seen(x + 0.5, y + 0.5, l.x, l.y)) continue;
      const k = (1 - d / reach) ** 2 * gain;
      buf[i * 3] += l.c[0] * k; buf[i * 3 + 1] += l.c[1] * k; buf[i * 3 + 2] += l.c[2] * k;
    }
  }
  const mode = () => $('.m-near').checked ? 'near' : $('.m-bake').checked ? 'bake' : 'all';
  const rebake = () => { bake = { next: 0, done: false, on: 0 }; baking.fill(0); };
  const ms = [];

  loop(el, (dt, now) => {
    // walk towards the mouse, not through walls
    const dx = aim.x - hero.x, dy = aim.y - hero.y, d = Math.hypot(dx, dy), step = Math.min(d, dt * 90);
    if (d > 0.5) { const nx = hero.x + dx / d * step, ny = hero.y + dy / d * step; if (free(nx, hero.y)) hero.x = nx; if (free(hero.x, ny)) hero.y = ny; }
    const m = mode(), t0 = performance.now();
    stats = { asks: 0, steps: 0 };
    live.fill(0);
    let lit = lamps;
    if (m === 'near') lit = [...lamps].sort((a, b) => Math.hypot(a.x - hero.x, a.y - hero.y) - Math.hypot(b.x - hero.x, b.y - hero.y)).slice(0, NEAREST);
    if (m === 'bake') {
      // a few lamps a frame into the bake; the one being dragged shines live meanwhile
      if (!bake.done) {
        for (let k = 0; k < STEPS && bake.next < lamps.length; k++, bake.next++) if (lamps[bake.next] !== drag) shine(baking, lamps[bake.next], REACH);
        if (bake.next >= lamps.length) { baked.set(baking); bake.done = true; bake.on = 0; }
      } else bake.on = Math.min(1, bake.on + dt / 0.35);
      if (drag) shine(live, drag, REACH);
      shine(live, { ...hero, c: [0.9, 0.95, 1] }, HERO_REACH);
      stats.asks = GW * GH * (2 + (bake.done ? 0 : STEPS));
    } else {
      for (const l of lit) shine(live, l, REACH);
      shine(live, { ...hero, c: [0.9, 0.95, 1] }, HERO_REACH);
      stats.asks = GW * GH * (lit.length + 1);
    }
    const took = performance.now() - t0;
    ms.push(took); if (ms.length > 20) ms.shift();
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    // the picture
    const on = m === 'bake' && bake.done ? bake.on : 0;
    for (let i = 0; i < GW * GH; i++) {
      const o = i * 4;
      if (solid[i]) { img.data[o] = 64; img.data[o + 1] = 56; img.data[o + 2] = 48; img.data[o + 3] = 255; continue; }
      const r = 0.035 + live[i * 3] + baked[i * 3] * on, gg = 0.03 + live[i * 3 + 1] + baked[i * 3 + 1] * on, b = 0.04 + live[i * 3 + 2] + baked[i * 3 + 2] * on;
      // (softly, so many lamps together don't all go white)
      img.data[o] = 255 * (1 - Math.exp(-r * 1.1)); img.data[o + 1] = 255 * (1 - Math.exp(-gg)); img.data[o + 2] = 255 * (1 - Math.exp(-b * 0.9)); img.data[o + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, W, H);
    for (const l of lamps) {
      const shining = m === 'all' || (m === 'near' && lit.includes(l)) || (m === 'bake' && (bake.done || l === drag));
      g.beginPath(); g.arc(l.x * S, l.y * S, 4.5, 0, 7);
      if (shining) { g.fillStyle = `rgb(${l.c.map(v => Math.round(255 * v)).join(',')})`; g.fill(); }
      else { g.strokeStyle = '#8a96a8'; g.lineWidth = 1.5; g.stroke(); }
    }
    g.fillStyle = '#5fd3ff'; g.beginPath(); g.arc(hero.x * S, hero.y * S, 6, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    // the time it took, against the game's 16 ms
    const bw = 180, bx = W - bw - 12, by = 12, frac = Math.min(1, avg / 50);
    g.fillStyle = '#000a'; g.fillRect(bx - 6, by - 4, bw + 12, 34);
    g.fillStyle = '#ffffff22'; g.fillRect(bx, by + 12, bw, 10);
    g.fillStyle = avg > 16 ? '#ff8a7a' : '#70d6aa'; g.fillRect(bx, by + 12, bw * frac, 10);
    g.fillStyle = '#ffcf7a'; g.fillRect(bx + bw * 16 / 50, by + 9, 2, 16);
    g.fillStyle = '#d8dde6'; g.font = "12px 'Crimson Text', serif";
    g.fillText(tr(`${fmt(avg)} ms a picture (| = 16 ms)`, `${fmt(avg)} ms pro Bild (| = 16 ms)`), bx, by + 7);
    if (now - shown > 0.25) { shown = now; say(m, lit.length, avg); }
  });
  let shown = 0;
  const fmt = n => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 }).format(n);
  function say(m, n, avg) {
    const head = tr(`<b>${lamps.length}</b> lamps. Questions this picture: <b>${fmt(stats.asks)}</b>, steps along lines to look for walls: <b>${fmt(stats.steps)}</b>. `,
      `<b>${lamps.length}</b> Lampen. Fragen in diesem Bild: <b>${fmt(stats.asks)}</b>, Schritte entlang von Linien, um nach Wänden zu schauen: <b>${fmt(stats.steps)}</b>. `);
    const tail = m === 'all' ? (avg > 16 ? tr('Too slow for 60 pictures a second!', 'Zu langsam für 60 Bilder pro Sekunde!') : tr('Still fast enough. Add more lamps.', 'Noch schnell genug. Gib mehr Lampen dazu.'))
      : m === 'near' ? tr(`Fast, but only ${NEAREST} lamps shine. Walk around: the far ones go dark and pop on as you come near.`, `Schnell, aber nur ${NEAREST} Lampen leuchten. Lauf herum: Die fernen gehen aus und springen an, wenn du näher kommst.`)
      : !bake.done ? tr(`Working out the lamps that stay, ${STEPS} a picture: ${Math.min(bake.next, lamps.length)} of ${lamps.length}. They come on when it is done.`, `Die Lampen, die bleiben, werden ausgerechnet, ${STEPS} pro Bild: ${Math.min(bake.next, lamps.length)} von ${lamps.length}. Wenn es fertig ist, gehen sie an.`)
      : tr('Every lamp shines, with its shadows, and it is fast: only your own lamp is worked out every picture. Move a lamp, and its light has to be worked out again.', 'Jede Lampe leuchtet, mit ihren Schatten, und es ist schnell: Nur deine eigene Lampe wird in jedem Bild ausgerechnet. Verschieb eine Lampe, und ihr Licht muss neu ausgerechnet werden.');
    out.innerHTML = head + tail;
  }
  c.addEventListener('pointerdown', e => {
    const [x, y] = at(e);
    drag = lamps.find(l => Math.hypot(l.x * S - x, l.y * S - y) < 14) ?? null;
    if (!drag) return;
    c.setPointerCapture(e.pointerId);
    // a lamp that moves is a moving light: its baked light comes out (worked out once more, taken away)
    if (mode() === 'bake') { if (bake.done) shine(baked, drag, REACH, -1); else rebake(); }
  });
  c.addEventListener('pointermove', e => {
    const [x, y] = at(e);
    if (drag) { if (free(x / S, y / S)) { drag.x = x / S; drag.y = y / S; } }
    else { aim.x = x / S; aim.y = y / S; }
  });
  // put down, it stays again: only its light is baked anew
  c.addEventListener('pointerup', () => { if (drag && mode() === 'bake') { if (bake.done) shine(baked, drag, REACH); else rebake(); } drag = null; });
  $('.more').onclick = () => { addLamps(8); rebake(); };
  $('.less').onclick = () => { lamps.splice(Math.max(1, lamps.length - 8)); rebake(); };
  $('.shadows').oninput = rebake;
  row.querySelectorAll('input[type=radio]').forEach(r => r.oninput = rebake);
}
