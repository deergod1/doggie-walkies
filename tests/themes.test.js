import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEMES, TOWN, CORE, ACTS } from '../src/themes/index.js';
import { worldThemes, themesAt, themeAt, themeOf, themeById, lightAt, actAt, SHARE, LONGEST, MAX_DEPTH } from '../src/themes/depth.js';
import { BUILDS } from '../src/themes/builds.js';
import { PALETTES } from '../src/cubegen/arenaprops.js';
import { RECIPES } from '../src/cubegen/sites.js';
import { PROP_METADATA } from '../src/core/propmetadata.js';
import { props } from '../src/core/propcatalog.js';
import { placeProps } from '../src/render/propplace.js';
import { makeLayouts } from '../src/world/layout.js';
import { World } from '../src/world/world.js';


const ids = THEMES.map(t => t.props);
const DEPTHS = Array.from({ length: MAX_DEPTH + 1 }, (_, d) => d);

test('every world shows half of each act\'s themes, in story order, each about as often as any other', () => {
  const seen = new Map(), N = 2000;
  for (let seed = 0; seed < N; seed++) {
    // (forcing a theme that is no theme computes them afresh, past the cache)
    const picks = worldThemes(seed), again = worldThemes(seed, ['none']);
    assert.deepEqual(picks.map(p => [p.at, p.theme.props]), again.map(p => [p.at, p.theme.props]));
    assert.equal(picks[0].at, 0);
    picks.forEach((p, i) => i && assert.ok(p.at > picks[i - 1].at && p.theme !== picks[i - 1].theme, 'stretches'));
    for (const d of DEPTHS) assert.ok(themesAt(d).includes(themeAt(d, picks)), `${seed}/${d}: ${themeAt(d, picks).props}`);
    // every act in its story order, no theme for more than LONGEST depths (but the abyss, which
    // goes on into the core)
    for (let a = 1; a < ACTS.length; a++) {
      const [from, to] = ACTS[a], pool = themesAt(from), here = picks.filter(p => p.at >= from && p.at <= to);
      here.forEach((p, i) => i && assert.ok(pool.indexOf(p.theme) > pool.indexOf(here[i - 1].theme), `${seed}: act ${a} in order`));
      for (const t of new Set(DEPTHS.filter(d => d >= from && d <= to).map(d => themeAt(d, picks)))) seen.set(t, (seen.get(t) || 0) + 1);
      for (const p of here) {
        const end = Math.min(to + 1, picks[picks.indexOf(p) + 1]?.at ?? MAX_DEPTH + 1);
        assert.ok(end - p.at <= LONGEST, `${seed}: ${p.theme.props} for ${end - p.at} depths`);
      }
    }
  }
  // every theme comes up about as often as every other, whatever its act, but those with a weight:
  // the slime marsh in about 80% of the worlds, the rest of its act a little less often
  const often = t => seen.get(t) / N, weighted = THEMES.filter(t => (t.weight ?? 1) !== 1);
  assert.deepEqual(weighted.map(t => t.props), ['slime']);
  assert.ok(Math.abs(often(weighted[0]) - 0.8) < 0.04, `slime: ${often(weighted[0])}`);
  for (const t of THEMES) {
    if (weighted.includes(t)) continue;
    const others = weighted.filter(w => w.act === t.act), pool = THEMES.filter(p => p.act === t.act);
    const expect = (SHARE * pool.length - others.reduce((s, w) => s + often(w), 0)) / (pool.length - others.length);
    assert.ok(Math.abs(often(t) - expect) < 0.04, `${t.props}: ${often(t)}, not ${expect}`);
  }
  // the town is always in the meadows, the core in the abyss
  assert.deepEqual(themesAt(0), [TOWN]);
  assert.deepEqual(themesAt(MAX_DEPTH), [CORE]);
  for (let seed = 0; seed < 50; seed++) {
    assert.equal(themeAt(0, worldThemes(seed)), TOWN);
    assert.equal(themeAt(MAX_DEPTH, worldThemes(seed)), CORE);
  }
});

