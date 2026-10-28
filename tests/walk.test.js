import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/core/util.js';
import { buildWorld, placeAt, cellKey, intersection, STREET, ROAD } from '../src/walk/world.js';
import { createActor } from '../src/walk/characters.js';
import { createWalk, stepWalk, setControl, setStyle, setDestination, startSniff, rest, together } from '../src/walk/simulation.js';
import { distance, findPath, clearSegment, walkable, ropeLength, ropePath, constrainPair, LEASH, slide } from '../src/walk/navigation.js';
import { packWalk, restoreWalk, readSave, writeSave, SAVE_KEY } from '../src/walk/save.js';

const advance = (s, seconds, input) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) stepWalk(s, 1 / 60, input); };
const assertPair = s => {
  assert.ok(walkable(s.map, s.dog, s.dog.radius), 'dog has body clearance');
  assert.ok(walkable(s.map, s.handler, s.handler.radius), 'person has body clearance');
  assert.ok(ropeLength(s.leash) <= LEASH.length + LEASH.give + 1e-7, 'leash respects routed max length');
  assert.ok(distance(s.dog, s.handler) >= s.dog.radius + s.handler.radius - 1e-7, 'bodies do not overlap');
  for (let i = 1; i < s.leash.length; i++) assert.ok(clearSegment(s.map, s.leash[i - 1], s.leash[i], LEASH.clearance), 'rope avoids solids');
};
const corridorPoint = (R, cx, cz) => {
  // A random point on a street corridor near (cx, cz).
  const vertical = R() < 0.5, g = Math.round(((vertical ? cx : cz) + (R() - 0.5) * 4 * STREET) / STREET) * STREET;
  const along = (vertical ? cz : cx) + (R() - 0.5) * 2 * STREET;
  return vertical ? { x: g + (R() - 0.5) * ROAD, z: along } : { x: along, z: g + (R() - 0.5) * ROAD };
};

test('the continuous world is deterministic, varied, and consistent across sliding windows', () => {
  assert.deepEqual(buildWorld(42, 10, -20), buildWorld(42, 10, -20));
  assert.notDeepEqual(buildWorld(42, 10, -20).trees, buildWorld(43, 10, -20).trees);
  // Content is a pure function of position: a window rebuilt around a known tree agrees exactly.
  const a = buildWorld(7, 0, 0);
  const t = a.trees[Math.floor(a.trees.length / 2)];
  const b = buildWorld(7, t.x + 12, t.z - 9);
  assert.ok(b.trees.some(u => u.x === t.x && u.z === t.z && u.size === t.size && u.hue === t.hue));
  const scent = a.scents[Math.floor(a.scents.length / 2)];
  const c = buildWorld(7, scent.x - 10, scent.z + 11);
  assert.ok(c.scents.some(sc => sc.id === scent.id && sc.x === scent.x && sc.z === scent.z && sc.label === scent.label));
});

test('streets are a guaranteed pair-clear backbone; scents and places are reachable', () => {
  for (let seed = 0; seed < 25; seed++) {
    const R = mulberry32(seed * 977 + 5), map = buildWorld(seed, 0, 0);
    for (let i = 0; i < 40; i++) {
      const p = corridorPoint(R, 0, 0);
      // Plazas have a fountain at their heart; the walkable ring around it is tested via places.
      if (map.places.some(pl => distance(p, pl) < 5.5)) continue;
      assert.ok(walkable(map, p, 0.7), `seed ${seed}: corridor fits the pair`);
    }
    for (let i = 0; i < 10; i++) {
      let a = corridorPoint(R, 0, 0), b = corridorPoint(R, 0, 0);
      while (map.places.some(pl => distance(a, pl) < 5.5)) a = corridorPoint(R, 0, 0);
      while (map.places.some(pl => distance(b, pl) < 5.5)) b = corridorPoint(R, 0, 0);
      assert.ok(findPath(map, a, b, 0.7), `seed ${seed}: corridors connect`);
    }
    const sampleStreet = (cx, cz, radius) => {
      for (let tries = 0; tries < 40; tries++) {
        const p = corridorPoint(R, cx, cz);
        if (!map.places.some(pl => distance(p, pl) < 5.5) && walkable(map, p, radius)) return p;
      }
      return null;
    };
    for (const scent of map.scents) {
      assert.ok(walkable(map, scent, 0.36), `seed ${seed}: scent stands on walkable ground`);
      const from = sampleStreet(scent.x, scent.z, 0.34);
      assert.ok(from && findPath(map, from, scent, 0.34), `seed ${seed}: scent reachable`);
    }
    for (const place of map.places) {
      // The fountain occupies the plaza's heart; the pair reaches its walkable ring.
      const edge = { x: place.x + 2.8, z: place.z + 0.4 };
      assert.ok(walkable(map, edge, 0.7), `seed ${seed}: plaza ring is pair-wide`);
      const from = sampleStreet(place.x, place.z, 0.7);
      assert.ok(from && findPath(map, from, edge, 0.7), `seed ${seed}: place reachable`);
    }
    assert.ok(map.places.length >= 1, 'home corner exists');
  }
});

