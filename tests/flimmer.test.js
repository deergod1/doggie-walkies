// The Flimmer (core/enemies.js FLIMMER): a small, blurry person that comes in threes, beats you with
// five quick punches, and while it shimmers lets blows and shots go right through it now and then
// (tests/browser/flimmer.js plays it out with the real AI, views and weapons).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flatMap } from './fixtures.js';
import { FLIMMER, FROST_FLIMMER, HAZE_FLIMMER, SHADOW_FLIMMER, RENEW, SPIDER, ENEMY_KINDS, makeEnemy, shimmerOf, evades,
  attackDamage, attackOf } from '../src/core/enemies.js';
import { DEPTH_SPAWNS, population } from '../src/core/spawns.js';
import { enemySpots } from '../src/game/enemyspawn.js';
import { createPlayerStats } from '../src/core/progression.js';
import { swordState, weaponHit, SWORD } from '../src/core/combat.js';
import { launchShot, stepShot } from '../src/core/shots.js';

const KINDS = [FLIMMER, FROST_FLIMMER, HAZE_FLIMMER, SHADOW_FLIMMER];

test('a Flimmer is the hero\'s own figure, every kind well below the hero\'s height', () => {
  for (const k of KINDS) {
    assert.ok(k.figure && k.model === 'character' && k.species === 'flimmer', k.type);
    // (Renew is the hero's figure at the hero's size)
    assert.ok(k.height <= RENEW.height * 0.75 && k.size <= 0.75 && k.bodyHeight < k.height, `${k.type}: ${k.height}`);
    assert.equal(k.troop, 3); assert.equal(k.blur.evade, FLIMMER.blur.evade);
    assert.match(k.attacks[0].reason, new RegExp(k.label));
  }
  assert.ok(FLIMMER.blur.evade > 0.2 && FLIMMER.blur.evade < 0.6);
});

test('its beating is five quick punches, the last one the hardest, and counts as all of them', () => {
  const [a] = FLIMMER.attacks, times = [a.hitAt, ...a.more.map(m => m.at)];
  assert.equal(times.length, 5);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1] && times[i] - times[i - 1] < 0.3, 'quick, one after the other');
  assert.ok(a.hitAt >= 0.4, 'fists up first: time to see it coming');
  assert.ok(times.at(-1) < a.attackTime && a.trackUntil < times.at(-1));
  const last = a.more.at(-1);
  assert.ok(last.power > a.power && last.knock > a.knock, 'the last one shoves you away');
  assert.ok(a.press && a.press.from < a.hitAt && a.press.to <= times.at(-1), 'it steps after you while it beats you');
  const damage = n => Math.round(FLIMMER.damage * n);
  assert.equal(attackDamage(FLIMMER), damage(a.power) * 4 + damage(last.power));
});

test('it shimmers unless it beats you or reels, and only then may a blow go through it', () => {
  const e = makeEnemy({ x: 0, y: 0, z: 0, level: 3 }, FLIMMER);
  e.mode = 'chase';
  assert.equal(shimmerOf(e), 1);
  assert.ok(evades(e, 0) && evades(e, FLIMMER.blur.evade - 0.01) && !evades(e, FLIMMER.blur.evade + 0.01));
  for (const [what, set] of [['beating you', { mode: 'attack' }], ['stunned', { mode: 'chase', stun: 0.2 }], ['dead', { mode: 'dead' }]]) {
    const f = Object.assign(makeEnemy({ x: 0, y: 0, z: 0, level: 3 }, FLIMMER), set);
    assert.equal(shimmerOf(f), 0, what); assert.ok(!evades(f, 0), what);
  }
  const spider = Object.assign(makeEnemy({ x: 0, y: 0, z: 0 }, SPIDER), { mode: 'chase' });
  assert.equal(shimmerOf(spider), 0); assert.ok(!evades(spider, 0), 'nothing else is blurry');
});

