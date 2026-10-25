// The lights of the deep: every theme of act III (depth 14 down) has light sources in every room,
// its glowing props flicker or breathe, its lamps by the way leave the way walkable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { N, LAVA, CHAR_R } from '../src/core/constants.js';
import { World } from '../src/world/world.js';
import { placeProps } from '../src/render/propplace.js';
import { themeOf, themesAt, MAX_DEPTH } from '../src/themes/depth.js';
import { THEMES } from '../src/themes/index.js';
import { props, FIRES } from '../src/core/propcatalog.js';
import { containsXZ } from '../src/core/blockers.js';

const lit = q => { const p = props.byName.get(q.name); return p?.light && !p.cover && !q.unlit; };
const rooms = (seed, theme, d) => {
  const w = new World(seed, { themes: [theme] }), out = [];
  for (const k of w.layout(d).exists) { const m = w.cube(k).map; if (m.biome === theme && !m.guardian) out.push(m); }
  return out;
};

test('every room from depth 14 down has lights of its own, a fair number on the whole', () => {
  for (let d = 14; d <= MAX_DEPTH; d++) for (const t of themesAt(d)) {
    let sources = 0, n = 0;
    for (const m of rooms(1, t.props, d)) {
      const own = placeProps(m, themeOf(m)).out.filter(lit).length + m.floors.filter(f => f.fluid === LAVA).length;
      assert.ok(own > 0, `${t.props} at ${d}: ${m.key} has no light`);
      sources += own; n++;
    }
    assert.ok(sources / n >= 8, `${t.props} at ${d}: ${(sources / n).toFixed(1)} lights a room`);
  }
});

test("glowing props flicker like a flame, breathe or burn (but the town's windows and the trials' parts)", () => {
  for (const p of props.byName.values()) if (p.light && !['town', 'trial'].includes(p.set))
    assert.ok(FIRES.has(p.base) || ['flame', 'pulse'].includes(p.flicker), p.name);
});

test('the lamps by the way stand beside it, and the floor they stand on stays walkable', () => {
  for (const t of THEMES.filter(t => t.waylights)) {
    const d = Math.max(1, t.depths[0]), names = new Set(t.waylights.props);
    let placed = 0;
    for (const m of rooms(2, t.props, d)) {
      const { out, blockers } = placeProps(m, themeOf(m));
      const walk = new Set([...(m.moves || []).flatMap(mv => [mv.from.c, mv.to.c, ...mv.cells]), ...(m.runs || []).flatMap(r => [...r.cells, r.from.c, r.to.c])]);
      for (const q of out.filter(q => q.way)) {
        const x = Math.floor(q.x), z = Math.floor(q.z), c = z * N + x;
        assert.ok(names.has(q.name.replace(/_[ab]$/, '')) && !walk.has(c), q.name);
        placed++;
        assert.ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => walk.has((z + dz) * N + x + dx)), `${q.name} beside the way`);
        assert.ok(!blockers[c].some(b => containsXZ(b, x + 0.5, z + 0.5, CHAR_R + 0.03)), `${q.name}: its floor stays walkable`);
      }
    }
    assert.ok(placed > 0, `${t.props}: no lamps by the way`);
  }
});

test('what drifts in the caves: every cave has its motes, the dark ones a few wisps', () => {
  for (const t of THEMES.filter(t => t.cave || t.night)) {
    const M = t.motes;
    assert.ok(M && M.colors.length && M.rate > 0 && M.life[0] <= M.life[1] && M.size[0] <= M.size[1], t.props);
    assert.ok(!M.wisps || (M.wisps <= 2 && /^#[0-9a-f]{6}$/.test(M.wisp)), t.props);
  }
  assert.ok(THEMES.filter(t => t.motes?.wisps).length >= 5);
});
