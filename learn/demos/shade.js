// How bright is a spot? The rules the game's shaders follow for every pixel (three.js's lights,
// src/render/lighthook.js), seen from the side on a strip of hilly ground: how much the spot
// faces the lamp, how close the lamp is (its light reaches only so far), and the colours of the
// light and of the ground, multiplied. With more lamps, their light is added up. Nothing blocks
// the light here: shadows are another question (next slides).
//   data-show="rules": one lamp, the three rules as bars;  "add": several lamps and the sky light
import { canvas, html, t as tr } from '../deck.js';

const W = 640, H = 300;
const LAMPS = { warm: [1, 0.78, 0.45], white: [1, 1, 1], red: [1, 0.15, 0.1], green: [0.15, 1, 0.2], blue: [0.2, 0.35, 1] };
const GROUNDS = { grass: [0.45, 0.75, 0.3], snow: [0.95, 0.95, 0.98], sand: [0.9, 0.75, 0.5], leaf: [0.1, 0.8, 0.15] };
const NAME = { warm: ['warm', 'warm'], white: ['white', 'weiß'], red: ['red', 'rot'], green: ['green', 'grün'], blue: ['blue', 'blau'],
  grass: ['grass', 'Gras'], snow: ['snow', 'Schnee'], sand: ['sand', 'Sand'], leaf: ['green leaf', 'grünes Blatt'] };
