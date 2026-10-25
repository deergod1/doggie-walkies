// The boss arenas look like the theme of their depth, whatever generator builds them
// (docs/bosses.md "An arena of its own", themes/surfaces.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { World } from '../src/world/world.js';
import { generate } from '../src/cubegen/index.js';
import { BOSSES, BOSS_ARENAS } from '../src/core/bosses.js';
import { themesAt } from '../src/themes/depth.js';
import { THEMES, TOWN, CORE } from '../src/themes/index.js';
import { SURFACE_ROLES, surfacesOf } from '../src/themes/surfaces.js';
import { BOSS_SHAPES } from '../src/cubegen/arenashapes.js';
import { buildCubeGeometry } from '../src/render/cubegeo.js';
import { surfaceAt } from '../src/core/footing.js';
import { propMetadata } from '../src/core/propcatalog.js';

// [depth, boss] of every boss who brings an arena
const ARENAS = Object.entries(BOSSES).filter(([, b]) => BOSS_ARENAS[b]?.type).map(([d, b]) => [Number(d), b]);
const HEX = /^#[0-9a-f]{6}$/;

test('every theme has every built surface, and a theme may set its own', () => {
  for (const theme of [...THEMES, TOWN, CORE]) {
    const s = surfacesOf(theme);
    assert.deepEqual(Object.keys(s).sort(), [...SURFACE_ROLES].sort(), theme.props);
    for (const role of SURFACE_ROLES) {
      const r = s[role];
      for (const c of [r.top, r.alt, ...r.side, r.under]) assert.match(c, HEX, `${theme.props} ${role}`);
      assert.equal(r.side.length, 2);
    }
  }
  const own = surfacesOf({ ...TOWN, surfaces: { masonry: { top: '#123456' } } });
  assert.equal(own.masonry.top, '#123456');
  assert.equal(own.masonry.alt, surfacesOf(TOWN).masonry.alt);
  // (and the themes do not all build alike)
  assert.ok(new Set(THEMES.map(t => surfacesOf(t).masonry.top)).size > THEMES.length / 2);
});

test('every boss arena is built in the theme of its depth: surfaces by role, never a colour', () => {
  for (const [depth, boss] of ARENAS) {
    const own = BOSS_ARENAS[boss], spec = new World(1).descentSpec(depth);
    const looks = new Map();
    for (const theme of themesAt(depth)) {
      const m = generate({ ...spec, biome: theme.props });
      const what = `${boss} in ${theme.props}`;
      assert.equal(m.arena.type, own.type, what);
      assert.equal(m.biome, theme.props, what);
      for (const f of m.floors) {
        assert.equal(f.paint, undefined, what);
        if (f.surface !== undefined) assert.ok(SURFACE_ROLES.includes(f.surface), `${what}: ${f.surface}`);
      }
      // what an arena of its own strews about: its theme's, neutral stones, and what it brings
      if (!BOSS_SHAPES[own.type]) {
        const sets = new Set([theme.props, 'any', 'ruins', ...own.props ?? []]);
        for (const q of [...m.arenaPlacements, ...m.flip?.clutter ?? []]) assert.ok(sets.has(propMetadata.get(q.name)?.set), `${what}: ${q.name}`);
      }
      // the colours drawn: the mean of every vertex colour of its terrain and stone
      const sum = [0, 0, 0];
      let n = 0;
      for (const L of buildCubeGeometry(m)) for (const part of [L.terrain, L.stone]) if (part) {
        for (let i = 0; i < part.col.length; i += 3) { sum[0] += part.col[i]; sum[1] += part.col[i + 1]; sum[2] += part.col[i + 2]; n++; }
      }
      looks.set(theme.props, sum.map(v => (v / n).toFixed(3)).join());
    }
    // no two themes draw it alike
    assert.equal(new Set(looks.values()).size, looks.size, `${boss}: ${[...looks].join(' | ')}`);
  }
});

test('built floors sound like what they are built of', () => {
  const at = surface => surfaceAt({ top: 10, link: [], surface }, {}, 'meadow', 0, 0);
  assert.equal(at('masonry'), 'stone');
  assert.equal(at('crust'), 'gravel');
  assert.equal(at(undefined), 'grass');   // (the terrain: meadow's grass)
});

test('the generators name no colours: those are the themes\' (themes/surfaces.js)', () => {
  const dir = new URL('../src/cubegen/', import.meta.url);
  const files = readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.js'));
  assert.ok(files.length > 20);
  for (const f of files) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.doesNotMatch(src, /['"`]#[0-9a-fA-F]{3,8}['"`]/, f);
  }
});
