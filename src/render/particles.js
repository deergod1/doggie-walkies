// A shared pool of camera-facing particles in two layers: additive glow (embers, sparks,
// fizz) and soft alpha (droplets, smoke, vapour). Used by fluid deaths and combat hits.
import * as THREE from 'three';
import { renderer, scene, camera } from './scene.js';

const MAX = 384, SIZE = 1.3;   // sizes below are world units, scaled for the far game camera
const vertexShader = `
attribute float size; attribute vec4 tint; varying vec4 vTint; uniform float scale;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * scale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const fragmentShader = `
varying vec4 vTint;
void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  gl_FragColor = vec4(vTint.rgb, vTint.a * smoothstep(0.5, 0.12, r));
  #include <colorspace_fragment>
}`;

// two layers: additive glow (embers, acid fizz) and soft alpha (droplets, smoke, vapour)
function layer(blending) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('size', new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { scale: { value: 1 } },
    transparent: true, depthWrite: false, blending });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; points.renderOrder = 1100; points.visible = false;
  scene.add(points);
  return { points, list: [] };
}
export const glow = layer(THREE.AdditiveBlending), soft = layer(THREE.NormalBlending);

// the share of the particles made (the settings, game/settings.js particles: main.js): fewer, at
// random, so a burst of twenty is still one of five
let share = 1;
export function setParticleShare(s) { share = s; }

const col = new THREE.Color();
export function emit(target, x, y, z, { v = [0, 0, 0], spread = 0, life = 1, size = .1, grow = 0, color, alpha = 1, gravity = 0, drag = 0 }) {
  if (target.list.length >= MAX || share < 1 && Math.random() >= share) return;
  col.set(color);
  target.list.push({ x, y, z, vx: v[0] + (Math.random() - .5) * spread, vy: v[1], vz: v[2] + (Math.random() - .5) * spread,
    age: 0, life, size: size * SIZE, grow, r: col.r, g: col.g, b: col.b, alpha, gravity, drag });
}

// What keeps a place of its own in the air and emits particles there every frame (the wisps,
// render/motes.js) has to slide and go with the particles, else it stays behind in scene space
// and streaks a cube's width across the screen on a portal's travel: it gives
// { shift(dx, dy, dz), clear() } here, and they are called with the particles'.
const riders = [];
export function rideAlong(hooks) { riders.push(hooks); }

// Portal travel slides the cubes past the camera (game/travel.js): what is in the air goes along
// with them (by how far they moved this frame), so it stays where it was in the world
export function shiftParticles(dx, dy, dz) {
  for (const L of [glow, soft]) for (const p of L.list) { p.x += dx; p.y += dy; p.z += dz; }
  for (const r of riders) r.shift(dx, dy, dz);
}
// a cut to another cube (game/flow.js enterCube): what was in the air belongs to the old one
export function clearParticles() {
  for (const L of [glow, soft]) { L.list.length = 0; L.points.geometry.setDrawRange(0, 0); L.points.visible = false; }
  for (const r of riders) r.clear();
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const ring = (r = .35) => { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r; return [Math.cos(a) * d, Math.sin(a) * d]; };

function stepLayer(L, dt) {
  const pos = L.points.geometry.attributes.position, tint = L.points.geometry.attributes.tint, size = L.points.geometry.attributes.size;
  let n = 0;
  for (const p of L.list) {
    p.age += dt;
    if (p.age >= p.life) continue;
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d; p.vz *= d; p.vy = p.vy * d - p.gravity * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = p.age / p.life;
    pos.setXYZ(n, p.x, p.y, p.z);
    tint.setXYZW(n, p.r, p.g, p.b, p.alpha * (1 - k) * Math.min(1, p.age * 20));
    size.setX(n, p.size * (1 + p.grow * k));
    L.list[n++] = p;
  }
  L.list.length = n;
  L.points.geometry.setDrawRange(0, n);
  L.points.visible = n > 0;
  pos.needsUpdate = tint.needsUpdate = size.needsUpdate = true;
}

const buffer = new THREE.Vector2();
export function tickParticles(dt) {
  if (!glow.list.length && !soft.list.length) { glow.points.visible = soft.points.visible = false; return; }
  renderer.getDrawingBufferSize(buffer);
  const scale = buffer.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  glow.points.material.uniforms.scale.value = soft.points.material.uniforms.scale.value = scale;
  stepLayer(glow, dt); stepLayer(soft, dt);
}
export const particleCount = () => glow.list.length + soft.list.length;
