// The world's days and nights (core/daycycle.js): one cycle of three and a half minutes on the
// world's play time, a morning-to-evening sun along its path, the dusk, the night, the dawn; what
// each theme's sky makes of it (themes/index.js `sky`, themes/skies.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY, nightAt, isNight, nextTurn, glowAt, sunPath, sunAt, SUN_KEYS, SUN_LOW, BAKE_EVERY, NOON, NOON_KEY, nextDaytime, DAYTIMES, dayPhase } from '../src/core/daycycle.js';
import { THEMES, TOWN } from '../src/themes/index.js';
import { themeById } from '../src/themes/depth.js';
import { nightLight, dayLight } from '../src/themes/skies.js';

const { day, dusk, night, dawn } = DAY;

test('a day of the world: three and a half minutes, the sun up most of it', () => {
  assert.equal(DAY.length, 210);
  assert.equal(nightAt(0), 0, 'a world begins in the morning');
  assert.equal(nightAt(day / 2), 0);
  assert.equal(nightAt(day + dusk), 1);
  assert.equal(nightAt(day + dusk + night - 1), 1);
  assert.equal(nightAt(DAY.length), 0, 'and round again');
  assert.equal(nightAt(DAY.length * 7 + day + dusk + 5), 1);
  // the turns: smooth, over the dusk and the dawn
  assert.ok(nightAt(day + 3) > nightAt(day + 1) && nightAt(day + 1) > 0);
  assert.ok(Math.abs(nightAt(day + dusk / 2) - 0.5) < 1e-9 && Math.abs(nightAt(DAY.length - dawn / 2) - 0.5) < 1e-9);
  assert.ok(!isNight(day) && isNight(day + dusk) && !isNight(DAY.length - 1));
  for (const s of [0, 12.5, day + 1, day + dusk + 3, DAY.length - 2]) assert.ok(Math.abs(nightAt(s + nextTurn(s)) - 0.5) < 1e-9);
  assert.equal(nextTurn(0), day + dusk / 2);
  // the warm light of mornings and evenings, not at noon
  assert.equal(glowAt(0), 1);
  assert.equal(glowAt(day / 2), 0);
  assert.ok(glowAt(day - 5) > 0.5);
});

test('the times of day the dev command goes to', () => {
  for (const [name, at] of Object.entries(DAYTIMES)) {
    for (const from of [0, 77, 500.5]) {
      const to = nextDaytime(from, name);
      assert.ok(to > from && to - from <= DAY.length + 1e-9, `${name} from ${from}`);
      assert.ok(Math.abs(dayPhase(to) - at) < 1e-9);
    }
  }
  assert.ok(nightAt(nextDaytime(0, 'night')) === 1 && nightAt(nextDaytime(0, 'noon')) === 0);
});

test("the sun's path: high at noon, never under its lowest, shadows moving evenly", () => {
  const elev = d => Math.asin(d[1]) * 180 / Math.PI;
  for (const low of [SUN_LOW, 50]) {
    const { keys, travel } = sunPath(low);
    assert.equal(keys.length, SUN_KEYS + 1);
    for (const k of keys) {
      assert.ok(Math.abs(Math.hypot(...k.dir) - 1) < 1e-9);
      assert.ok(elev(k.dir) >= low - 1e-6, `${k.id} at ${elev(k.dir)}`);
    }
    assert.ok(Math.abs(elev(keys[0].dir) - low) < 1e-6 && Math.abs(elev(keys.at(-1).dir) - low) < 1e-6, 'it rises and sets at its lowest');
    assert.ok(Math.abs(elev(keys[SUN_KEYS >> 1].dir) - elev(NOON)) < 2, 'high at noon');
    // the tip of a 10-high thing's shadow moves as far from one key to the next, at most ~0.3
    const tip = d => [-d[0] / d[1], -d[2] / d[1]], gaps = keys.slice(1).map((k, i) => Math.hypot(tip(k.dir)[0] - tip(keys[i].dir)[0], tip(k.dir)[1] - tip(keys[i].dir)[1]) * 10);
    for (const g of gaps) assert.ok(Math.abs(g - travel * 10 / SUN_KEYS) < 0.01 && g < 0.31, `${g}`);
  }
  assert.ok(Math.abs(DAY.day / SUN_KEYS - BAKE_EVERY) < 0.02, 'a key every 1.5 s of the day');
});

test('where the sun stands: between two keys by day, the moon at noon by night', () => {
  const { keys } = sunPath();
  let s = sunAt(0);
  assert.ok(s.a === keys[0] && s.b === keys[1] && s.t === 0 && s.next === keys[2] && s.light === 1);
  s = sunAt(BAKE_EVERY * 10.5);
  assert.ok(s.a === keys[10] && s.b === keys[11] && Math.abs(s.t - 0.5) < 0.05);
  s = sunAt(day - 0.01);
  assert.ok(s.b === keys[SUN_KEYS] && s.next === NOON_KEY);
  // the dusk: the sun goes at its last place, the moon comes; neither halfway
  s = sunAt(day + 1);
  assert.ok(s.a === keys[SUN_KEYS] && s.light < 1 && s.light > 0.5);
  assert.ok(sunAt(day + dusk / 2 - 0.01).light < 0.01);
  s = sunAt(day + dusk - 1);
  assert.ok(s.a === NOON_KEY && s.light > 0.5 && s.next === keys[0]);
  s = sunAt(day + dusk + night / 2);
  assert.ok(s.a === NOON_KEY && s.b === NOON_KEY && s.light === 1 && s.next === keys[0]);
  // the dawn: the moon goes, the sun comes up at its first place
  assert.ok(sunAt(DAY.length - 1).a === keys[0] && sunAt(DAY.length - dawn + 1).a === NOON_KEY);
  // the canyon's path is its own
  assert.ok(sunAt(0, 50).a.id !== sunAt(0).a.id);
});

test("every theme's sky, and its light at night (lit like the deep)", () => {
  const sky = id => themeById(id).sky;
  assert.equal(sky('meadow'), 'open');
  assert.equal(TOWN.sky, 'open');
  assert.equal(sky('darkforest'), 'night');
  assert.equal(sky('canyon'), 'open');
  assert.equal(themeById('canyon').sunLow, 50);
  for (const id of ['slime', 'forge', 'swamp', 'cenote']) assert.equal(sky(id), 'hazy', id);
  for (const t of THEMES) {
    if (t.cave) assert.equal(t.sky, 'none', t.props);
    else assert.notEqual(t.sky, 'none', t.props);
    if (t.act === 3) assert.equal(t.sky, 'none', t.props);
    if (t.sky === 'none' || t.sky === 'night') continue;
    const N = nightLight(t);
    assert.ok(N.lamp === 1 && N.sun[1] <= 0.6 && N.hemi[2] <= 0.6 && N.stars > 0, `${t.props}: its night`);
    for (const c of N.sky) assert.match(c, /^#[0-9a-f]{6}$/);
  }
  // a night theme by day: a little lighter, never day
  const df = themeById('darkforest'), D = dayLight(df);
  assert.ok(D.hemi[2] > df.light.hemi[2] && D.sun[1] > df.light.sun[1] && D.sun[1] < 1 && D.lamp > 0.5);
  assert.ok(themeById('slime').nightMotes && themeById('slime').meteors);
});
