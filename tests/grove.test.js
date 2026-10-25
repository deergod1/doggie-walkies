import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N, LH, CHAR_H } from '../src/core/constants.js';
import { World } from '../src/world/world.js';
import { placeProps } from '../src/render/propplace.js';
import { themeOf } from '../src/themes/depth.js';
import { propMetadata } from '../src/core/propcatalog.js';

// the dark forest's own props (render/propplace.js grove): trees, lanterns, strings of lanterns
const rooms = (seed, theme, depth = 1) => {
  const w = new World(seed, { themes: [theme] }), out = [];
  for (const k of w.layout(depth).exists) { const m = w.cube(k).map; if (m.biome === theme && !m.guardian) out.push(m); }
  return out;
};
// the highest ground (or fluid) at or under y at (x, z)
const groundAt = (m, x, z, y) => Math.max(-Infinity, ...m.cols[Math.floor(z) * N + Math.floor(x)]
  .map(f => f.fluid ? f.surf * LH : Math.max(...f.cs)).filter(t => t <= y + 1e-6));

test('the dark forest is a forest: trees, lantern posts, lanterns in the branches and strings of them', () => {
  const count = {}, maps = rooms(3, 'darkforest');
  for (const m of maps) {
    const out = placeProps(m, themeOf(m)).out;
    for (const q of out) { const b = q.name.replace(/_[ab]$/, ''); count[b] = (count[b] ?? 0) + 1; }
    // a lantern hangs from a branch high enough to walk under
    for (const q of out.filter(q => q.name.includes('hanging_lantern'))) {
      const p = propMetadata.get(q.name);
      assert.ok(q.y + p.minY - groundAt(m, q.x, q.z, q.y) >= CHAR_H, `${m.key}: a lantern in the way`);
    }
    // a string's segments follow on from each other, from tree to tree, a head's room over the ground
    const segs = out.filter(q => q.matrix);
    for (const q of segs) {
      const M = q.matrix, a = [M[12], M[13], M[14]], b = [a[0] + M[0], a[1] + M[1], a[2] + M[2]];
      assert.deepEqual([M[4], M[5], M[6]], [0, 1, 0], 'the lanterns hang straight');
      assert.ok(Math.abs(Math.hypot(M[8], M[10]) - 1) < 1e-9 && Math.abs(M[0] * M[8] + M[2] * M[10]) < 1e-9);
      for (const t of [0, 0.5, 1]) {
        const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
        assert.ok(x >= 0 && z >= 0 && x < N && z < N && y - groundAt(m, x, z, y) >= CHAR_H, `${m.key}: a string too low`);
      }
    }
    const end = q => [q.matrix[12] + q.matrix[0], q.matrix[13] + q.matrix[1], q.matrix[14] + q.matrix[2]];
    const after = q => segs.find(r => Math.hypot(r.matrix[12] - end(q)[0], r.matrix[13] - end(q)[1], r.matrix[14] - end(q)[2]) < 1e-6);
    const firsts = segs.filter(q => !segs.some(r => after(r) === q));
    let walked = 0;
    for (let q of firsts) { let n = 0; for (; q; q = after(q)) n++; assert.ok(n >= 2, `${m.key}: a string of ${n}`); walked += n; }
    assert.equal(walked, segs.length, `${m.key}: every segment on a string`);
  }
  const per = b => (count[`darkforest_${b}`] ?? 0) / maps.length;
  assert.ok(per('dark_fir_tree') + per('gnarled_tree') + per('bare_tree') > 20, 'trees');
  assert.ok(per('lantern_post') > 1 && per('hanging_lantern') > 2 && per('lantern_string') > 5, JSON.stringify(count));
});

test('the slime marsh has its slime trees in thickets and glowing stalks by the way', () => {
  const count = {}, maps = rooms(3, 'slime', 4);
  for (const m of maps) for (const q of placeProps(m, themeOf(m)).out) {
    const b = q.name.replace(/_[ab]$/, '');
    count[b] = (count[b] ?? 0) + 1;
    assert.ok(!q.name.includes('hanging_lantern') && !q.matrix, `${m.key}: no lanterns in the marsh`);
  }
  const per = b => (count[`slime_${b}`] ?? 0) / maps.length;
  assert.ok(per('slime_tree') + per('bulb_tree') + per('dead_slimed_tree') > 6, JSON.stringify(count));
  assert.ok(per('glow_stalk') > 0.5, JSON.stringify(count));
});

test('only the forest has a grove', () => {
  for (const m of rooms(3, 'meadow')) assert.ok(!placeProps(m, themeOf(m)).out.some(q => q.matrix || q.name.startsWith('darkforest')), m.key);
});
