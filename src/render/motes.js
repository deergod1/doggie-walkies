// What drifts in the air round the character where its theme has it (themes/index.js and
// themes/caves.js `motes`): the dark forest's fireflies, the nests' spores, the ruins' embers,
// the abyss's sparks. Two kinds:
//   motes   glowing particles (render/particles.js glow layer), a few a second: they come up out
//           of the dark round the character, drift (and rise or sink) and fade. No light.
//   wisps   a few slow glowing orbs that wander round the character for a while, each with a
//           light of its own (a moving one: render/lightpool.js trackLight), the only lights in the
//           deep that move but the shots and the glowing enemies.
// motes: { colors, rate (a second), drift (sideways speed), rise: [min, max] (up), life: [min, max],
//   size: [min, max], wisps (how many at once), wisp (their colour) }
import * as THREE from 'three';
import { glow, emit, rand } from './particles.js';
import { trackLight, untrackLight } from './lightpool.js';

const WISP = { light: 1.8, reach: 3.5, life: [9, 15], fade: 1.5, speed: 0.45, near: [2, 6.5], high: [0.9, 2.3] };
let due = 0, rate = 1;
// a factor on how many motes come (game/quality.js: half on the lower quality levels)
export function setMoteRate(k) { rate = k; }
const wisps = [];
const holder = new THREE.Object3D();   // (what the wisps' lights hang on: the world itself)

// theme: the current cube's (or none); (x, y, z): the character
export function tickMotes(dt, theme, x, y, z) {
  const M = theme?.motes;
  if (M) for (due += dt * M.rate * rate; due >= 1; due--) {
    const a = Math.random() * Math.PI * 2, d = rand(1.2, 7.5);
    emit(glow, x + Math.cos(a) * d, y + rand(0.3, 2.4), z + Math.sin(a) * d, {
      v: [rand(-M.drift, M.drift), rand(...M.rise), rand(-M.drift, M.drift)], life: rand(...M.life), size: rand(...M.size),
      color: M.colors[Math.floor(Math.random() * M.colors.length)], alpha: 0.95, drag: 0.15 });
  } else due = 0;
  tickWisps(dt, M?.wisps ?? 0, M?.wisp, x, y, z);
}

// a spot near the character for a wisp to make for
const aim = (w, x, y, z) => {
  const a = Math.random() * Math.PI * 2, d = rand(...WISP.near);
  w.to.set(x + Math.cos(a) * d, y + rand(...WISP.high), z + Math.sin(a) * d);
};

function tickWisps(dt, want, color, x, y, z) {
  // a new one where one is missing, out in the dark round the character
  if (wisps.length < want && dt > 0 && Math.random() < dt * 0.8) {
    const light = new THREE.PointLight(color, 0, WISP.reach, 2), w = { light, at: new THREE.Vector3(), to: new THREE.Vector3(),
      v: new THREE.Vector3(), age: 0, life: rand(...WISP.life) };
    aim(w, x, y, z); w.at.copy(w.to); aim(w, x, y, z);
    trackLight(light, holder, holder);
    wisps.push(w);
  }
  for (let i = wisps.length - 1; i >= 0; i--) {
    const w = wisps[i];
    // (too many for the theme now, or the character left it: it fades out early)
    if (wisps.length > want && w.life - w.age > WISP.fade) w.life = w.age + WISP.fade;
    w.age += dt;
    if (w.age >= w.life) { untrackLight(w.light); wisps.splice(i, 1); continue; }
    // drift towards where it makes for, turning slowly; a new spot once there (or far behind)
    const to = w.to.clone().sub(w.at);
    if (to.length() < 0.4 || w.at.distanceTo(tmp.set(x, y, z)) > 9) aim(w, x, y, z);
    w.v.lerp(to.normalize().multiplyScalar(WISP.speed), Math.min(1, dt * 0.8));
    w.at.addScaledVector(w.v, dt);
    w.at.y += Math.sin((w.age + i) * 2.1) * dt * 0.08;
    const k = Math.min(1, w.age / WISP.fade, (w.life - w.age) / WISP.fade);
    w.light.position.copy(w.at);
    w.light.intensity = WISP.light * k * (0.85 + 0.15 * Math.sin(w.age * 5 + i));
    // the orb itself, and a faint trail
    if (dt > 0) {
      emit(glow, w.at.x, w.at.y, w.at.z, { life: 0.12, size: 0.16 * k + 0.02, color: w.light.color.getStyle(), alpha: 0.9 * k });
      if (Math.random() < dt * 8) emit(glow, w.at.x, w.at.y, w.at.z, { v: [rand(-0.1, 0.1), rand(-0.05, 0.05), rand(-0.1, 0.1)],
        life: rand(0.6, 1.2), size: 0.05, color: w.light.color.getStyle(), alpha: 0.7 * k, drag: 0.5 });
    }
  }
}
const tmp = new THREE.Vector3();

// how many wisps there are now (checks, the dev tools)
export const wispCount = () => wisps.length;
