import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightCells } from '../src/core/lightcells.js';

const G = { cells: 20, from: -2, max: 16 };
const listOf = (out, cx, cz, max = G.max) => [...out.slice((cz * G.cells + cx) * max, (cz * G.cells + cx + 1) * max)].filter(i => i >= 0);
// the nearest point of cell (cx, cz) to (x, z)
const reaches = (l, cx, cz) => { const x0 = G.from + cx, z0 = G.from + cz;
  return Math.hypot(Math.max(x0 - l.x, 0, l.x - x0 - 1), Math.max(z0 - l.z, 0, l.z - z0 - 1)) < l.reach; };

test('a cell takes every light that reaches into it, and no other', () => {
  const lights = [{ x: 3.5, z: 3.5, reach: 4, intensity: 1 }, { x: 12, z: 8, reach: 5, intensity: 2 }, { x: 8, z: 15, reach: 3, intensity: 1 }];
  const out = lightCells(lights, G);
  for (let cz = 0; cz < G.cells; cz++) for (let cx = 0; cx < G.cells; cx++)
    assert.deepEqual(listOf(out, cx, cz).sort(), lights.map((l, i) => reaches(l, cx, cz) ? i : -1).filter(i => i >= 0).sort(), `${cx},${cz}`);
});

test('a crowded cell keeps the strongest there, the faintest left out', () => {
  // twenty lanterns round one cell, one bright fire on it
  const lights = Array.from({ length: 20 }, (_, i) => ({ x: 8 + Math.cos(i) * 3, z: 8 + Math.sin(i) * 3, reach: 4, intensity: 1 }));
  lights.push({ x: 8.5, z: 8.5, reach: 6, intensity: 3 });
  const out = lightCells(lights, G), here = listOf(out, 10, 10);
  assert.equal(here.length, G.max);
  assert.equal(here[0], 20, 'the bright one first');
  // the ones left out are no nearer than any kept
  const d = i => Math.hypot(lights[i].x - 8.5, lights[i].z - 8.5);
  const kept = here.filter(i => i !== 20), out_ = lights.map((_, i) => i).filter(i => i !== 20 && !here.includes(i));
  assert.ok(Math.max(...kept.map(d)) <= Math.min(...out_.map(d)) + 0.75);
});

test('lights round the cube count for the cells at its edge', () => {
  const out = lightCells([{ x: -1, z: 8, reach: 4, intensity: 1 }], G);
  assert.deepEqual(listOf(out, 0, 10), [0]);
  assert.deepEqual(listOf(out, 2, 10), [0]);   // (cube x 0..1)
  assert.deepEqual(listOf(out, 10, 10), []);
});
