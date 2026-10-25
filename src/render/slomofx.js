// Slomo's flood rolling in (game/tide.js, core/slomo.js): while its front comes across his bowl, a
// wall of slime rolls on along it, taller than the slime behind it, goo flying off its crest and
// splashing ahead; once it is across, the wall sinks into the slime and is gone. In the active
// cube's coordinates (the flood is only ever in the cube being played).
import * as THREE from 'three';
import { scene } from './scene.js';
import { glow, soft, emit, rand } from './particles.js';
import { sfx } from '../audio/sfx.js';

const GOO = ['#d8ff9a', '#b8ff5a', '#8ae048'], CREST = 0.35;
let wall = null, rolling = false, shown = 0;

function makeWall() {
  // a half-round roll, its flat side down, along x (turned to lie along the front)
  const shape = new THREE.CylinderGeometry(1, 1, 1, 18, 1, false, 0, Math.PI).rotateZ(Math.PI / 2);
  const material = new THREE.MeshStandardMaterial({ color: '#7ad83a', emissive: '#3e8a1a', emissiveIntensity: 0.6, roughness: 0.15,
    transparent: true, opacity: 0.8, depthWrite: false });
  const mesh = new THREE.Mesh(shape, material);
  mesh.renderOrder = 6; mesh.visible = false; mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
}
// f: { box ([x0, z0, x1, z1]: the part it has reached), side (0 +x, 1 -x, 2 +z, 3 -z: where it comes
// in from), front (0..1), y (its surface), base (its bed) } or null (no flood)
export function drawFloodFront(f, dt = 0) {
  const on = !!f && f.front < 1;
  if (on && !rolling) sfx('tidecall', { volume: 0.8, pitch: 0.8 });
  rolling = on;
  shown += ((on ? 1 : 0) - shown) * Math.min(1, dt * (on ? 8 : 3));
  if (!f || shown < 0.01) { if (wall) wall.visible = false; return; }
  wall ??= makeWall();
  const [x0, z0, x1, z1] = f.box, alongX = f.side >= 2;
  // where the front stands, and which way it rolls
  const fx = f.side === 0 ? x0 : f.side === 1 ? x1 : (x0 + x1) / 2, fz = f.side === 2 ? z0 : f.side === 3 ? z1 : (z0 + z1) / 2;
  const dx = f.side === 0 ? -1 : f.side === 1 ? 1 : 0, dz = f.side === 2 ? -1 : f.side === 3 ? 1 : 0;
  const len = alongX ? x1 - x0 : z1 - z0, h = Math.max(0.1, f.y - f.base) + CREST * shown;
  wall.visible = true;
  wall.position.set(fx, f.base, fz);
  wall.rotation.y = alongX ? 0 : Math.PI / 2;
  wall.scale.set(len, h, 0.45 + 0.2 * shown);
  wall.material.opacity = 0.8 * shown;
  if (!on) return;
  // goo flying off its crest, splashing on ahead
  for (let n = Math.floor(len * 14 * dt + Math.random()); n > 0; n--) {
    const u = Math.random(), x = alongX ? x0 + u * len : fx, z = alongX ? fz : z0 + u * len;
    emit(soft, x + dx * 0.2, f.base + h * 0.9, z + dz * 0.2, { v: [dx * rand(1, 2.5) + rand(-0.3, 0.3), rand(1, 2.5), dz * rand(1, 2.5) + rand(-0.3, 0.3)],
      life: rand(0.4, 0.7), size: rand(0.08, 0.16), color: GOO[n % 3], alpha: 0.95, gravity: 9, drag: 0.6 });
    if (n % 4 === 0) emit(glow, x, f.base + h, z, { life: 0.25, size: rand(0.2, 0.35), color: '#b8ff5a', alpha: 0.4 });
  }
}
