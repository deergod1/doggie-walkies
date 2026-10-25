// Wet footprints on the slime (the slime marsh: core/footing.js, its `slime` ground): the hero's
// at each foot's touchdown (game/footsteps.js), a friend's and the enemies' as they walk (a print
// every so far, the feet taking turns: walkPrints). They lie where they were left in the cube and
// dry up, shrinking away over the last part of their life; a new cube starts without any. One
// instanced mesh, the oldest print giving its place to the newest.
import * as THREE from 'three';
import { scene } from './scene.js';

const MOST = 160;     // prints at once
const LIFE = 9;       // s a print lasts
const DRY = 0.35;     // the share of its life it takes drying up
const STRIDE = 0.34;  // cells walked between a walker's prints (one foot, then the other)
const COLOR = '#7ad040', GLOW = '#2e6a14', OPACITY = 0.6;   // slime green, a little aglow (seen at night too)

// a boot's print, flat on the floor, its toe towards +z (about a quarter of a cell long)
function printShape() {
  const ellipse = (cx, cy, rx, ry, n = 10) => {
    const s = new THREE.Shape();
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * 2 * i / n, x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
      if (i) s.lineTo(x, y); else s.moveTo(x, y);
    }
    return new THREE.ShapeGeometry(s);
  };
  // (shapes lie in x, y; turned flat, face up, their -y becomes the toe's +z)
  const sole = ellipse(0, -0.045, 0.045, 0.065), heel = ellipse(0, 0.07, 0.036, 0.04), n = sole.attributes.position.count;
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute([...sole.attributes.position.array, ...heel.attributes.position.array], 3));
  merged.setIndex([...sole.index.array, ...[...heel.index.array].map(i => i + n)]);
  merged.rotateX(-Math.PI / 2);
  merged.computeVertexNormals();
  return merged;
}
const geometry = printShape();
const material = new THREE.MeshStandardMaterial({ color: COLOR, emissive: GLOW, roughness: 0.15, metalness: 0, transparent: true, opacity: OPACITY,
  depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const mesh = new THREE.InstancedMesh(geometry, material, MOST);
mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 1;
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(mesh);

const prints = [];     // { x, y, z, yaw, size, age }, oldest first
const walkers = new Map();   // key -> { x, z, side }: where its last print is
let cube = null;

// a print of one foot at (x, y, z) (where the body stands: the foot is beside it), facing yaw;
// side: -1 left, 1 right; size: how big the body is
export function footprint(x, y, z, yaw, side, size = 1) {
  const s = Math.sin(yaw), c = Math.cos(yaw), d = 0.08 * side * size;
  prints.push({ x: x + d * c, y, z: z - d * s, yaw: yaw + 0.12 * side, size: size * (0.92 + Math.random() * 0.16), age: 0 });
  if (prints.length > MOST) prints.shift();
}
// a walker `key` (an enemy, a friend) at (x, y, z) facing yaw: a print whenever it has gone far
// enough since its last one; grounded: whether it stands on slime now (else it only keeps track)
export function walkPrints(key, x, y, z, yaw, size = 1, onSlime = true) {
  const w = walkers.get(key);
  if (!w || Math.hypot(x - w.x, z - w.z) > 2) { walkers.set(key, { x, z, side: 1 }); return; }   // (new, or moved by a cube sliding)
  if (Math.hypot(x - w.x, z - w.z) < STRIDE * size) return;
  w.x = x; w.z = z; w.side = -w.side;
  if (onSlime) footprint(x, y, z, yaw, w.side, size);
}
export const forgetWalker = key => walkers.delete(key);
export function clearFootprints() { prints.length = 0; walkers.clear(); mesh.count = 0; }

const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
// every frame: age the prints and lay them out; key: the cube being played (a new one: none)
export function tickFootprints(dt, key) {
  if (key !== cube) { cube = key; clearFootprints(); }
  while (prints.length && prints[0].age >= LIFE) prints.shift();
  for (const f of prints) f.age += dt;
  mesh.count = prints.length;
  prints.forEach((f, i) => {
    const k = f.size * Math.min(1, (LIFE - f.age) / (LIFE * DRY));   // drying up: shrinking away
    m.compose(p.set(f.x, f.y + 0.012, f.z), q.setFromAxisAngle(up, f.yaw), sc.set(k, 1, k));
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
}
// for render/warmup.js: the prints' program, compiled before the first one is left
let warmer = null;
export const footprintWarmup = () => [warmer ??= Object.assign(new THREE.InstancedMesh(geometry, material, 1), { frustumCulled: false })];
export const footprintCount = () => prints.length;
