// The render resolution follows the frame rate (core/resolution.js): main.js hands over when each
// frame began, after it rendered. With the lighting on Auto the quality level (game/quality.js)
// goes down before the resolution; the anti-aliasing stays as set (render/msaa.js).
// ?res=<pixel ratio> pins the resolution (1: CSS pixels), e.g. to compare.
import { requestFit } from './scene.js';
import { resolutionController } from '../core/resolution.js';

const pinned = Number(new URLSearchParams(location.search).get('res'));
const control = pinned > 0 ? null : resolutionController(Math.min(devicePixelRatio, 2));
let last = 0;

// the canvas takes the new ratio right before the next frame is drawn (scene.js fitView): resized
// now, after this frame was drawn, it would show empty for a frame
const apply = ratio => requestFit(ratio);
if (pinned > 0) apply(pinned);

// start: performance.now() when the frame began (it has rendered by now); fps: the frame rate
// cap (0: none), frames are not too slow for coming at the rate asked for; drawn: whether it drew
// the world (behind the curtain a frame may not: not counted)
export function tickResolution(start, fps = 0, drawn = true) {
  const interval = last ? start - last : 0;
  last = start;
  if (!control || !drawn) return;
  const ratio = control.tick(interval, performance.now() - start, fps ? 1000 / fps : 0);
  if (ratio) apply(ratio);
}

// the quality levels Auto steps through (levels above the lowest; 0: not on Auto) and the one
// to start from; the level it chose (game/quality.js follows it)
let fixed = 0;
export function setAutoQuality(levels, level) { fixed = level; control?.setQuality(levels, level); }
export const autoQuality = () => control ? control.level : fixed;
// the pixel ratio now (the perf overlay, game/perf.js)
export const resolutionState = () => ({ ratio: control?.ratio ?? pinned });
