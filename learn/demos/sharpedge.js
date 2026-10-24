// Sharp shadows from a small picture: a lightmap has only a few texels a cell (src/render/lightmap.js
// DENSITY), much bigger than a pixel when you come close. Three ways to keep the shadow's edge in
// those texels, side by side:
//   yes or no        each texel: lit or not. Close up: blocky steps.
//   blended          the same, smoothly blended between texels (what a graphics card does when it
//                    reads a picture). Close up: a blurry smudge.
//   distance         each texel keeps how far it is from the shadow's edge (negative inside), the
//                    game's way (render/bake.js): blended, the distance is right between the texels
//                    too, and where it crosses zero is the edge. Drawn one pixel wide (fwidth in
//                    render/lighthook.js): sharp at any zoom, and the corners only a little round.
// The shadow here is drawn by formulas (a circle and a box, like the signed distance fields of the
// monsters: learn/art.html); the game finds each texel's distance by looking round it.
import { canvas, html, t as tr } from '../deck.js';
import { DENSITY } from '../../src/render/lightmap.js';

const W = 640, H = 270, PW = 208, GAP = 8, TW = 26, TH = 16, CLAMP = 1.5;

export default function mount(el) {
  const { g } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label>${tr('come closer', 'näher ran')} <input type="range" class="zoom" min="0" max="100" value="45"></label>
    <label><input type="checkbox" class="grid" checked> ${tr('show the texels', 'Texel zeigen')}</label>
    <label><input type="checkbox" class="edge"> ${tr('the real edge', 'die echte Kante')}</label></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  // the shadow: inside a circle or a turned box (signed distance, in texels; negative inside)
  const box = (x, y, cx, cy, hx, hy, a) => {
    const dx = x - cx, dy = y - cy, u = Math.abs(dx * Math.cos(a) + dy * Math.sin(a)) - hx, v = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a)) - hy;
    return Math.hypot(Math.max(u, 0), Math.max(v, 0)) + Math.min(Math.max(u, v), 0);
  };
  const sd = (x, y) => Math.min(Math.hypot(x - 9, y - 8.5) - 4.3, box(x, y, 17.5, 7, 5.5, 1.7, 0.45));
  // what the texels keep (at their middles)
  const yes = new Float32Array(TW * TH), dist = new Float32Array(TW * TH);
  for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i++) {
    const d = sd(i + 0.5, j + 0.5);
    yes[j * TW + i] = d > 0 ? 1 : 0;
    dist[j * TW + i] = Math.max(-CLAMP, Math.min(CLAMP, d));
  }
  const tex = (a, i, j) => a[Math.max(0, Math.min(TH - 1, j)) * TW + Math.max(0, Math.min(TW - 1, i))];
  const nearest = (a, x, y) => tex(a, Math.floor(x), Math.floor(y));
  const blend = (a, x, y) => {
    const fx = x - 0.5, fy = y - 0.5, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    return (tex(a, i, j) * (1 - u) + tex(a, i + 1, j) * u) * (1 - v) + (tex(a, i, j + 1) * (1 - u) + tex(a, i + 1, j + 1) * u) * v;
  };
  const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  function draw() {
    const z = +$('.zoom').value, px = 6 * 2 ** (z / 100 * 4.2);   // pixels a texel
    const img = g.createImageData(W * 2, H * 2), D = img.data, cx = 13.5, cy = 8.2;
    for (let y = 0; y < H * 2; y++) for (let x = 0; x < W * 2; x++) {
      const p = Math.floor(x / 2 / (PW + GAP)), lx = x / 2 - p * (PW + GAP);
      const o = (y * W * 2 + x) * 4;
      D[o + 3] = 255;
      if (lx >= PW || p > 2) { D[o] = 7; D[o + 1] = 8; D[o + 2] = 12; continue; }
      const tx = cx + (lx - PW / 2) / px, ty = cy + (y / 2 - H / 2 + 10) / px;
      let v;
      if (p === 0) v = nearest(yes, tx, ty);
      else if (p === 1) v = blend(yes, tx, ty);
      else { const w = 0.5 / px; v = smooth(-w, w, blend(dist, tx, ty)); }   // the edge one pixel wide
      const b = 0.14 + 0.86 * v;
      D[o] = 255 * b; D[o + 1] = 222 * b; D[o + 2] = 160 * b;
      if ($('.edge').checked && Math.abs(sd(tx, ty)) * px < 0.7) { D[o] = 95; D[o + 1] = 211; D[o + 2] = 255; }
      if ($('.grid').checked && px > 9) {
        const gx = tx - Math.floor(tx), gy = ty - Math.floor(ty);
        if (gx * px < 0.5 || gy * px < 0.5) { D[o] = D[o] * 0.7 + 30; D[o + 1] = D[o + 1] * 0.7 + 30; D[o + 2] = D[o + 2] * 0.7 + 40; }
      }
    }
    g.putImageData(img, 0, 0);
    g.fillStyle = '#000b'; g.fillRect(0, 0, W, 22);
    g.fillStyle = '#d8dde6'; g.font = "14px 'Crimson Text', serif"; g.textAlign = 'center';
    [tr('yes or no', 'ja oder nein'), tr('blended', 'verwischt'), tr('distance to the edge', 'Abstand zur Kante')].forEach((s, i) => g.fillText(s, i * (PW + GAP) + PW / 2, 16));
    g.textAlign = 'left';
    const cells = px * DENSITY;
    out.innerHTML = tr(`One texel is <b>${Math.round(px)}</b> pixels wide now (a cell of the world: ${Math.round(cells)} pixels). Left: steps. Middle: a smudge. Right: the same few texels, but sharp.`,
      `Ein Texel ist jetzt <b>${Math.round(px)}</b> Pixel breit (ein Feld der Welt: ${Math.round(cells)} Pixel). Links: Stufen. Mitte: verschmiert. Rechts: dieselben wenigen Texel, aber scharf.`);
  }
  row.querySelectorAll('input').forEach(i => i.oninput = draw);
  draw();
}