test('named places exist out in the world and the origin is always home', () => {
  assert.equal(placeAt(2026, 0, 0)?.id, 'place:0,0');
  let found = 0;
  for (let gx = -4; gx <= 4; gx++) for (let gz = -4; gz <= 4; gz++) if (placeAt(2026, gx, gz)) found++;
  assert.ok(found >= 3, 'several named corners within a few blocks of home');
});

test('NPCs share the core model but do not carry the full relationship/skill model', () => {
  const dog = createActor('d', 'dog', 0, 0, true), squirrel = createActor('s', 'squirrel', 1, 0);
  for (const key of ['attributes', 'personality', 'needs', 'state', 'goal', 'intent']) assert.ok(key in dog && key in squirrel);
  assert.ok(dog.skills); assert.equal(squirrel.skills, undefined); assert.equal(squirrel.relationships, undefined);
  dog.state.energy = 0.2; assert.equal(squirrel.state.energy, 0.88);
  assert.throws(() => createActor('bad', 'dragon', 0, 0));
});

test('visibility navigation routes bodies and leash around a tree rather than through it', () => {
  const map = { half: 10, obstacles: [{ x: 0, z: 0, w: 0.8, d: 0.8 }] };
  const a = { x: -1, z: 0 }, b = { x: 1, z: 0 }, path = findPath(map, a, b, 0.3);
  assert.ok(path.length > 2); assert.equal(clearSegment(map, a, b, 0.3), false);
  for (let i = 1; i < path.length; i++) assert.ok(clearSegment(map, path[i - 1], path[i], 0.3));
  const rope = ropePath(map, a, b); assert.ok(ropeLength(rope) > distance(a, b));
  assert.equal(findPath(map, a, { x: 0, z: 0 }, 0.3), null);
  const actor = { ...a, radius: 0.3 }; assert.deepEqual(slide(map, actor, 6, 0), a, 'sweep cannot tunnel');
});

test('firm leash limits movement without teleporting a stationary partner', () => {
  const map = { half: 10, obstacles: [] };
  const d = createActor('d', 'dog', -1.3, 0), h = createActor('h', 'person', 1.3, 0);
  const next = constrainPair(map, d, h, { x: -2.3, z: 0 }, h);
  assert.deepEqual(next.handler, { x: h.x, z: h.z });
  assert.ok(next.dog.x <= d.x && next.dog.x > -1.45);
  assert.ok(ropeLength(next.path) <= LEASH.length + LEASH.give + 1e-7);
  assert.ok(next.blocked);
});

test('keyboard and autonomous simulation keep collision and leash invariants over many seeds', () => {
  for (let seed = 0; seed < 12; seed++) {
    const s = createWalk(seed), R = mulberry32(seed);
    for (let i = 0; i < 1200; i++) {
      if (i % 200 === 0) setControl(s, ['handler', 'dog', 'auto'][Math.floor(R() * 3)]);
      if (i % 300 === 0) setStyle(s, R() < 0.5 ? 'sniffari' : 'exercise');
      const angle = Math.floor(i / 60) * 2.4;
      stepWalk(s, 1 / 30, { x: Math.sin(angle), z: Math.cos(angle) }); assertPair(s);
    }
    assert.ok(s.metrics.distance > 2, 'pair actually moved');
  }
});

test('shared plan pursues goals, discovers scents and remains useful without player input', () => {
  const s = createWalk(2026); setControl(s, 'auto'); advance(s, 45);
  assert.ok(s.metrics.distance > 10); assert.ok(s.metrics.sniffs > 0); assertPair(s);
});

test('direct control stays explicit; click routes fail safely for blocked targets', () => {
  const s = createWalk(); assert.equal(s.control, 'handler');
  assert.equal(setDestination(s, s.map.houses[0]), false); assert.equal(s.clickGoal, null);
  setControl(s, 'dog'); assert.equal(setDestination(s, { x: 0, z: -6 }), true);
  advance(s, 20); assert.equal(s.control, 'dog'); assertPair(s);
  assert.ok(distance(s.dog, { x: 0, z: -6 }) < 0.5, 'dog can lead to its destination');
  setControl(s, 'auto'); assert.equal(s.clickGoal, null); setControl(s, 'nonsense'); assert.equal(s.control, 'auto');
});

