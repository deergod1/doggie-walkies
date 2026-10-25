// The slime meteorites (game/meteors.js, core/meteors.js) as they come: the shadow where one will
// land, growing and darkening with a bright rim that pulses faster the nearer it is; the lump of
// glowing slime falling into it out of the sky, a light of its own and goo streaming off it; and
// the splats they leave, flat puddles drying up. In the cube's coordinates, with its offset.
import * as THREE from 'three';
import { scene } from './scene.js';
import { glow, emit, rand } from './particles.js';
import { trackLight, untrackLight } from './lightpool.js';
import { METEOR, fallAt, warnAt } from '../core/meteors.js';

const disc = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), rim = new THREE.RingGeometry(0.9, 1, 32).rotateX(-Math.PI / 2);
const lump = new THREE.IcosahedronGeometry(0.32, 1);
const flat = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
const GOO = ['#d8ff9a', '#b8ff5a', '#8ae048'];
const lumpMaterial = new THREE.MeshStandardMaterial({ color: '#4e8a2a', emissive: '#9aff4a', emissiveIntensity: 1.4, roughness: 0.3 });

function makeView() {
  const group = new THREE.Group();
  const shadow = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ color: '#0e2a08', opacity: 0, ...flat }));
  const ring = new THREE.Mesh(rim, new THREE.MeshBasicMaterial({ color: '#b8ff5a', opacity: 0, ...flat, blending: THREE.AdditiveBlending }));
  const rock = new THREE.Mesh(lump, lumpMaterial);
  rock.visible = false;
  const light = new THREE.PointLight('#9aff5a', 0, 5, 2);
  group.add(shadow, ring, rock);
  scene.add(group); trackLight(light, rock, group, 2);
  return { group, shadow, ring, rock, light };
}
// list: the meteorites showing ({ m, at, landed, view }), at the world's play time `clock`
export function drawMeteors(list, clock, dt, off = { x: 0, y: 0, z: 0 }) {
  for (const v of list) {
    if (!v.at) continue;
    const w = v.view || (v.view = makeView()), { m, at } = v, u = warnAt(m, clock), f = fallAt(m, clock);
    w.group.position.set(at.x + off.x, at.y + off.y + 0.02, at.z + off.z);
    const r = METEOR.radius * (0.35 + 0.65 * u);
    w.shadow.scale.set(r, 1, r); w.ring.scale.set(r, 1, r);
    w.shadow.material.opacity = v.landed ? 0 : 0.15 + 0.4 * u;
    w.ring.material.opacity = v.landed ? 0 : (0.35 + 0.35 * Math.sin(clock * (6 + 20 * u))) * u;
    w.rock.visible = f > 0 && !v.landed;
    w.light.intensity = w.rock.visible ? 2.5 : 0;
    if (!w.rock.visible) continue;
    const h = METEOR.sky * (1 - f) * (1 - f);   // (falling faster and faster)
    w.rock.position.set(0, h + 0.3, 0);
    w.rock.rotation.set(clock * 3, clock * 2.2, 0);
    w.rock.scale.setScalar(1 + 0.1 * Math.sin(clock * 30));
    for (let i = Math.floor(70 * dt + Math.random()); i > 0; i--)
      emit(glow, at.x + off.x + rand(-0.2, 0.2), at.y + off.y + h + rand(0.2, 0.6), at.z + off.z + rand(-0.2, 0.2),
        { v: [rand(-0.3, 0.3), rand(1, 3), rand(-0.3, 0.3)], life: rand(0.25, 0.5), size: rand(0.1, 0.2), color: GOO[i % 3], drag: 1.5 });
  }
}
export function removeMeteorView(v) {
  const w = v.view;
  if (!w) return;
  scene.remove(w.group); untrackLight(w.light);
  w.shadow.material.dispose(); w.ring.material.dispose();
  v.view = null;
}
export function clearMeteorViews(list) { list.forEach(removeMeteorView); splatViews.forEach(dropSplat); splatViews.clear(); }

// the splats: { x, y, z, t } (game/meteors.js)
const splatViews = new Map();
const splatShapes = Array.from({ length: 3 }, (_, s) => {
  const pts = [];
  for (let i = 0; i < 18; i++) {
    const a = Math.PI * 2 * i / 18, k = 1 + 0.2 * Math.sin(3 * a + s * 1.9) + 0.12 * Math.sin(7 * a + s);
    pts.push(new THREE.Vector2(Math.cos(a) * k, Math.sin(a) * k));
  }
  return new THREE.ShapeGeometry(new THREE.Shape(pts)).rotateX(-Math.PI / 2);
});
function dropSplat(mesh) { scene.remove(mesh); mesh.material.dispose(); }
export function drawSplats(list, dt, off = { x: 0, y: 0, z: 0 }) {
  for (const [s, mesh] of splatViews) if (!list.includes(s)) { dropSplat(mesh); splatViews.delete(s); }
  for (const s of list) {
    let mesh = splatViews.get(s);
    if (!mesh) {
      mesh = new THREE.Mesh(splatShapes[splatViews.size % 3], new THREE.MeshStandardMaterial({ color: '#6cc23a', emissive: '#2e6a14',
        roughness: 0.12, opacity: 0.75, ...flat }));
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.renderOrder = 1;
      scene.add(mesh); splatViews.set(s, mesh);
    }
    const left = METEOR.splat.time - s.t, k = Math.min(1, left / (METEOR.splat.time / 3));
    mesh.position.set(s.x + off.x, s.y + off.y + 0.015, s.z + off.z);
    mesh.scale.setScalar(METEOR.splat.radius * (0.6 + 0.4 * Math.min(1, s.t * 6)));
    mesh.material.opacity = 0.75 * k;
    if (Math.random() < dt * 2 * k)   // a bubble now and then
      emit(glow, s.x + off.x + rand(-0.5, 0.5), s.y + off.y + 0.05, s.z + off.z + rand(-0.5, 0.5),
        { v: [0, rand(0.2, 0.5), 0], life: rand(0.3, 0.6), size: rand(0.05, 0.09), color: GOO[0], drag: 1 });
  }
}
// the shaders, compiled before the first one falls (render/cubeassets.js)
let warmers = null;
export function meteorWarmup() {
  if (!warmers) {
    const v = makeView();
    scene.remove(v.group); untrackLight(v.light);
    v.shadow.material.opacity = v.ring.material.opacity = 0.5; v.rock.visible = true;
    const splat = new THREE.Mesh(splatShapes[0], new THREE.MeshStandardMaterial({ color: '#6cc23a', emissive: '#2e6a14', roughness: 0.12, opacity: 0.75, ...flat }));
    warmers = [v.group, splat];
  }
  return warmers;
}
