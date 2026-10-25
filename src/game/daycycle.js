// The day and the night of the cube being played (core/daycycle.js): how dark its theme's own
// night has made it (state.night, 0..1, from the world's play time), what the light shows of it
// (state.lookNight follows it, so coming into or leaving a theme with nights fades it in and
// out), and a word when it turns.
import { state, setStatus } from './state.js';
import { themeOf } from '../themes/depth.js';
import { nightAt } from '../core/daycycle.js';
import { tr } from '../i18n/i18n.js';

let theme = null, wasNight = null;

// the current cube's theme if it has days and nights
export const cycleTheme = () => state.map && !state.map.interior && !state.map.testRoom && themeOf(state.map).cycle ? themeOf(state.map) : null;
// how far into the night the current cube is (0: day, or no nights here)
export const nightNow = () => { const t = cycleTheme(); return t ? nightAt(t.cycle, state.run.clock) : 0; };

// every frame (main.js), before the look
export function updateDayCycle(dt) {
  const t = cycleTheme();
  if (t) theme = t;
  state.night = t ? nightAt(t.cycle, state.run.clock) : 0;
  state.lookNight += (state.night - state.lookNight) * Math.min(1, dt * 2);
  if (state.lookNight < 0.002 && !state.night) state.lookNight = 0;
  // a word when it turns (not on coming in)
  const night = t ? state.night >= 0.5 : null;
  if (night !== null && wasNight !== null && night !== wasNight && !state.transitioning)
    setStatus(night ? tr('Night falls') : tr('The sun comes up'));
  wasNight = night;
}
// for render/look.js: { w, light } (null: no night of a theme's own)
export const lookCycle = () => state.lookNight > 0 && theme?.cycle ? { w: state.lookNight, light: theme.cycle.dark } : null;