test('the pair can turn back through each other and navigate tree corners and long targets', () => {
  // Regression: a corner crossed within one tick was rejected as a swept diagonal, and a
  // waiting partner could deadlock a reversing leader at their minimum body separation.
  const snap = p => {
    const nx = Math.abs(p.x - Math.round(p.x / STREET) * STREET), nz = Math.abs(p.z - Math.round(p.z / STREET) * STREET);
    if (nx < 3 || nz < 3) return p;
    return nx > nz ? { x: p.x, z: Math.round(p.z / STREET) * STREET + 0.5 } : { x: Math.round(p.x / STREET) * STREET + 0.5, z: p.z };
  };
  for (const seed of [0, 1, 4, 7, 16, 29, 39, 42, 2026]) {
    const s = createWalk(seed); setControl(s, 'dog');
    const targets = [...s.map.scents.slice(0, 4), { x: 20, z: 0.5 }, { x: -20, z: 0.5 }, { x: 0.5, z: -20 }];
    const R = mulberry32(seed * 31 + 7);
    const arrive = (target, limit = 3000) => {
      let steps = 0;
      for (; steps < limit && distance(s.dog, target) > 0.4; steps++) {
        stepWalk(s, 1 / 30); assertPair(s);
      }
      return steps < limit;
    };
    let legs = 0;
    for (const target of targets) {
      // Start each leg from the street near the target so every leg exercises real
      // pathfinding through trees and corners inside the materialized window.
      let start = null;
      for (let tries = 0; tries < 40 && !start; tries++) {
        const p = snap(corridorPoint(R, target.x, target.z));
        if (walkable(s.map, p, 0.34) && !s.map.places.some(pl => distance(p, pl) < 5.5)) start = p;
      }
      if (!start) continue; // target fell outside the recentered window's margins; other legs cover the regression
      Object.assign(s.dog, { x: start.x, z: start.z, speed: 0 });
      Object.assign(s.handler, { x: start.x - 0.9, z: start.z + 0.9, speed: 0 });
      s.leash = ropePath(s.map, s.dog, s.handler); s.sniff = null; s.dog.goal = null;
      s.sniffCooldown = s.time + 999; s.clickGoal = null;
      if (!setDestination(s, target)) continue;
      assert.ok(arrive(target), `seed ${seed}: reached ${target.id ?? JSON.stringify(target)}`);
      // And back: turning a waiting partner around was a real deadlock.
      if (!setDestination(s, start)) continue;
      assert.ok(arrive(start), `seed ${seed}: returned from ${target.id ?? JSON.stringify(target)}`);
      legs++;
    }
    assert.ok(legs >= 4, `seed ${seed}: ${legs} legs ran, expected at least 4`);
  }
});

test('a long walk east is continuous: no teleports, a sliding window, and growing memory', () => {
  const s = createWalk(11); setControl(s, 'dog');
  const startWx = s.wx;
  let previous = { x: s.dog.x, z: s.dog.z };
  for (let leg = 1; leg <= 6; leg++) {
    const target = { x: leg * STREET, z: 2 };
    assert.equal(setDestination(s, target), true);
    for (let i = 0; i < 2400 && distance(s.dog, target) > 0.3; i++) {
      stepWalk(s, 1 / 60);
      assert.ok(distance(s.dog, previous) < 0.12, 'movement is continuous, never a jump');
      previous = { x: s.dog.x, z: s.dog.z }; assertPair(s);
    }
    assert.ok(distance(s.dog, target) < 0.4, `leg ${leg} completed`);
  }
  assert.ok(s.wx > startWx + 100, 'the window followed the pair');
  assert.ok(s.dog.x > 145, 'the pair actually crossed the world on foot');
  assert.ok(s.memory.cells.size > 15, 'the walk left a trail of explored ground');
  assert.ok(distance(s.dog, s.handler) <= LEASH.length + LEASH.give + 1e-7);
});

test('named places are discovered, journaled and remembered near the pair', () => {
  const s = createWalk(2026);
  const place = s.map.places.find(p => !s.memory.places[p.id]) ?? null;
  assert.ok(place, 'a discoverable place exists in the starting window');
  // Stand beside the fountain's walkable ring, close enough to name the corner.
  Object.assign(s.dog, { x: place.x + 2.6, z: place.z + 0.6 });
  Object.assign(s.handler, { x: place.x + 2.0, z: place.z - 0.6 });
  s.leash = ropePath(s.map, s.dog, s.handler);
  stepWalk(s, 1 / 60);
  assert.ok(s.memory.places[place.id], 'place entered into memory');
  assert.equal(s.journal[s.journal.length - 1].kind, 'place');
  assert.equal(s.event, 'place');
  assert.ok(s.memory.cells.has(cellKey(s.dog.x, s.dog.z)));
  assertPair(s);
});

