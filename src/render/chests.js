// Treasure chests (assets/items/treasure_chest.glb): an empty planked box with its lid on a
// hinge, and the lid's Open and Close clips. A reward site's chest is placed like any prop
// (cubegen/sites.js), but each one is its own object rather than an instance, so its lid can
// move. Opening one (game/chests.js) plays Open; cubes built later show it open right away
// (render/world.js). The loot lies inside while the lid opens, shrunk to fit on the floor the
// model's `contents_gltf` extra marks (stowLoot), and then spills out in front (game/loot.js).
import * as THREE from 'three';
import { cutMaterial } from './section.js';
import { ITEMS } from '../core/items.js';
import { isCoin } from '../core/loot.js';

export const CHEST = 'treasure_chest';
// the placement of a chest as it stands once opened
export const openedChest = q => q.name === CHEST ? { ...q, open: true } : q;

const playing = new Set();   // mixers with a clip running

// p: the chest's catalog entry (render/props.js keeps its glTF root and clips); list: its
// placements in this cube. The chests share their materials, cloned per cube like other props.
export function buildChests(p, list, group) {
  const materials = new Map();
  const material = m => materials.get(m) ?? materials.set(m, cutMaterial(m.clone(), 'self', true)).get(m);
  for (const q of list) {
    const chest = p.template.clone();
    chest.traverse(o => {
      if (!o.isMesh) return;
      o.material = material(o.material);
      o.userData.sharedGeo = true;   // the catalog owns the geometry
      o.castShadow = o.receiveShadow = true;
    });
    chest.position.set(q.x, q.y, q.z);
    chest.rotation.y = q.yaw;
    chest.scale.setScalar(q.s);
    chest.userData.chest = { site: q.site, mixer: new THREE.AnimationMixer(chest), clips: p.clips };
    chest.userData.chest.mixer.addEventListener('finished', e => playing.delete(e.target));
    if (q.open) play(chest, 'Open', true);
    group.add(chest);
  }
}

// clip: 'Open' | 'Close'; instant: jump to its last frame. The clip's length in seconds.
function play(chest, clip, instant = false) {
  const { mixer, clips } = chest.userData.chest;
  const c = THREE.AnimationClip.findByName(clips, clip);
  if (!c) return 0;
  mixer.stopAllAction();
  const action = mixer.clipAction(c);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.reset().play();
  if (instant) mixer.update(c.duration);
  else playing.add(mixer);
  return instant ? 0 : c.duration;
}

export const chestAt = (world, siteId) => world?.group.children.find(o => o.userData.chest?.site === siteId) ?? null;
// how long until the clip has played out (0: no such chest)
export function animateChest(world, siteId, clip) {
  const chest = chestAt(world, siteId);
  return chest ? play(chest, clip) : 0;
}
export const showChestOpen = (world, siteId) => animateChest(world, siteId, 'Open');

// Loot about to spill out of chest `siteId` (game/chests.js) lies in it first: coins on the
// bottom, potions, crystals and armor on them, the weapons on top along the chest. Each pickup
// starts its arc `from` its spot (the bottom of it), and `inside` says how it lies there
// (render/loot.js): { yaw, fit (the most it may measure across), h (and high), flat (a coin on
// its face) }. false: no such chest here.
const TAU = Math.PI * 2;
const jitter = a => (Math.random() - 0.5) * a;
// n cells over a floor w by d: the centre of cell i, and a cell's size
function grid(n, w, d) {
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * w / d)))), rows = Math.max(1, Math.ceil(n / cols));
  return { w: w / cols, d: d / rows, at: i => [(i % cols + 0.5) * w / cols - w / 2, (Math.floor(i / cols) + 0.5) * d / rows - d / 2] };
}
export function stowLoot(world, siteId, list) {
  const chest = chestAt(world, siteId), floor = chest?.userData.contents_gltf, area = chest?.userData.contents_size_gltf;
  if (!floor || !area) return false;
  chest.updateMatrix();
  const [W, D] = area, s = chest.scale.x, at = new THREE.Vector3();
  // (x, y, z in the chest's glTF units from the middle of its floor; fit and h too)
  const put = (p, x, y, z, fit, h, yaw, flat = false) => {
    const cx = Math.max(0, (W - fit) / 2), cz = Math.max(0, (D - Math.min(fit, D)) / 2);
    at.set(floor[0] + Math.max(-cx, Math.min(cx, x)), floor[1] + y, floor[2] + Math.max(-cz, Math.min(cz, z))).applyMatrix4(chest.matrix);
    p.from = { x: at.x, y: at.y, z: at.z };
    p.inside = { yaw: chest.rotation.y + yaw, fit: fit * s, h: h * s, flat };
  };
  const coins = list.filter(p => isCoin(p.itemId)), weapons = list.filter(p => ITEMS[p.itemId].weapon);
  const rest = list.filter(p => !coins.includes(p) && !weapons.includes(p));
  const c = grid(coins.length, W, D);
  coins.forEach((p, i) => {
    const [x, z] = c.at(i);
    put(p, x + jitter(c.w * 0.6), Math.random() * 0.02, z + jitter(c.d * 0.6), 0.17, 0.05, Math.random() * TAU, true);
  });
  const r = grid(rest.length, W, D);
  rest.forEach((p, i) => {
    const [x, z] = r.at(i), fit = Math.min(ITEMS[p.itemId].armor ? 0.3 : 0.2, Math.max(r.w, r.d));
    put(p, x + jitter(r.w * 0.3), 0.03, z + jitter(r.d * 0.3), fit, 0.27, jitter(1.2));
  });
  // (a weapon lies along -Z: a quarter turn puts it along the chest)
  weapons.forEach((p, i) => put(p, jitter(0.04), 0.07 + i * 0.03, (weapons.length > 1 ? i / (weapons.length - 1) - 0.5 : 0) * D * 0.4 + jitter(0.04),
    W * 0.92, 0.08, Math.PI / 2 + jitter(0.25)));
  return true;
}

// render/world.js animateWorld, every frame
export function tickChests(dt) {
  for (const mixer of playing) mixer.update(dt);
}