const opts = (o, sel) => Object.keys(o).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${tr(...NAME[k])}</option>`).join('');

export default function mount(el) {
  const mode = el.dataset.show === 'add' ? 'add' : 'rules';
  const { c, g, at } = canvas(el, W, H);
  const row = html(el, mode === 'rules'
    ? `<div class="row"><label>${tr('lamp', 'Lampe')} <select class="lc">${opts(LAMPS, 'warm')}</select></label>
       <label>${tr('ground', 'Boden')} <select class="gc">${opts(GROUNDS, 'grass')}</select></label>
       <label>${tr('reach', 'Reichweite')} <input type="range" class="reach" min="80" max="500" value="260"></label></div>`
    : `<div class="row"><label><input type="checkbox" class="on0" checked> ${tr('red lamp', 'rote Lampe')}</label>
       <label><input type="checkbox" class="on1" checked> ${tr('green lamp', 'grüne Lampe')}</label>
       <label><input type="checkbox" class="on2" checked> ${tr('blue lamp', 'blaue Lampe')}</label>
       <label>${tr('sky light', 'Himmelslicht')} <input type="range" class="sky" min="0" max="40" value="6"></label>
       <label>${tr('ground', 'Boden')} <select class="gc">${opts(GROUNDS, 'snow')}</select></label></div>`);
  const out = html(el, '<div class="out"></div>');
  html(el, `<p class="small muted" style="margin:6px 0 0">${tr('Drag the lamps. Point at the ground to see how one spot gets its colour.', 'Zieh die Lampen. Zeig auf den Boden, um zu sehen, wie ein Fleck seine Farbe bekommt.')}</p>`);
  const $ = s => row.querySelector(s);
  // the ground: a line of short pieces over hills
  const ground = x => 205 + 34 * Math.sin(x / 70) + 16 * Math.sin(x / 23 + 2) - (x > 380 && x < 470 ? 40 * Math.sin((x - 380) / 90 * Math.PI) : 0);
  const pts = [];
  for (let x = 0; x <= W; x += 6) pts.push([x, ground(x)]);
  const lamps = mode === 'rules' ? [{ x: 250, y: 80 }] : [{ x: 200, y: 70, c: LAMPS.red }, { x: 330, y: 60, c: LAMPS.green }, { x: 450, y: 90, c: LAMPS.blue }];
  let hover = 300, drag = null;

  const reachOf = () => mode === 'rules' ? +$('.reach').value : 300;
  // the light one lamp gives a spot (x, y) with the way it faces (nx, ny): the three rules
  function rules(l, x, y, nx, ny) {
    const dx = l.x - x, dy = l.y - y, d = Math.hypot(dx, dy) || 1;
    const facing = Math.max(0, (dx * nx + dy * ny) / d);
    const closeness = Math.max(0, 1 - d / reachOf()) ** 2;
    return { facing, closeness, d };
  }
  function colourAt(i) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
    const nx = (y1 - y0) / len, ny = -(x1 - x0) / len, x = (x0 + x1) / 2, y = (y0 + y1) / 2;
    const gc = GROUNDS[$('.gc').value], sky = mode === 'add' ? $('.sky').value / 100 : 0.04;
    const per = lamps.map((l, k) => {
      const on = mode === 'rules' || $('.on' + k).checked, lc = mode === 'rules' ? LAMPS[$('.lc').value] : l.c;
      const r = rules(l, x, y, nx, ny), s = on ? r.facing * r.closeness * 1.6 : 0;
      return { ...r, on, lc, rgb: lc.map((v, j) => v * s * gc[j]) };
    });
    const rgb = [0, 1, 2].map(j => gc[j] * sky + per.reduce((a, p) => a + p.rgb[j], 0));
    return { rgb, per, x, y, nx, ny, gc };
  }
  const css = (rgb, k = 1) => `rgb(${rgb.map(v => Math.round(255 * Math.min(1, v * k))).join(',')})`;

  function draw() {
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < pts.length - 1; i++) {
      const { rgb } = colourAt(i), [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      g.fillStyle = css(rgb);
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x1, H); g.lineTo(x0, H); g.fill();
    }
    g.fillStyle = '#0006';
    g.beginPath(); g.moveTo(0, H);
    for (const [x, y] of pts) g.lineTo(x, y + 14);
    g.lineTo(W, H); g.fill();
    // the spot pointed at: its normal (the way it faces) and the line to each lamp
    const i = Math.max(0, Math.min(pts.length - 2, Math.floor(hover / 6))), s = colourAt(i);
    for (const [k, l] of lamps.entries()) {
      if (!s.per[k].on) continue;
      g.strokeStyle = s.per[k].facing > 0 && s.per[k].closeness > 0 ? '#ffffffaa' : '#ff8a7a88';
      g.setLineDash([4, 4]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(l.x, l.y); g.stroke(); g.setLineDash([]);
    }
    g.strokeStyle = '#5fd3ff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x + s.nx * 40, s.y + s.ny * 40); g.stroke();
    g.fillStyle = '#5fd3ff'; g.beginPath(); g.arc(s.x, s.y, 4, 0, 7); g.fill();
    for (const [k, l] of lamps.entries()) {
      const on = mode === 'rules' || $('.on' + k).checked, lc = mode === 'rules' ? LAMPS[$('.lc').value] : l.c;
      g.fillStyle = on ? css(lc) : '#333'; g.beginPath(); g.arc(l.x, l.y, 10, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    }
    if (mode === 'rules') {
      const p = s.per[0];
      bars([[tr('faces the lamp', 'zeigt zur Lampe'), p.facing, '#5fd3ff'], [tr('lamp is close', 'Lampe ist nah'), p.closeness, '#ffcf7a'], [tr('= brightness', '= Helligkeit'), Math.min(1, p.facing * p.closeness * 1.6), '#fff']]);
      out.innerHTML = tr(`Faces the lamp <b>${pct(p.facing)}</b> × lamp is close <b>${pct(p.closeness)}</b>, then the lamp's colour times the ground's: <span style="color:${css(s.rgb, 3)}">■</span>`,
        `Zeigt zur Lampe <b>${pct(p.facing)}</b> × Lampe ist nah <b>${pct(p.closeness)}</b>, dann die Farbe der Lampe mal die des Bodens: <span style="color:${css(s.rgb, 3)}">■</span>`)
        + (p.facing === 0 ? tr(' The spot turns its back on the lamp: dark.', ' Der Fleck dreht der Lampe den Rücken zu: dunkel.') : '')
        + (p.closeness === 0 ? tr(' The lamp is out of reach: dark.', ' Die Lampe ist außer Reichweite: dunkel.') : '');
    } else {
      const on = s.per.filter(p => p.on).length;
      bars(s.per.map((p, k) => [[tr('red', 'rot'), tr('green', 'grün'), tr('blue', 'blau')][k], p.on ? Math.min(1, p.facing * p.closeness * 1.6) : 0, css(lamps[k].c)]));
      out.innerHTML = tr(`This spot asks <b>${on}</b> lamp${on === 1 ? '' : 's'} and adds up their light: <span style="color:${css(s.rgb, 1.5)}">■</span>. Red and green make yellow; all three make white.`,
        `Dieser Fleck fragt <b>${on}</b> Lampe${on === 1 ? '' : 'n'} und zählt ihr Licht zusammen: <span style="color:${css(s.rgb, 1.5)}">■</span>. Rot und Grün ergibt Gelb, alle drei ergeben Weiß.`);
    }
  }
  const pct = v => Math.round(v * 100) + '%';
  function bars(list) {
    g.font = "13px 'Crimson Text', serif";
    list.forEach(([name, v, col], k) => {
      const y = 14 + k * 20;
      g.fillStyle = '#ffffff22'; g.fillRect(W - 170, y, 100, 12);
      g.fillStyle = col; g.fillRect(W - 170, y, 100 * v, 12);
      g.fillStyle = '#d8dde6'; g.textAlign = 'right'; g.fillText(name, W - 176, y + 10); g.textAlign = 'left';
      g.fillText(pct(v), W - 64, y + 10);
    });
  }
  c.addEventListener('pointerdown', e => {
    const [x, y] = at(e);
    drag = lamps.find(l => Math.hypot(l.x - x, l.y - y) < 22) ?? null;
    if (drag) c.setPointerCapture(e.pointerId); else { hover = x; draw(); }
  });
  c.addEventListener('pointermove', e => {
    const [x, y] = at(e);
    if (drag) { drag.x = Math.max(10, Math.min(W - 10, x)); drag.y = Math.max(10, Math.min(ground(x) - 12, y)); }
    else hover = x;
    draw();
  });
  c.addEventListener('pointerup', () => { drag = null; });
  row.querySelectorAll('input, select').forEach(i => i.oninput = draw);
  draw();
}
