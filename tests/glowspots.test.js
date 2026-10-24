import { test } from 'node:test';
import assert from 'node:assert/strict';
import { glowSpots, MAX, OUT } from '../src/core/glowspots.js';

// a closed box of triangles (12, corners split per face like an exporter's) at (x, y, z)
function box(x, y, z, s = 0.1) {
  const c = [];
  for (const [ax, sign] of [[0, -1], [0, 1], [1, -1], [1, 1], [2, -1], [2, 1]]) {
    const u = (ax + 1) % 3, v = (ax + 2) % 3, q = [];
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [x, y, z]; p[ax] += sign * s; p[u] += a * s; p[v] += b * s; q.push(p); }
    if (sign < 0) q.reverse();   // (wound outwards on every face)
    c.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
  }
  return Float32Array.from(c);
}
const mesh = (...boxes) => ({ pos: Float32Array.from(boxes.flatMap(b => [...b])) });

test('a glowing piece is a spot at its middle, wherever the prop has it', () => {
  const [s] = glowSpots([mesh(box(0.27, 1.2, 0))]);
  assert.ok(Math.abs(s.x - 0.27) < 1e-6 && Math.abs(s.y - 1.2) < 1e-6 && Math.abs(s.z) < 1e-6);
  assert.deepEqual(glowSpots([]), []);
});

test('pieces close together are one spot, far apart each its own, and a prop gives at most MAX', () => {
  // a candelabra's candles: one light
  assert.equal(glowSpots([mesh(box(0, 1, 0, 0.02), box(0.15, 1, 0, 0.02), box(-0.15, 1, 0, 0.02))]).length, 1);
  // a lantern tree's lanterns, far apart: one each
  const ring = Array.from({ length: 4 }, (_, i) => box(Math.cos(i * 1.57) * 1.1, 2.5, Math.sin(i * 1.57) * 1.1));
  assert.equal(glowSpots([mesh(...ring)]).length, 4);
  // more than MAX: the nearest merged until MAX are left, the glow kept where it was
  const many = Array.from({ length: 10 }, (_, i) => box(i * 0.8, 1, 0));
  const spots = glowSpots([mesh(...many)]);
  assert.equal(spots.length, MAX);
  const w = spots.reduce((n, s) => n + s.w, 0), x = spots.reduce((n, s) => n + s.x * s.w, 0) / w;
  assert.ok(Math.abs(x - 3.6) < 1e-6, 'the glow keeps its middle');
});

test('a spot moves out along the way its glow faces: gills under a cap, runes off a stone', () => {
  // a downward-facing ring (a cap's gills) round a stem: its light goes below it
  const ring = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, b = (i + 1) / 12 * Math.PI * 2, at = (r, t) => [Math.cos(t) * r, 1, Math.sin(t) * r];
    ring.push(...at(0.2, a), ...at(0.4, a), ...at(0.4, b), ...at(0.2, a), ...at(0.4, b), ...at(0.2, b));   // (facing down)
  }
  const [gills] = glowSpots([{ pos: Float32Array.from(ring) }]);
  assert.ok(Math.abs(gills.x) < 1e-6 && Math.abs(gills.z) < 1e-6 && Math.abs(gills.y - (1 - OUT)) < 1e-6, JSON.stringify(gills));
  // a flat rune facing up: off its stone
  const [rune] = glowSpots([{ pos: Float32Array.from([0, 0.1, 0, 0, 0.1, 0.2, 0.2, 0.1, 0]) }]);
  assert.ok(Math.abs(rune.y - (0.1 + OUT)) < 1e-6);
});

test('indexed geometry counts the same as a triangle soup', () => {
  const pos = box(0, 0.5, 0), index = Uint16Array.from({ length: pos.length / 3 }, (_, i) => i);
  assert.deepEqual(glowSpots([{ pos, index }]), glowSpots([{ pos }]));
});
