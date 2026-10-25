// The cast in progress (reading a portal scroll, game/townportal.js, roomportal.js): a violet
// bar over the player's own bars (those and it as big as the UI scale says, game/uiscale.js). Lives in the scene, not a cube, like the portal charge bar.
// Inside a Bolime (game/engulf.js) a green bar there shows how far the struggle out of it has got.
import { scene, camera } from './scene.js';
import { makeBar } from './bars.js';
import { player, state } from '../game/state.js';
import { CHAR_H } from '../core/constants.js';
import { uiScale } from '../game/uiscale.js';

const bar = makeBar({ w: 0.8, h: 0.08, color: 0xb98cff, onTop: true });
bar.group.visible = false;
scene.add(bar.group);
const struggle = makeBar({ w: 0.8, h: 0.08, color: 0x9aff5a, onTop: true });
struggle.group.visible = false;
scene.add(struggle.group);

// after the camera moved, so the bar faces it this frame
export function updateCastBar() {
  const h = player.engulfed;
  struggle.group.visible = !!h && !state.transitioning;
  if (struggle.group.visible) {
    const s = uiScale();
    struggle.group.position.set(player.x, player.visY + CHAR_H + 0.4 + 0.45 * s, player.z);
    struggle.resize(s);
    struggle.group.quaternion.copy(camera.quaternion);
    struggle.set(Math.min(1, h.struggle));
  }
  const c = state.cast;
  bar.group.visible = !!c && !state.transitioning;
  if (!bar.group.visible) return;
  const s = uiScale();
  bar.group.position.set(player.x, player.visY + CHAR_H + 0.4 + 0.45 * s, player.z);
  bar.resize(s);
  bar.group.quaternion.copy(camera.quaternion);
  bar.set(c.t / c.duration);
}