test('forced themes win every depth they may appear at; the light blends between stretches', () => {
  const picks = worldThemes(7, ['clouds', 'forge', 'ossuary']);
  assert.equal(themeAt(0, picks), TOWN);
  for (const [d, id] of [[1, 'clouds'], [6, 'clouds'], [7, 'forge'], [13, 'forge'], [14, 'ossuary'], [19, 'ossuary']])
    assert.equal(themeAt(d, picks).props, id);
  // two in one act share it, in story order; the acts without any as they would be
  const two = worldThemes(7, ['canyon', 'meadow']);
  assert.deepEqual([1, 3, 4, 6].map(d => themeAt(d, two).props), ['meadow', 'meadow', 'canyon', 'canyon']);
  for (let d = 7; d <= MAX_DEPTH; d++) assert.equal(themeAt(d, two), themeAt(d, worldThemes(7)));
  // the meadows from the town down to the peaks are one stretch of light
  const meadow = themeById('meadow'), peaks = themeById('peaks'), flats = themeById('saltflats');
  const world = [{ at: 0, theme: meadow }, { at: 3, theme: peaks }, { at: 4, theme: flats }];
  const { a, b, t } = lightAt(1, world);
  assert.equal(a, meadow.light); assert.equal(b, peaks.light); assert.ok(Math.abs(t - 1 / 3) < 1e-9);
  assert.deepEqual(lightAt(3.5, world), { a: peaks.light, b: flats.light, t: 0.5 });
  assert.deepEqual(lightAt(9, world), { a: flats.light, b: flats.light, t: 0 });
  // a map is its stamp's theme, and a map without one is a bug
  assert.equal(themeOf({ biome: 'hive' }), themeById('hive'));
  assert.throws(() => themeOf({ key: '0,-1,0' }));
});

test('every theme is complete: depths of its kind, structures, footing props, arenas, sites and spans', () => {
  for (const d of DEPTHS) assert.ok(themesAt(d).length, `no theme at depth ${d}`);
  // the acts follow on from the town to the core
  assert.deepEqual(ACTS.slice(1).flatMap(([a, b]) => [a, b]), [1, 6, 7, 13, 14, MAX_DEPTH - 1]);
  assert.equal(new Set(ids).size, ids.length, 'theme ids (prop sets) are unique');
  for (const t of THEMES) {
    assert.ok([1, 2, 3].includes(t.act) && t.depths === ACTS[t.act], `${t.props}: act`);
    // act III is walled in, every theme of it; acts I and II have open ones and walled ones
    if (t.act === 3) assert.ok(t.cave || t.walls, `${t.props}: walled in`);
    assert.ok(BUILDS[t.props], `${t.props}: structures`);
    assert.ok(PALETTES[t.props], `${t.props}: arena palette`);
    assert.ok(RECIPES[t.props], `${t.props}: site recipe`);
    const set = PROP_METADATA.filter(p => p.set === t.props && p.attach === 'ground' && !p.landmark);
    assert.ok(set.some(p => p.cover) && set.some(p => !p.cover), `${t.props}: ground props`);
    for (const k of ['top', 'side', 'lip', 'under', 'bed', 'fluids', 'river', 'arche', 'light', 'music'])
      assert.ok(t[k] !== undefined, `${t.props}: ${k}`);
    // gorge spans: every theme has them (some more often than others); decks stay under a cave's walls
    const s = t.spans;
    assert.ok(s && s.chance > 0 && s.chance <= 1 && s.max >= 1, `${t.props}: spans`);
    for (const k of ['route', 'island', 'sky']) assert.ok(s[k] >= 0 && s[k] <= 1, `${t.props}: spans.${k}`);
    if (t.cave) assert.ok(s.deck <= 16, `${t.props}: decks under the cave walls`);
  }
});

