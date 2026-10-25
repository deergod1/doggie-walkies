// The glass panels' facets (style.css, docs/ui.md): a low-poly surface lit like the glass bird,
// as a faint SVG under the main menu's and the settings' panels.
//
// node tools/facets.mjs   writes assets/ui/facets.svg (the same every time: the seed is fixed)
//
// A jittered grid of points, each with a height, every cell cut into two triangles along a
// random diagonal. Each triangle is shaded by its slope against the key light (from the top
// left, as on the bird's head): turned to it a little lighter, away from it a little darker,
// a few that catch it bright. Everything fades out away from the top left corner, where the
// light is, so the lower right of a big panel is plain glass. The edges between the facets are
// drawn as faint lines, as on the bird.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'assets/ui/facets.svg');

const SIZE = 960;          // the picture's side in pixels (larger than any panel it lies under)
const CELL = 72;           // a grid cell
const JITTER = 0.36;       // how far a point moves from its place, in cells
const RELIEF = 46;         // the heights' range, in pixels: how steep the facets get
const LIGHT = norm([-0.42, -0.74, 0.52]);   // towards the light (x right, y down, z out of the screen)
const FADE = { x: 120, y: -60, r: 1000 };   // where the light is strongest, and how far it reaches
const LEVELS = 10;         // the shades are rounded to this many steps per side (fewer paths)

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function norm(v) { const l = Math.hypot(...v); return v.map(x => x / l); }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const random = rng(0x61a55);
const n = Math.ceil(SIZE / CELL) + 1;
const points = [];
for (let j = 0; j <= n; j++) {
  const row = [];
  for (let i = 0; i <= n; i++) {
    // the picture's edges stay straight (the points there only slide along them)
    const jx = i === 0 || i === n ? 0 : (random() * 2 - 1) * JITTER * CELL;
    const jy = j === 0 || j === n ? 0 : (random() * 2 - 1) * JITTER * CELL;
    row.push([i * CELL + jx, j * CELL + jy, random() * RELIEF]);
  }
  points.push(row);
}

const triangles = [];
for (let j = 0; j < n; j++) {
  for (let i = 0; i < n; i++) {
    const a = points[j][i], b = points[j][i + 1], c = points[j + 1][i + 1], d = points[j + 1][i];
    if (random() < 0.5) triangles.push([a, b, c], [a, c, d]);
    else triangles.push([a, b, d], [b, c, d]);
  }
}

const fade = (x, y) => Math.max(0, 1 - Math.hypot(x - FADE.x, y - FADE.y) / FADE.r) ** 1.6;
const light = new Map(), dark = new Map();   // shade step -> path data
const add = (map, k, d) => map.set(k, (map.get(k) ?? '') + d);
const xy = p => `${Math.round(p[0])} ${Math.round(p[1])}`;
for (const [a, b, c] of triangles) {
  let normal = norm(cross(sub(b, a), sub(c, a)));
  if (normal[2] < 0) normal = normal.map(x => -x);
  const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
  // against a flat face: turned to the light (lighter) or away (darker); the ones that face it
  // most catch a highlight, like the bird's crown
  const diffuse = dot(normal, LIGHT) - LIGHT[2];
  const spec = Math.max(0, dot(normal, LIGHT)) ** 24;
  const shade = (diffuse * 1.1 + spec * 2.2) * fade(cx, cy);
  const step = Math.round(Math.min(1, Math.abs(shade)) * LEVELS);
  if (!step) continue;
  add(shade > 0 ? light : dark, step, `M${xy(a)}L${xy(b)}L${xy(c)}Z`);
}

// the edges, each once, in steps of their fade
const edges = new Map(), seen = new Set();
for (const t of triangles) {
  for (let k = 0; k < 3; k++) {
    const p = t[k], q = t[(k + 1) % 3], key = [xy(p), xy(q)].sort().join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const step = Math.round(fade((p[0] + q[0]) / 2, (p[1] + q[1]) / 2) * LEVELS);
    if (step) add(edges, step, `M${xy(p)}L${xy(q)}`);
  }
}

const paths = [
  ...[...dark].map(([k, d]) => `<path fill="#000" fill-opacity="${(k / LEVELS * 0.3).toFixed(3)}" d="${d}"/>`),
  ...[...light].map(([k, d]) => `<path fill="#d8f6f0" fill-opacity="${(k / LEVELS * 0.24).toFixed(3)}" d="${d}"/>`),
  ...[...edges].map(([k, d]) => `<path fill="none" stroke="#9fe6d8" stroke-opacity="${(k / LEVELS * 0.085).toFixed(3)}" d="${d}"/>`),
];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`
  + `<!-- made by tools/facets.mjs -->${paths.join('')}</svg>\n`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`${OUT}: ${triangles.length} facets, ${(svg.length / 1024).toFixed(1)} KB`);
