// Render resolution that follows the frame rate (render/resolution.js applies it). On a high-DPI
// screen the GPU shades up to four pixels per CSS pixel; when frames come too slowly because of
// that, the resolution steps down, and creeps back up after a while of smooth frames.
//   - Before the resolution, the anti-aliasing goes: each step down first takes the MSAA
//     samples a level down (8, 4, 2, off: every sample is shaded and stored for every pixel), as many steps as the setting allows
//     (`steps`, from render/msaa.js); `drop` says how many are dropped. Stepping up takes the
//     resolution back to the full ratio first, then the samples.
//   - Frames are judged a second at a time, by the time between frames and by how much of it the
//     frame's own work (JavaScript, handing the draws to the GPU) took: slow frames that are
//     mostly that work are CPU-bound, and fewer pixels would not help.
//   - Every step down has to prove itself: if the next second is not clearly faster (a CPU-bound
//     frame after all, or a browser that caps the frame rate, like Safari in low power mode), it
//     is taken back and stepping down rests for a while.
//   - Stepping up again waits for a calm spell, twice as long each time a step up had to be taken
//     back right away, so the resolution does not see-saw.
//   - Under a frame rate cap (the settings, game/settings.js) frames are judged against the cap:
//     30 frames a second that were asked for are not slow.
//   - With the lighting on Auto (game/quality.js) the quality level is a step too (`levels` above
//     the lowest, `level` the one now). Down: the samples first, then the level, then the
//     resolution; slow frames that are CPU-bound take only the level down (fewer shadow maps
//     drawn is less work for the CPU too). Up: the resolution first, then the level, then the
//     samples. A level's step is judged a second later than the others (QUALITY_SETTLE): what
//     it changes fades in over half a second.

export const SLOW = 1000 / 50;       // ms between frames: slower than 50 fps is too slow
const SMOOTH = 1000 / 57;            // ms between frames: faster than ~57 fps (vsync at 60 or more)
const CAP_SLOW = 1.2, CAP_SMOOTH = 1.05;   // under a cap: too slow / smooth, times the capped interval
const CPU_BOUND = 0.6;               // the frame's work takes this much of the time between frames
const STALL = 250;                   // ms: a hitch, a background tab; not counted
const WINDOW = 1000;                 // ms of frames judged at a time
const DOWN = 0.85, UP = 1.1;         // a step's factor
const PROOF = 0.9;                   // a step down must make frames at least this much shorter
const CALM = 4000, CALM_MAX = 64000; // ms of smooth frames before a step up
const REST = 30000;                  // ms without stepping down after a step down that did not help
const QUALITY_SETTLE = 1;           // windows a quality step waits before it is judged

export function resolutionController(max, min = Math.min(max, Math.max(0.6, max / 2)), quality = {}) {
  let levels = quality.levels ?? 0, level = quality.level ?? levels;
  let ratio = max, drop = 0, sum = 0, work = 0, n = 0, span = 0;
  let smooth = 0, calm = CALM, rest = 0, trial = null, raised = -Infinity, clock = 0;
  const clamp = r => Math.min(max, Math.max(min, r));
  // interval: ms since the last frame; spent: ms the frame's own work took; target: ms between
  // frames the frame rate cap asks for (0: no cap); steps: the MSAA steps that may be dropped.
  // Returns the new ratio when it changes, else null (`drop` may have changed all the same).
  function tick(interval, spent, target = 0, steps = 0) {
    drop = Math.min(drop, steps);
    if (!(interval > 0) || interval > STALL) return null;
    clock += interval; rest = Math.max(0, rest - interval);
    sum += interval; work += spent; n++; span += interval;
    if (span < WINDOW) return null;
    const avg = sum / n, busy = work / sum;
    const slow = Math.max(SLOW, target * CAP_SLOW), fast = Math.max(SMOOTH, target * CAP_SMOOTH);
    sum = work = n = span = 0;
    if (trial) {   // the second after a step down: did it help?
      if (trial.wait > 0) { trial.wait--; return null; }
      const t = trial; trial = null;
      if (avg > t.before * PROOF) { rest = REST; drop = t.drop; level = t.level; return set(t.from); }
    }
    if (avg > slow) {
      smooth = 0;
      if (clock - raised < 3000) calm = Math.min(CALM_MAX, calm * 2);   // the step up was too much
      if (rest > 0) return null;
      const gpu = busy < CPU_BOUND;
      if (gpu && drop < steps) { trial = { from: ratio, drop, level, before: avg }; drop++; return null; }
      if (level > 0) { trial = { from: ratio, drop, level, before: avg, wait: QUALITY_SETTLE }; level--; return null; }
      if (gpu && ratio > min) { trial = { from: ratio, drop, level, before: avg }; return set(clamp(ratio * DOWN)); }
      return null;
    }
    smooth = avg < fast ? smooth + WINDOW : 0;
    if (smooth >= calm && (ratio < max || level < levels || drop > 0)) {
      smooth = 0; raised = clock;
      if (ratio < max) return set(clamp(ratio * UP));
      if (level < levels) level++;
      else drop--;
    }
    return null;
  }
  function set(r) { if (r === ratio) return null; ratio = r; return r; }
  // the quality levels to step through (0: none, the lighting is not on Auto), the level now
  function setQuality(n, now = n) { levels = n; level = Math.max(0, Math.min(n, now)); if (trial) trial.level = level; }
  return { tick, setQuality, get ratio() { return ratio; }, get drop() { return drop; }, get level() { return level; }, get levels() { return levels; }, min, max };
}
