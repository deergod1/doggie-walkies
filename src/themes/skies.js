// The light of a theme through the world's day (core/daycycle.js; game/daycycle.js blends it in,
// render/look.js shows it): its own `light` by day; at night its `light.night`, else one made from
// its sky (nightLight: its colours sunk into a blue moonlight, lit like the deep: the stars out,
// the character's own light at full); a night theme (the dark forest) by day its `light.day`,
// else a little lighter than its night (dayLight). Mornings and evenings under an open sky take on
// the warm light of a low sun (SUNSET). Pure data: lights like the themes' (themes/index.js).

// the moonlight every night is made from
const NIGHT = { sky: ['#050a16', '#010307', '#0e182c', '#120e26'], stars: 1, hemi: ['#6a7ca8', '#08090c', 0.5], sun: ['#a8b8e8', 0.55], fog: 0.4, lamp: 1 };
// the warm light of a low sun: an orange band low in the sky under violet, warm light
export const SUNSET = { sky: ['#3a2e5c', '#ff9a62', '#d8785c', '#ffb87a'], stars: 0.1, hemi: ['#ffc8a0', '#3a2a30', 0.75], sun: ['#ff9a5a', 1.5], fog: 0.2, lamp: 0 };

const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = c => '#' + c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
export const mixHex = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
// a sky's stop i (haze and tint default to the top and the bottom)
const stop = (s, i) => s[i] ?? s[i - 2];

const nights = new Map(), days = new Map();
// a theme's light at night
export function nightLight(theme) {
  const L = theme.light;
  if (L.night) return L.night;
  if (!nights.has(theme)) nights.set(theme, {
    sky: NIGHT.sky.map((c, i) => mixHex(stop(L.sky, i), c, 0.85)),
    stars: theme.sky === 'hazy' ? 0.5 : NIGHT.stars,
    hemi: [mixHex(L.hemi[0], NIGHT.hemi[0], 0.8), NIGHT.hemi[1], NIGHT.hemi[2]],
    sun: NIGHT.sun.slice(), fog: Math.max(L.fog, NIGHT.fog), lamp: NIGHT.lamp,
  });
  return nights.get(theme);
}
// a night theme's light by day: its `light.day`, else its night a little lighter
export function dayLight(theme) {
  const L = theme.light;
  if (L.day) return L.day;
  if (!days.has(theme)) days.set(theme, {
    sky: [0, 1, 2, 3].map(i => mixHex(stop(L.sky, i), '#8090b0', 0.08)), stars: (L.stars ?? 0) * 0.5,
    hemi: [L.hemi[0], L.hemi[1], L.hemi[2] * 1.3], sun: [L.sun[0], L.sun[1] * 1.3], fog: L.fog * 0.85, lamp: (L.lamp ?? 0) * 0.9,
  });
  return days.get(theme);
}
