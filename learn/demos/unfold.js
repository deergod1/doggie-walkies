// Unfolding the world for its lightmap, with the game's own layout (src/render/lightmap.js
// layoutLightmap, which lays out every cube's solids in the world worker): a little block of
// terrain (columns of different heights, like the game's ground) is cut into triangles; the ones
// facing the same way and touching are one piece (a chart), laid flat and packed into one picture,
// the atlas. Then the light of a lamp, with its shadows, is worked out once for every texel of the
// atlas (like render/bake.js does on the graphics card) and the picture is glued back onto the
// world: each triangle shows its own part of it.
import { layoutLightmap, DENSITY } from '../../src/render/lightmap.js';
import { makeNoise, mulberry32 } from '../../src/core/util.js';
import { canvas, html, t as tr } from '../deck.js';

const W = 640, H = 330, N = 6, K = 29, OX = 176, OY = 112, AX = 366, AY = 30, AW = 264;
const FACES = [['east', 'Osten'], ['west', 'Westen'], ['up', 'oben'], ['down', 'unten'], ['south', 'Süden'], ['north', 'Norden']];

export default function mount(el) {
  const { c, g, at } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label><input type="checkbox" class="glue" checked> ${tr('glue the lightmap on', 'Lichtkarte aufkleben')}</label>
    <label>${tr('lamp', 'Lampe')} <input type="range" class="lamp" min="0" max="360" value="40"></label>
    <label>${tr('height', 'Höhe')} <input type="range" class="lh" min="20" max="60" value="34"></label>
    <button class="dice">${tr('New ground', 'Neuer Boden')}</button></div>`);
  const out = html(el, '<div class="out"></div>');
  html(el, `<p class="small muted" style="margin:6px 0 0">${tr('Point at a piece of ground, on the left or in the lightmap on the right.', 'Zeig auf ein Stück Boden, links oder rechts in der Lichtkarte.')}</p>`);
  const $ = s => row.querySelector(s);
  let seed = 4, hgt, tris, atlas, tex, hover = null;

  // the ground as triangles, one array a column (the game hands its solids over like this)
  function build() {
    const noise = makeNoise(mulberry32(seed));
    hgt = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) hgt.push(Math.max(0.5, Math.round(noise(x * 0.4, z * 0.4) * 6) * 0.5));
    const H0 = (x, z) => x < 0 || z < 0 || x >= N || z >= N ? 0 : hgt[z * N + x];
    const arrays = [], pos = [];
    const quad = (a, b, cc, d) => pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const h = H0(x, z);
      quad([x, h, z], [x, h, z + 1], [x + 1, h, z + 1], [x + 1, h, z]);
      // the sides down to a lower neighbour (or the ground's edge)
      for (const [dx, dz, a, b] of [[1, 0, [1, 1], [1, 0]], [-1, 0, [0, 0], [0, 1]], [0, 1, [0, 1], [1, 1]], [0, -1, [1, 0], [0, 0]]]) {
        const nh = H0(x + dx, z + dz);
        if (nh >= h) continue;
        quad([x + a[0], h, z + a[1]], [x + a[0], nh, z + a[1]], [x + b[0], nh, z + b[1]], [x + b[0], h, z + b[1]]);
      }
    }
    arrays.push({ pos: new Float32Array(pos) });
    atlas = layoutLightmap(arrays);
    const P = arrays[0].pos, L = arrays[0].lm;
    tris = [];
    for (let i = 0; i < P.length / 9; i++) {
      const v = [0, 1, 2].map(k => [P[i * 9 + k * 3], P[i * 9 + k * 3 + 1], P[i * 9 + k * 3 + 2]]);
      const uv = [0, 1, 2].map(k => [L[(i * 3 + k) * 2] * atlas.w, L[(i * 3 + k) * 2 + 1] * atlas.h]);
      const e1 = v[1].map((q, j) => q - v[0][j]), e2 = v[2].map((q, j) => q - v[0][j]);
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], nl = Math.hypot(...n);
      const nn = n.map(q => q / nl);
      let ax = 0;
      for (let j = 1; j < 3; j++) if (Math.abs(nn[j]) > Math.abs(nn[ax])) ax = j;
      tris.push({ v, uv, n: nn, face: ax * 2 + (nn[ax] >= 0 ? 0 : 1), s: v.map(proj) });
    }
    // drawn far to near (the camera looks from +x, +z)
    tris.sort((a, b) => depth(a) - depth(b));
    bake();
  }
  const depth = t => t.v.reduce((s, p) => s + p[0] + p[2] + p[1] * 0.01, 0) + (t.face === 2 ? 0.2 : 0);
  const proj = ([x, y, z]) => [OX + (x - z) * K, OY + (x + z) * K * 0.5 - y * K * 0.95];
  const visible = t => t.face === 0 || t.face === 2 || t.face === 4;
  const inside = (x, y, z) => x >= 0 && z >= 0 && x < N && z < N && y < hgt[Math.floor(z) * N + Math.floor(x)] - 1e-4;
  const lampAt = () => { const a = $('.lamp').value * Math.PI / 180, r = 2.2; return [N / 2 + Math.cos(a) * r, $('.lh').value / 10, N / 2 + Math.sin(a) * r]; };

  // the lightmap: for every texel of every triangle, where it is in the world, and how much of the
  // lamp's light gets there (faces it, close to it, nothing in the way)
  function bake() {
    tex = document.createElement('canvas'); tex.width = atlas.w; tex.height = atlas.h;
    const tg = tex.getContext('2d'), img = tg.createImageData(atlas.w, atlas.h), L = lampAt();
    for (let i = 0; i < img.data.length; i += 4) { img.data[i] = 22; img.data[i + 1] = 26; img.data[i + 2] = 36; img.data[i + 3] = 255; }
    for (const t of tris) {
      const [A, B, C] = t.uv, area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
      if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0])) - 1), x1 = Math.min(atlas.w - 1, Math.ceil(Math.max(A[0], B[0], C[0])) + 1);
      const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1])) - 1), y1 = Math.min(atlas.h - 1, Math.ceil(Math.max(A[1], B[1], C[1])) + 1);
      const col = t.face === 2 ? [110, 170, 80] : [150, 105, 70];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w1 = ((px - A[0]) * (C[1] - A[1]) - (py - A[1]) * (C[0] - A[0])) / area, w2 = ((B[0] - A[0]) * (py - A[1]) - (B[1] - A[1]) * (px - A[0])) / area, w0 = 1 - w1 - w2;
        if (w0 < -0.12 || w1 < -0.12 || w2 < -0.12) continue;   // (and a little round it, so no seams show)
        const p = [0, 1, 2].map(j => t.v[0][j] * w0 + t.v[1][j] * w1 + t.v[2][j] * w2);
        const d = L.map((q, j) => q - p[j]), dl = Math.hypot(...d), facing = Math.max(0, (d[0] * t.n[0] + d[1] * t.n[1] + d[2] * t.n[2]) / dl);
        let lit = facing > 0;
        for (let s = 0.06; lit && s < dl; s += 0.06) {
          const q = [0, 1, 2].map(j => p[j] + t.n[j] * 0.02 + d[j] / dl * s);
          if (inside(q[0], q[1], q[2])) lit = false;
        }
        const b = 0.12 + (lit ? facing * Math.max(0, 1 - dl / 7.5) ** 2 * 2.2 : 0);
        const o = (y * atlas.w + x) * 4;
        img.data[o] = Math.min(255, col[0] * b * 1.1); img.data[o + 1] = Math.min(255, col[1] * b); img.data[o + 2] = Math.min(255, col[2] * b * 0.8);
      }
    }
    tg.putImageData(img, 0, 0);
    draw();
  }
  const scale = () => Math.min(AW / atlas.w, (H - AY - 20) / atlas.h);
  const toAtlas = ([u, v]) => [AX + u * scale(), AY + v * scale()];
  const path = pts => { g.beginPath(); g.moveTo(...pts[0]); g.lineTo(...pts[1]); g.lineTo(...pts[2]); g.closePath(); };
  // the affine map from a triangle in the atlas onto the same triangle on screen
  function glue(t) {
    const [[u0, v0], [u1, v1], [u2, v2]] = t.uv, [[x0, y0], [x1, y1], [x2, y2]] = t.s;
    const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
    if (Math.abs(det) < 1e-9) return;
    const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det, cc = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / det;
    const b = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det, d = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / det;
    const e = x0 - a * u0 - cc * v0, f = y0 - b * u0 - d * v0;
    // clip a hair bigger than the triangle, so neighbours meet without a crack
    const m = t.s.reduce((s, p) => [s[0] + p[0] / 3, s[1] + p[1] / 3], [0, 0]);
    g.save(); path(t.s.map(p => [p[0] + Math.sign(p[0] - m[0]) * 0.6, p[1] + Math.sign(p[1] - m[1]) * 0.6])); g.clip();
    g.transform(a, b, cc, d, e, f);
    g.imageSmoothingEnabled = true;
    g.drawImage(tex, 0, 0);
    g.restore();
  }

  function draw() {
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    const glued = $('.glue').checked;
    for (const t of tris) {
      if (!visible(t)) continue;
      if (glued) glue(t);
      else { g.fillStyle = t.face === 2 ? '#5f8f45' : t.face === 0 ? '#7a5638' : '#6a4a30'; path(t.s); g.fill(); }
      g.strokeStyle = '#ffffff14'; g.lineWidth = 0.6; path(t.s); g.stroke();
    }
    const L = proj(lampAt()), Lf = proj([lampAt()[0], 0, lampAt()[2]]);
    g.strokeStyle = '#ffcf7a55'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(...L); g.lineTo(...Lf); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(...L, 6, 0, 7); g.fill(); g.strokeStyle = '#ffcf7a'; g.lineWidth = 2; g.stroke();
    // the atlas
    const sc = scale();
    g.imageSmoothingEnabled = false;
    g.drawImage(tex, AX, AY, atlas.w * sc, atlas.h * sc);
    g.strokeStyle = '#ffffff30'; g.lineWidth = 0.6;
    for (const t of tris) { path(t.uv.map(toAtlas)); g.stroke(); }
    g.strokeStyle = '#5a6678'; g.strokeRect(AX, AY, atlas.w * sc, atlas.h * sc);
    g.fillStyle = '#d8dde6'; g.font = "13px 'Crimson Text', serif";
    g.fillText(tr(`the lightmap: ${atlas.w} × ${atlas.h} texels`, `die Lichtkarte: ${atlas.w} × ${atlas.h} Texel`), AX, AY - 10);
    g.fillText(tr('the world', 'die Welt'), 12, 20);
    if (hover) {
      g.strokeStyle = '#5fd3ff'; g.lineWidth = 2;
      if (visible(hover)) { path(hover.s); g.stroke(); }
      path(hover.uv.map(toAtlas)); g.stroke();
    }
    out.innerHTML = (hover ? tr(`This triangle faces <b>${FACES[hover.face][0]}</b>.${visible(hover) ? '' : ' You cannot see it from here, but it has its place in the lightmap too.'} `,
      `Dieses Dreieck zeigt nach <b>${FACES[hover.face][1]}</b>.${visible(hover) ? '' : ' Von hier siehst du es nicht, aber es hat auch seinen Platz in der Lichtkarte.'} `) : '')
      + tr(`<b>${tris.length}</b> triangles, laid flat in pieces at <b>${DENSITY}</b> texels a cell. The light of the lamp was worked out once for each texel.`,
        `<b>${tris.length}</b> Dreiecke, in Stücken flach hingelegt, mit <b>${DENSITY}</b> Texeln pro Feld. Das Licht der Lampe wurde einmal für jedes Texel ausgerechnet.`);
  }
  const inTri = (p, [a, b, cc]) => {
    const s = (q, r, t) => (q[0] - t[0]) * (r[1] - t[1]) - (r[0] - t[0]) * (q[1] - t[1]);
    const d1 = s(p, a, b), d2 = s(p, b, cc), d3 = s(p, cc, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  c.addEventListener('pointermove', e => {
    const p = at(e);
    if (p[0] >= AX) hover = tris.find(t => inTri(p, t.uv.map(toAtlas))) ?? null;
    else hover = [...tris].reverse().find(t => visible(t) && inTri(p, t.s)) ?? null;
    draw();
  });
  $('.glue').oninput = draw;
  $('.lamp').oninput = bake; $('.lh').oninput = bake;
  $('.dice').onclick = () => { seed = Math.floor(Math.random() * 1e6); hover = null; build(); };
  build();
}
