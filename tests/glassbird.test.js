import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { assets } from './paths.js';
import { readGlb } from '../tools/glb.mjs';

// the glass bird (blender/glassbird.py) that the splash screen breaks (src/game/splash.js): the
// whole bird, its core, and the same bird in pieces, which put together are the whole bird again
test('the glass bird comes whole and in pieces that make it whole again', () => {
  const j = readGlb(resolve(assets, 'glassbird.glb')).json;
  const node = name => j.nodes.find(n => n.name === name);
  // triangles of each material in a node's mesh
  const faces = n => Object.fromEntries(j.meshes[n.mesh].primitives.map(p => [j.materials[p.material].name, j.accessors[p.indices].count / 3]));
  const bird = node('GlassBird'), core = node('GlassBirdCore'), shards = node('GlassBirdShards');
  assert.ok(bird && core && shards, 'GlassBird, GlassBirdCore and GlassBirdShards');
  const whole = faces(bird);
  assert.ok(whole.GlassBirdGlass > 150 && whole.GlassBirdGlass <= 400, `${whole.GlassBirdGlass} facets`);
  assert.ok(whole.GlassBirdEye > 0, 'it has its eyes');
  const pieces = shards.children.map(i => j.nodes[i]);
  assert.ok(pieces.length >= 20 && pieces.every(p => /^GlassBirdShard\.\d{3}$/.test(p.name)), `${pieces.length} pieces`);
  let outside = 0, eyes = 0;
  for (const p of pieces) {
    const f = faces(p);
    assert.ok(f.GlassBirdGlass > 0 && f.GlassBirdBreak >= 3, `${p.name}: its outside and its fracture faces`);
    outside += f.GlassBirdGlass;
    eyes += f.GlassBirdEye ?? 0;
  }
  assert.equal(outside, whole.GlassBirdGlass, "the pieces' outsides are the whole bird's");
  assert.equal(eyes, whole.GlassBirdEye, 'both eyes go with the pieces');
});
