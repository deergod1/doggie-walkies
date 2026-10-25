// Depth (0 at the surface, MAX_DEPTH at the bottom) and its theme. Plain data, so the world
// worker can use it too. depthOf(cube key) = -Y.
// Every theme belongs to one of the three acts (themes/index.js `act`, ACTS: the depths of each)
// and may appear at any depth of it. Every world draws half of each act's themes from its seed and
// lays them out down the act in their story order: worldThemes(seed) -> [{ at, theme }], the
// stretches of depths that share a theme (each starts at `at` and lasts until the next). The
// town (0) and the core (MAX_DEPTH) have a theme of their own. The world carries its picks
// (world.layout.themes, each depth's layout.theme) and stamps each spec and map with its theme's
// id (`biome`, the theme's prop set; read back with themeOf).
import { THEMES, TOWN, CORE, ACTS } from './index.js';
import { parse } from '../world/coords.js';
import { hash32, mulberry32 } from '../core/util.js';

export const MAX_DEPTH = 20;
// house interiors (keys off the grid, world/town.js interiorKey) are at the surface
export const depthOf = k => k.includes(',') ? -parse(k)[1] : 0;

const BY_ID = new Map(THEMES.map(t => [t.props, t]));
export const themeById = id => BY_ID.get(id) ?? null;

// the act of depth d (1, 2, 3; 0 for the town and the core)
export const actAt = d => Math.max(0, ACTS.findIndex(a => a && d >= a[0] && d <= a[1]));
// the themes that may appear at depth d, in their story order (the town's depth: the town's
// theme only, the core's: the core's)
export const themesAt = d => d === 0 ? [TOWN] : d === MAX_DEPTH ? [CORE] : THEMES.filter(t => t.act === actAt(d));

// the share of an act's themes a world shows: every theme is as likely to be in a world as any
// other, whichever act it belongs to and however many themes its act has
export const SHARE = 0.5;
// the most depths one theme lasts
export const LONGEST = 3;

// the world's theme for every depth, from its seed alone, as stretches. Each act on its own
// random stream: how many themes it shows (SHARE of them, rounded up or down at random so the
// share comes out right, at least enough for no stretch to last more than LONGEST depths), which
// ones (each equally likely), in story order, the act's depths dealt out among them. force: theme
// ids that win every depth they may appear at: an act with any of them shows them alone, its
// depths shared out evenly (dev, tests: ?theme=clouds,forge)
const picked = new Map();
export function worldThemes(seed, force = []) {
  const k = seed + '|' + force.join(',');
  if (picked.has(k)) return picked.get(k);
  const out = [{ at: 0, theme: TOWN }];
  const add = (at, theme) => { if (out.at(-1).theme !== theme) out.push({ at, theme }); };
  ACTS.forEach((act, a) => {
    if (!act) return;
    const R = mulberry32(hash32(seed ^ Math.imul(a + 1, 0x7e3a5b1d) ^ 0x7e3e5));
    const [from, to] = act, depths = to - from + 1, pool = themesAt(from);
    const forced = pool.filter(t => force.includes(t.props)).slice(0, depths);
    let shown, len;
    if (forced.length) {
      shown = forced;
      len = shown.map((_, i) => Math.floor(depths / shown.length) + (i < depths % shown.length ? 1 : 0));
    } else {
      const share = SHARE * pool.length;
      const n = Math.min(depths, Math.max(Math.ceil(depths / LONGEST), Math.floor(share) + (R() < share % 1 ? 1 : 0)));
      // which: a shuffle of the act's themes, the first n of it, back in story order
      const order = [...pool];
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const chosen = new Set(order.slice(0, n));
      shown = pool.filter(t => chosen.has(t));
      // how long: a depth each, the rest one by one to stretches not yet LONGEST
      len = shown.map(() => 1);
      for (let left = depths - n; left > 0; left--) {
        const open = len.map((l, i) => l < LONGEST ? i : -1).filter(i => i >= 0);
        len[open[Math.floor(R() * open.length)]]++;
      }
    }
    let d = from;
    shown.forEach((t, i) => { add(d, t); d += len[i]; });
  });
  add(MAX_DEPTH, CORE);
  picked.set(k, out);
  return out;
}

const stretchOf = (depth, themes) => {
  let i = 0;
  while (i + 1 < themes.length && depth >= themes[i + 1].at) i++;
  return i;
};

// the theme of a depth in a world's picks (worldThemes)
export const themeAt = (depth, themes) => themes[stretchOf(depth, themes)].theme;
// the theme of a spec or generated map (its stamp)
export function themeOf(map) {
  const theme = BY_ID.get(map.biome);
  if (!theme) throw new Error(`no theme for map ${map.key} (biome ${map.biome})`);
  return theme;
}

// the themes around a (fractional) depth in a world's picks and how far we are between their
// starts: light is blended between them so every step down gets a little darker (a theme that
// lasts several depths is one stretch)
export function lightAt(depth, themes) {
  const i = stretchOf(depth, themes), a = themes[i], b = themes[i + 1] || a;
  const t = b === a ? 0 : Math.min(1, Math.max(0, (depth - a.at) / (b.at - a.at)));
  return { a: a.theme.light, b: b.theme.light, t };
}

// how bright the character's own light is at a (fractional) depth: 0 under the sky, about a half
// in the sunlit hollows, 1 in the dark deep (the themes' `lamp`, blended like the rest of the light)
export function lampAt(depth, themes) {
  const { a, b, t } = lightAt(depth, themes);
  return (a.lamp ?? 0) + ((b.lamp ?? 0) - (a.lamp ?? 0)) * t;
}
