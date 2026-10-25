// Slime meteorites (core/meteors.js): at the world's night in the slime marsh, from the world's
// play time, the same in every game; their blow grows with the depth and slows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { METEOR, nightMeteors, meteorsAt, fallAt, warnAt, meteorBlow, enemyMeteorDamage } from '../src/core/meteors.js';
import { nightAt, DAY } from '../src/core/daycycle.js';
import { themeById } from '../src/themes/depth.js';

const slime = themeById('slime'), period = DAY.length;

test('they fall at night only, every few seconds, the same for the same night and cube', () => {
  assert.ok(slime.meteors && slime.sky === 'hazy');
  const list = nightMeteors(77, '3,-4,1', 2);
  assert.ok(list.length >= 9 && list.length <= 20, `${list.length} a night`);
  for (const m of list) {
    assert.ok(nightAt(m.t) === 1 && nightAt(m.t - METEOR.warn) > 0.5, 'its shadow and its landing at night');
    assert.ok(m.u >= 0 && m.u < 1 && m.v >= 0 && m.v < 1);
  }
  for (let i = 1; i < list.length; i++) {
    const gap = list[i].t - list[i - 1].t;
    assert.ok(gap >= METEOR.every[0] - 1e-9 && gap <= METEOR.every[1] + 1e-9);
  }
  assert.deepEqual(nightMeteors(77, '3,-4,1', 2), list, 'from the seed, the cube and the night alone');
  assert.notDeepEqual(nightMeteors(77, '3,-4,2', 2).map(m => m.t), list.map(m => m.t), 'each cube its own');
  assert.notDeepEqual(nightMeteors(77, '3,-4,1', 3).map(m => m.t - period), list.map(m => m.t), 'each night its own');
  const aimed = list.filter(m => m.aimed).length;
  assert.ok(aimed < list.length, 'most anywhere in the cube');
  // none by day
  for (let t = 0; t < DAY.day + DAY.dusk / 2; t += 0.5) assert.deepEqual(meteorsAt(77, '3,-4,1', 2 * period + t), []);
  // at night: the ones whose shadows show
  const m = list[1], now = meteorsAt(77, '3,-4,1', m.t - 0.5);
  assert.ok(now.some(x => x.id === m.id));
  assert.ok(warnAt(m, m.t - METEOR.warn) < 1e-9 && warnAt(m, m.t) > 1 - 1e-9);
  assert.ok(fallAt(m, m.t - METEOR.fall - 0.1) === 0 && fallAt(m, m.t) > 1 - 1e-9 && fallAt(m, m.t - METEOR.fall / 2) > 0);
});

test('a meteorite hurts more deeper down, slows, and does not knock you over', () => {
  const a = meteorBlow(4), b = meteorBlow(5);
  assert.ok(b.damage > a.damage && a.damage >= METEOR.damage);
  assert.ok(!a.knockDown && a.slow.slow < 1 && !a.slow.weapons);
  assert.ok(enemyMeteorDamage(4) > a.damage);
});
