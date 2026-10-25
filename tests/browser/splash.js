// Run in the game console: (await import('/tests/browser/splash.js')).runSplashChecks()
// The splash screen's sounds (src/audio/splash.js), rendered offline: each is heard, none clips,
// and each lasts about as long as the splash wants it to (src/game/splash.js).
import { renderSplashSound } from '../../src/audio/splash.js';

const check = (condition, message) => { if (!condition) throw Error(message); };

export async function runSplashChecks() {
  const out = {};
  for (const [name, min, max] of [['hit', 0.6, 2], ['shatter', 0.8, 3], ['swell', 2.5, 4.9]]) {
    const { peak, seconds } = await renderSplashSound(name);
    check(peak > 0.05, `${name}: silent (${peak})`);
    check(peak <= 1, `${name}: clips (${peak.toFixed(2)})`);
    check(seconds >= min && seconds <= max, `${name}: heard for ${seconds.toFixed(2)} s`);
    out[name] = { peak: +peak.toFixed(3), seconds: +seconds.toFixed(2) };
  }
  return out;
}
