// The world's days and nights in the cube being played (core/daycycle.js): what its sky shows of
// them (skyOf: its theme's `sky`, themes/index.js; none indoors, in trial and test rooms, and in a
// boss's arena, where it is always noon, but in one with days and nights like any cube, `days`:
// Gusto's, core/bosses.js BOSS_ARENAS), how far into the night it is (state.night), the light
// the look blends in (lookCycle: render/look.js eases it, so coming into a cube or out of one
// fades it), where the sun stands for the bakes (render/bake.js setSunPlan: under an open sky it
// goes round, its shadows baked again as it goes; elsewhere, and on the lowest lighting level,
// it stays at noon), and a word when it turns.
// dayClock: the world's play time with the dev's shift (/dayspeed, game/devcommands.js).
import { state, setStatus } from './state.js';
import { themeOf } from '../themes/depth.js';
import { nightLight, dayLight, SUNSET } from '../themes/skies.js';
import { nightAt, glowAt, sunAt } from '../core/daycycle.js';
import { setSunPlan } from '../render/bake.js';
import { movingSun } from './quality.js';
import { BOSS_ARENAS } from '../core/bosses.js';
import { tr } from '../i18n/i18n.js';

// how much of the warm light of a low sun mornings and evenings take on, by sky
const GLOW = { open: 0.5, hazy: 0.25 };

// what the days and nights do in map: 'open', 'hazy', 'night' or 'none' (themes/index.js `sky`)
export function skyOf(map) {
  if (!map || map.interior || map.testRoom || map.trialRoom || !map.biome) return 'none';
  if (map.guardian?.boss && !BOSS_ARENAS[map.guardian.boss]?.days) return 'none';
  return themeOf(map).sky ?? 'none';
}
// the time of day's clock: the world's play time (and the dev's shift)
export const dayClock = () => (state.run?.clock ?? 0) + (state.dayShift ?? 0);
// the sky over the cube being played
export const skyNow = () => skyOf(state.map);
// do the days and nights go round in full there (the light turns, the meteorites fall at night)?
export const fullCycle = sky => sky === 'open' || sky === 'hazy';
// how far into the night the cube being played is (0: day, or no nights here)
export const nightNow = () => skyNow() === 'none' ? 0 : nightAt(dayClock());

let wasNight = null;
// every frame (main.js), before the look
export function updateDayCycle(dt) {
  // (the dev's /dayspeed: the time of day runs faster or slower than the world's clock)
  if (dt > 0 && state.daySpeed !== 1) state.dayShift += (state.daySpeed - 1) * dt;
  const sky = skyNow();
  state.night = sky === 'none' ? 0 : nightAt(dayClock());
  // a word when it turns (not on coming in)
  const night = fullCycle(sky) ? state.night >= 0.5 : null;
  if (night !== null && wasNight !== null && night !== wasNight && !state.transitioning)
    setStatus(night ? tr('Night falls') : tr('The sun comes up'));
  wasNight = night;
}

// For render/look.js: the lights the time of day blends into the cube's ([light, weight]: the
// warm light of a low sun, the night's; a night theme's day), how strongly the sun shines (sunK:
// gone where it changes places with the moon), and how fast the look follows (ease).
export function lookCycle(dt) {
  const sky = skyNow(), ease = Math.min(1, dt * 2);
  if (sky === 'none') return { ease, parts: [], sunK: 1 };
  const theme = themeOf(state.map), clock = dayClock(), n = nightAt(clock);
  if (sky === 'night') return { ease, parts: [[dayLight(theme), 1 - n]], sunK: 1 };
  const glow = glowAt(clock) * GLOW[sky] * (1 - n);
  return { ease, parts: [[SUNSET, glow], [nightLight(theme), n]], sunK: sky === 'open' && movingSun() ? sunAt(clock, theme.sunLow).light : 1 };
}

// where the sun stands for a cube's bake (render/bake.js): under an open sky, while playing,
// where the time of day has it; else at noon (null)
setSunPlan(bake => {
  if (state.mode !== 'play' || !movingSun() || skyOf(bake.map) !== 'open') return null;
  return sunAt(dayClock(), themeOf(bake.map).sunLow);
});
