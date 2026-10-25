// Days and nights (core/daycycle.js): a theme with a `cycle` (the slime marsh) is light for `day`
// seconds and dark for `night`, turning over `fade` seconds at the end of each half.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nightAt, isNight, nextTurn } from '../src/core/daycycle.js';
import { themeById } from '../src/themes/depth.js';

const cycle = themeById('slime').cycle;

test('the slime marsh: 45 s of day, 45 s of night, turning in between', () => {
  assert.deepEqual([cycle.day, cycle.night], [45, 45]);
  assert.equal(nightAt(cycle, 0), 0, 'a world begins by day');
  assert.equal(nightAt(cycle, 30), 0);
  assert.equal(nightAt(cycle, 46), 1);
  assert.equal(nightAt(cycle, 80), 1);
  assert.equal(nightAt(cycle, 90), 0, 'and round again');
  assert.equal(nightAt(cycle, 90 * 7 + 50), 1);
  // the turn: smooth, all within the fade at the end of the half
  const at = s => nightAt(cycle, s);
  assert.ok(at(45 - cycle.fade) === 0 && at(45) === 1);
  assert.ok(at(43) > at(42) && at(42) > at(41.5));
  assert.ok(Math.abs(at(45 - cycle.fade / 2) - 0.5) < 1e-9);
  assert.ok(at(88) < at(87) && Math.abs(at(90 - cycle.fade / 2) - 0.5) < 1e-9);
  assert.ok(!isNight(cycle, 40) && isNight(cycle, 44) && isNight(cycle, 87) && !isNight(cycle, 89));
  // no cycle: always day
  assert.equal(nightAt(null, 60), 0);
});

test('the next turn comes when the light is halfway turned', () => {
  assert.equal(nextTurn(cycle, 0), 43);
  assert.equal(nextTurn(cycle, 50), 38);
  assert.equal(nextTurn(cycle, 89), 44);
  for (const s of [0, 12.5, 50, 88.5]) assert.ok(Math.abs(nightAt(cycle, s + nextTurn(cycle, s)) - 0.5) < 1e-9);
});