test('sniff discoveries are local, take time, reduce need and cannot be farmed', () => {
  const s = createWalk(); const scent = s.map.scents[0];
  assert.equal(startSniff(s), false);
  Object.assign(s.dog, { x: scent.x, z: scent.z }); Object.assign(s.handler, { x: scent.x - 1, z: scent.z });
  s.leash = ropePath(s.map, s.dog, s.handler); setControl(s, 'dog');
  const need = s.dog.needs.stimulation;
  assert.equal(startSniff(s), true); advance(s, 1); assert.equal(s.metrics.sniffs, 0);
  advance(s, 3); assert.equal(s.metrics.sniffs, 1); assert.ok(s.discovered.includes(scent.id));
  assert.ok(s.dog.needs.stimulation < need); assert.equal(startSniff(s, scent), false);
  assert.equal(s.journal[s.journal.length - 1].kind, 'scent');
  assertPair(s);
});

test('pause stops time and rest restores energy without moving the pair', () => {
  const s = createWalk(), p = { x: s.dog.x, z: s.dog.z }, energy = s.dog.state.energy;
  s.paused = true; stepWalk(s, 5, { x: 1, z: 0 }); assert.equal(s.time, 0);
  s.paused = false; rest(s); advance(s, 5, { x: 1, z: 0 });
  assert.equal(distance(s.dog, p), 0); assert.ok(s.dog.state.energy > energy);
  rest(s); together(s); assert.ok(s.cooperateUntil > s.time);
});

test('walking saves round-trip, reject unsafe coordinates and never share the dungeon namespace', () => {
  const s = createWalk(0); setControl(s, 'auto'); advance(s, 12);
  // Walk far from home so the restore must rebuild the window around the pair's position.
  setControl(s, 'dog'); setDestination(s, { x: 60, z: 2 });
  for (let i = 0; i < 3600 && distance(s.dog, { x: 60, z: 2 }) > 0.3; i++) stepWalk(s, 1 / 60);
  const data = JSON.parse(JSON.stringify(packWalk(s))), restored = restoreWalk(data);
  assert.ok(restored); assert.equal(restored.metrics.distance, s.metrics.distance); assertPair(restored);
  assert.equal(restored.seed, 0);
  assert.equal(restored.dog.x, s.dog.x);
  assert.equal(restored.wx, (s.dog.x + s.handler.x) / 2, 'the window is rebuilt around the restored pair');
  assert.deepEqual([...restored.memory.cells].sort(), [...s.memory.cells].sort());
  assert.deepEqual(restored.memory.places, s.memory.places);
  assert.deepEqual(restored.discovered, s.discovered);
  assert.deepEqual(restored.journal, s.journal);
  assert.equal(restoreWalk({ ...data, version: 1 }), null);
  assert.equal(restoreWalk({ ...data, version: 999 }), null);
  assert.equal(restoreWalk({ ...data, dog: { ...data.dog, x: NaN } }), null);
  assert.equal(restoreWalk({ ...data, dog: { ...data.dog, x: 1e9 } }), null);
  assert.equal(restoreWalk({ ...data, dog: { ...data.dog, x: data.handler.x, z: data.handler.z } }), null);
  const store = new Map([['crawler.settings', 'untouched']]);
  const storage = { getItem: k => store.get(k), setItem: (k, v) => store.set(k, v) };
  assert.equal(writeSave(storage, s), true); assert.ok(readSave(storage));
  assert.equal(store.get('crawler.settings'), 'untouched'); assert.ok(store.has(SAVE_KEY));
  storage.setItem(SAVE_KEY, '{broken'); assert.equal(readSave(storage), null);
  assert.equal(writeSave(null, s), false); assert.equal(readSave(null), null);
});

test('large steps subdivide and invalid timesteps do not corrupt state', () => {
  const a = createWalk(), b = createWalk(); setControl(a, 'dog'); setControl(b, 'dog');
  stepWalk(a, 0.5, { x: 1, z: 0 }); for (let i = 0; i < 15; i++) stepWalk(b, 1 / 30, { x: 1, z: 0 });
  assert.ok(distance(a.dog, b.dog) < 1e-8); assertPair(a);
  const time = a.time; for (const dt of [NaN, Infinity, -1, 0]) stepWalk(a, dt); assert.equal(a.time, time);
});
