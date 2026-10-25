// What built and paved ground looks like at each theme, by role (docs/bosses.md "An arena of its
// own"). The terrain's own colours go by height (a theme's `top` and `side` stops: grass tops,
// cliff strata, snow up high); what a generator builds rather than grows has no height to go by
// (a tower running from the floor to the top of the cube, a box that turns any side up), so it
// names a role instead (a floor's `surface`, cubegen/towerarena.js; the faces of Flip's box,
// render/flipgeo.js) and the theme says the colour:
//   masonry  built stone: a tower, its ramp and bridge, stone platforms, parapets
//   paving   tiles laid in a checker (`top` and `alt`): the insides of Flip's box
//   trim     caps and edges on masonry
//   crust    dark, scorched ground: a caldera's floor round lava
// Each role is { top, alt, side: [course, other course], under }: the top (`alt`: a checker's
// other tile), the side in courses of blocks half a cell high, every other one the second
// colour, and the underside. All of them follow from what every theme has already (its
// structures' stone, themes/builds.js, its cliff rock, its underside), so a new theme needs
// nothing; a theme may set its own (`surfaces: { masonry: { top: '#...' } }`, any part of any
// role). Plain hex colours, so the world worker can use it too (render/palette.js makes colours
// of them).
import { buildOf } from './builds.js';

export const SURFACE_ROLES = ['masonry', 'paving', 'trim', 'crust'];

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const p = rgb(a), q = rgb(b); return hex(p.map((v, i) => v + (q[i] - v) * t)); };
const shade = (a, k) => hex(rgb(a).map(v => v * k));

// the colour the neutral props (`any_` rocks and pebbles) are tinted at a theme: its cliff rock
export const rockTint = theme => theme.side[1][1];

const made = new WeakMap();
// theme -> { masonry, paving, trim, crust }
export function surfacesOf(theme) {
  if (made.has(theme)) return made.get(theme);
  const stone = buildOf(theme).stone, rock = rockTint(theme), under = theme.under;
  const role = (base, top, alt, side, low) => ({ top: shade(base, top), alt: shade(base, alt), side: side.map(k => shade(base, k)), under: shade(base, low) });
  const masonry = role(mix(stone, rock, 0.35), 0.9, 0.82, [0.8, 0.68], 0.55);
  const paving = { ...masonry, top: stone, alt: shade(mix(stone, rock, 0.45), 0.8) };
  const trim = role(stone, 0.8, 0.7, [0.72, 0.62], 0.55);
  const crust = role(mix(under, rock, 0.35), 0.8, 0.72, [0.75, 0.62], 0.5);
  const own = theme.surfaces ?? {}, out = {};
  for (const [name, r] of Object.entries({ masonry, paving, trim, crust })) out[name] = { ...r, ...own[name] };
  made.set(theme, out);
  return out;
}