// a third of the depths each: light (the sky down to the canyons), medium (the sunlit caves), dark;
// a night theme (the dark forest) is under the sky in the light band, but lit like the deep
const band = d => d === 0 ? 'light' : d === MAX_DEPTH ? 'dark' : [null, 'light', 'medium', 'dark'][actAt(d)];
test('the light comes in three bands of depths: light, medium and dark (and night under the sky)', () => {
  const look = t => {
    const { sun, hemi, lamp = 0 } = t.light;
    return lamp === 0 && sun[1] >= 1.6 ? 'light' : lamp > 0 && lamp < 1 && sun[1] >= 1 && sun[1] < 1.6 ? 'medium'
      : lamp === 1 && sun[1] <= 0.6 && hemi[2] <= 0.6 ? 'dark' : '?';
  };
  for (const t of THEMES) for (let d = t.depths[0]; d <= t.depths[1]; d++)
    assert.equal(look(t), t.night ? 'dark' : band(d), `${t.props} at ${d}`);
  for (const t of THEMES.filter(t => t.night)) assert.ok(!t.cave && band(t.depths[1]) === 'light' && t.light.stars > 0, `${t.props}: a night sky`);
  // under the sky the world's nights: lit like the deep (tests/daycycle.test.js)
  for (const t of THEMES.filter(t => t.light.night)) {
    assert.ok(!t.cave && !t.walls && t.light.night.stars > 0, `${t.props}: a night sky`);
    assert.equal(look({ light: t.light.night }), 'dark', `${t.props}: its night`);
  }
  assert.ok(THEMES.some(t => t.light.night), 'the slime marsh has a night of its own');
  assert.ok(THEMES.some(t => t.night), 'the dark forest is a night theme');
  assert.deepEqual(['light', 'medium', 'dark'].map(b => DEPTHS.filter(d => band(d) === b).length), [7, 7, 7]);
  // open themes under the sky in the light band; in the medium band too, under its haze (dimmer
  // stars, if any); walled in in the dark one
  for (const t of THEMES) if (!t.cave && t.act === 2) assert.ok((t.light.stars ?? 0) <= 0.3, `${t.props}: hazy stars`);
  assert.ok(THEMES.some(t => t.act === 2 && !t.cave) && THEMES.some(t => t.act === 2 && t.cave), 'act II: open and walled');
});

// the backdrop's nebula (render/sky.js) in every theme: its band (haze) brighter than the sky's
// top, also in the dark caves, where only the stars go out
test('every sky has a nebula, the caves a faint one without stars', () => {
  const lum = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  for (const t of [...THEMES, TOWN, CORE]) {
    const { sky, stars = 0 } = t.light;
    assert.equal(sky.length, 4, `${t.props}: top, bottom, haze and tint`);
    assert.ok(lum(sky[2]) >= lum(sky[0]) + 8 && lum(sky[2]) >= 18, `${t.props}: a nebula to see`);
    if (t.cave) assert.equal(stars, 0, `${t.props}: no stars under the rock`);
  }
});

test('the route, its guardians and hordes never depend on the themes a world picked', () => {
  const shape = L => DEPTHS.map(d => {
    const l = L(d);
    return { route: l.route, guardians: [...l.guardians.keys()], hordes: [...l.hordes.keys()] };
  });
  for (const seed of [1, 2, 3, 4]) {
    const own = shape(makeLayouts(seed, worldThemes(seed)));
    for (const force of [['clouds', 'highlands', 'saltflats', 'grotto', 'hive', 'ossuary', 'forge', 'cenote'], ['lagoon'], ['karst', 'nests'], ['darkforest'], ['slime', 'canyon']])
      assert.deepEqual(shape(makeLayouts(seed, worldThemes(seed, force))), own, `seed ${seed}: ${force}`);
  }
});

test('every theme generates its depths, stamps its maps and dresses them from its set', () => {
  for (const theme of THEMES) {
    const w = new World(5, { themes: [theme.props] });
    let own = 0;
    for (let d = theme.depths[0]; d <= Math.min(theme.depths[1], MAX_DEPTH - 1); d++) for (const k of w.layout(d).route.slice(0, 3)) {
      const m = w.cube(k).map;
      assert.equal(m.biome, theme.props);
      assert.equal(themeOf(m), theme);
      own += placeProps(m, themeOf(m)).out.filter(q => q.name.startsWith(theme.props + '_')).length;
    }
    assert.ok(own > 0, `${theme.props}: no props of its own`);
  }
});
