// What the settings (game/settings.js) change on the page itself:
//   - the brightness of the world: a CSS filter on the game's canvas (the HUD and the menus stay
//     as they are); none at 100%, so it costs nothing then
//   - the minimap's size: --map in style.css (0: hidden; the quest under it moves up with it)
//   - reducing motion: body.calm, which style.css takes for its blinking and popping; the camera's
//     kicks and the ground's shaking ask `reduceMotion` themselves (game/juice.js)
// and fullscreen, which is no setting (only a click may ask for it) but sits among them.
import { renderer } from '../render/scene.js';
import { brightness, minimapSize, reduceMotion, onSettingsChange } from './settings.js';

const root = document.documentElement, canvas = renderer.domElement;

function apply() {
  const b = brightness();
  canvas.style.filter = b === 1 ? '' : `brightness(${b})`;
  root.style.setProperty('--map', String(minimapSize()));
  document.body.classList.toggle('no-map', !minimapSize());
  document.body.classList.toggle('calm', reduceMotion());
}
apply();
onSettingsChange(apply);

// --- fullscreen ---------------------------------------------------------------------------------

// whether the browser can show the page fullscreen (not an iPhone's Safari)
export const canFullscreen = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
export function setFullscreen(on) {
  if (on === isFullscreen()) return;
  if (on) (root.requestFullscreen ?? root.webkitRequestFullscreen)?.call(root)?.catch?.(() => {});
  else (document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
}
// fn() when the page goes into fullscreen or out of it (Esc, F11, the browser's own controls)
export function onFullscreenChange(fn) {
  document.addEventListener('fullscreenchange', fn);
  document.addEventListener('webkitfullscreenchange', fn);
}
