// A fixed set of point lights shared by all cubes. three.js recompiles every lit shader when
// the number of lights changes, which made entering a cube stutter. Cubes still create their
// point lights (portals, lava), but those are only light sources: every frame the pool lights
// copy the ones nearest to the focus point. Unused pool lights are switched off. Where there are
// more sources than pool lights (the dark forest's lanterns), the farthest ones taken fade out as
// they come near the first one left out, so walking about never makes a light pop on or off.
import * as THREE from 'three';
import { scene } from './scene.js';

const POOL = 8;
const FADE = 1.5;   // how far before the first source left out a taken one has faded out
const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffffff, 0, 1, 2); scene.add(l); return l; });
let sources = [];
const tmp = new THREE.Vector3();

// take the point lights out of a freshly built cube (group) and use them as sources
export function adoptLights(group) {
  const found = [];
  group.traverse(o => { if (o.isPointLight) found.push(o); });
  for (const l of found) { const parent = l.parent; parent.remove(l); sources.push({ l, parent, group, gain: 1, pos: new THREE.Vector3() }); }
}

export function releaseLights(group) { sources = sources.filter(s => s.group !== group); }

// a light that moves with `object` (an enemy, a projectile): light.position is local to it;
// it shines while the object is visible, at whatever intensity the owner sets; group: the cube
// it belongs to (fades and is released with it). It must not be in the scene itself: every
// light that comes or goes there recompiles all lit shaders (seconds, with a few of them), so
// one added to its object is taken out again. gain: how much brighter the pool light shines
// than the source says (the lights of shots, projectiles, flask areas, loot and partners were
// tuned while they shone twice, in the scene and from the pool: 2 keeps their look).
export function trackLight(light, object, group = object, gain = 1) {
  if (light.parent) light.parent.remove(light);
  sources.push({ l: light, parent: object, group, gain, pos: new THREE.Vector3() });
}
export function untrackLight(light) { sources = sources.filter(s => s.l !== light); }

export function updateLightPool(focus) {
  for (const s of sources) {
    s.parent.updateWorldMatrix(true, false);
    s.pos.copy(s.l.position).applyMatrix4(s.parent.matrixWorld);
    s.d = s.pos.distanceToSquared(focus);
  }
  const shown = sources.filter(s => s.group.visible && s.parent.visible && s.l.visible).sort((a, b) => a.d - b.d);
  const best = shown.slice(0, POOL), cut = shown.length > POOL ? Math.sqrt(shown[POOL].d) : Infinity;
  pool.forEach((l, i) => {
    const s = best[i];
    if (!s) { l.intensity = 0; return; }
    l.position.copy(s.pos);
    l.color.copy(s.l.color);
    const edge = Math.min(1, Math.max(0, (cut - Math.sqrt(s.d)) / FADE));
    l.intensity = s.l.intensity * s.gain * (s.group.userData.fade ?? 1) * edge;
    l.distance = s.l.distance; l.decay = s.l.decay;
  });
}

export const focusPoint = (x, y, z) => tmp.set(x, y, z);