test('a blow that goes through it does nothing; one that lands hurts as any', () => {
  const p = { ...createPlayerStats(), x: 0, y: 0, z: 0, yaw: 0, stun: 0, sword: swordState() };
  const e = Object.assign(makeEnemy({ x: 0, y: 0, z: 0.5, level: 1 }, FLIMMER), { mode: 'chase' }), hp = e.hp;
  assert.deepEqual(weaponHit(p, SWORD, e, 1, 1, 0), { evaded: true, damage: 0, crit: false });
  assert.equal(e.hp, hp);
  const hit = weaponHit(p, SWORD, e, 1, 1, 0.99);
  assert.ok(!hit.evaded && hit.damage > 0 && e.hp < hp);
  e.hp = hp; e.mode = 'attack'; e.stun = 0;
  assert.ok(weaponHit(p, SWORD, e, 1, 1, 0).damage > 0, 'in focus every blow lands');
});

test('a shot goes on through a Flimmer it slips past, to what is behind it', () => {
  const p = { ...createPlayerStats(), x: 0, y: 0, z: 0, yaw: 0, stun: 0, sword: swordState() };
  const flimmer = Object.assign(makeEnemy({ x: 0, y: 0, z: 1.5 }, FLIMMER), { mode: 'chase' });
  const spider = Object.assign(makeEnemy({ x: 0, y: 0, z: 2.2 }, SPIDER), { mode: 'chase' });
  const stats = { kind: 'bow', range: 8, pierce: 0 }, run = dodges => {
    const shot = launchShot(p, stats, flimmer, 0), out = { hits: [], misses: [] };   // (aimed at the Flimmer, down at its middle)
    for (let i = 0; i < 60 && !out.end; i++) {
      const r = stepShot(shot, 1 / 60, [flimmer, spider], () => false, dodges);
      out.hits.push(...r.hits); out.misses.push(...r.misses); out.end = r.end;
    }
    return out;
  };
  const through = run(e => evades(e, 0));
  assert.deepEqual(through.misses, [flimmer]); assert.deepEqual(through.hits, [spider]); assert.equal(through.end, 'hit');
  const caught = run(e => evades(e, 0.99));
  assert.deepEqual(caught.hits, [flimmer]); assert.deepEqual(caught.misses, []);
});

test('Flimmers come in whole troops of three, each troop one kind, close together', () => {
  const rows = DEPTH_SPAWNS.flatMap((d, depth) => d.roster.map(r => ({ ...r, depth }))).filter(r => r.type === 'flimmer');
  assert.deepEqual([...new Set(rows.map(r => r.depth))], [2, 3, 4, 5, 6], 'the first act, where it had the fewest kinds');
  for (const r of rows) assert.ok(r.lo % 3 === 0 && r.hi % 3 === 0 && r.pack === 3, `depth ${r.depth}`);
  let troops = 0;
  for (let seed = 0; seed < 300 && troops < 12; seed++) for (const depth of [2, 4, 6]) {
    const map = Object.assign(flatMap(seed), { depth, biome: seed % 2 ? 'darkforest' : 'badlands' }), spec = population(map).get('flimmer');
    if (!spec) continue;
    assert.equal(spec.count % 3, 0);
    const spots = enemySpots(map, FLIMMER);
    assert.equal(spots.length % 3, 0, `seed ${seed} depth ${depth}`);
    for (let i = 0; i < spots.length; i += 3) {
      const troop = spots.slice(i, i + 3);
      assert.equal(new Set(troop.map(s => s.kind.type)).size, 1, 'one kind a troop');
      for (const s of troop) assert.ok(Math.hypot(s.x - troop[0].x, s.z - troop[0].z) < 3.5, 'together');
      troops++;
    }
    if (map.biome === 'darkforest' && depth >= 4) for (const s of spots) assert.equal(s.kind, SHADOW_FLIMMER);
  }
  assert.ok(troops >= 12, `${troops} troops`);
  // (made up from the population's own scale: half as many is still a whole troop)
  for (let seed = 0; seed < 100; seed++) {
    const spec = population(Object.assign(flatMap(seed), { depth: 5, biome: 'badlands', populationScale: 0.5 })).get('flimmer');
    if (spec) assert.ok(spec.count >= 3 && spec.count % 3 === 0);
  }
  assert.ok(Object.values(ENEMY_KINDS).filter(k => k.species === 'flimmer' && !k.guardian).length >= 4);
  assert.equal(attackOf(makeEnemy({ x: 0, y: 0, z: 0 }, HAZE_FLIMMER)).clip, 'pummel');
});
