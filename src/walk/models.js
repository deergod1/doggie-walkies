// Original low-poly walking cast, built from geometry: no download or Blender needed.
// Pivots form a small articulated rig; body motion, gait, ears and tail follow simulation state.
import * as THREE from 'three';
const material = color => new THREE.MeshStandardMaterial({ color, roughness: 0.88, flatShading: true });
function mesh(parent, geometry, mat, x = 0, y = 0, z = 0, scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z); m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function ball(parent, mat, x, y, z, sx, sy, sz) {
  return mesh(parent, new THREE.SphereGeometry(1, 10, 7), mat, x, y, z, [sx, sy, sz]);
}
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
function bone(parent, mat, from, to, radius) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), d = b.clone().sub(a);
  const m = mesh(parent, new THREE.CylinderGeometry(radius * 0.8, radius, d.length(), 8), mat);
  m.position.copy(a.add(b).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
}
function place(group, actor) { group.position.set(actor.x, 0.04, actor.z); group.rotation.y = actor.yaw; }

export function makeDog() {
  const group = new THREE.Group(), body = pivot(group, 0, 0, 0);
  const tan = material('#bd7e48'), cream = material('#fff1cf'), brown = material('#714b36'), black = material('#282d30'), teal = material('#2a8c82');
  ball(body, tan, 0, 0.63, -0.02, 0.31, 0.31, 0.58);
  ball(body, brown, 0, 0.76, -0.12, 0.285, 0.19, 0.37);
  ball(body, cream, 0, 0.64, 0.35, 0.27, 0.29, 0.22);
  const harness = mesh(body, new THREE.TorusGeometry(0.295, 0.035, 6, 14), teal, 0, 0.65, 0.12);
  harness.scale.y = 1.03;
  bone(body, teal, [0, 0.94, 0.13], [0, 0.94, -0.23], 0.035);
  const head = pivot(body, 0, 0.88, 0.43);
  ball(head, tan, 0, 0.02, 0.03, 0.28, 0.25, 0.29);
  ball(head, cream, 0, -0.055, 0.26, 0.21, 0.15, 0.23);
  ball(head, black, 0, 0.005, 0.45, 0.09, 0.065, 0.055);
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = pivot(head, side * 0.24, 0.1, -0.03);
    ball(ear, brown, side * 0.025, -0.19, 0, 0.115, 0.27, 0.13); ears.push(ear);
    ball(head, black, side * 0.17, 0.1, 0.23, 0.04, 0.047, 0.03);
    ball(head, cream, side * 0.177, 0.117, 0.252, 0.012, 0.013, 0.01);
    ball(head, cream, side * 0.17, 0.17, 0.17, 0.07, 0.025, 0.035);
  }
  const legs = [];
  for (const z of [-0.36, 0.34]) for (const x of [-0.21, 0.21]) {
    const leg = pivot(body, x, 0.52, z);
    bone(leg, tan, [0, 0, 0], [0, -0.28, 0.015], 0.085);
    ball(leg, cream, 0, -0.39, 0.045, 0.09, 0.13, 0.14); legs.push(leg);
  }
  const tail = pivot(body, 0, 0.77, -0.52);
  bone(tail, tan, [0, 0, 0], [0, 0.25, -0.27], 0.065);
  bone(tail, cream, [0, 0.25, -0.27], [0, 0.4, -0.38], 0.045);
  let stride = 0;
  return { group, update(actor, dt, state) {
    place(group, actor); const moving = Math.min(1, actor.speed / 1.5), sniff = !!state.sniff;
    stride += dt * actor.speed * 7;
    legs.forEach((leg, i) => { leg.rotation.x = Math.sin(stride + [0, Math.PI, Math.PI, 0][i]) * 0.48 * moving; });
    body.position.y = Math.abs(Math.sin(stride)) * 0.035 * moving;
    head.rotation.x += ((sniff ? 0.85 : actor.intent.kind === 'investigating' ? 0.32 : -0.06) - head.rotation.x) * Math.min(1, dt * 8);
    head.rotation.y = sniff ? Math.sin(state.time * 7) * 0.12 : Math.sin(state.time * 1.3) * 0.05;
    tail.rotation.y = Math.sin(state.time * (sniff ? 11 : 7)) * (sniff ? 0.65 : 0.35);
    ears.forEach((ear, i) => { ear.rotation.z = (i ? -1 : 1) * (0.12 + Math.sin(stride) * moving * 0.14); });
  } };
}

export function makePerson(color = '#4e7d6b') {
  const group = new THREE.Group(), body = pivot(group, 0, 0, -0.12);
  const coat = material(color), skin = material('#dfad82'), trousers = material('#36444f'), shoes = material('#654a3c');
  const hair = material('#664632'), hat = material('#e7bc69');
  ball(body, coat, 0, 1.18, 0, 0.28, 0.4, 0.2);
  ball(body, skin, 0, 1.7, 0, 0.205, 0.24, 0.19);
  ball(body, hair, 0, 1.78, -0.06, 0.211, 0.2, 0.17);
  ball(body, hat, 0, 1.89, 0, 0.22, 0.12, 0.2);
  ball(body, hat, 0, 2.02, 0, 0.065, 0.065, 0.065);
  ball(body, skin, 0, 1.68, 0.19, 0.045, 0.05, 0.045);
  const eyes = material('#313d35');
  for (const x of [-0.075, 0.075]) ball(body, eyes, x, 1.73, 0.17, 0.018, 0.022, 0.015);
  // Leash hand ends at the simulation anchor, centered over the actor's XZ position.
  bone(body, coat, [0.22, 1.42, 0], [0.3, 1.15, 0.1], 0.09);
  bone(body, coat, [0.3, 1.15, 0.1], [0, 1.39, 0.12], 0.08);
  ball(body, skin, 0, 1.39, 0.12, 0.065, 0.07, 0.06);
  const arm = pivot(body, -0.23, 1.42, 0);
  bone(arm, coat, [0, 0, 0], [0, -0.42, 0], 0.09);
  ball(arm, skin, 0, -0.46, 0, 0.065, 0.08, 0.065);
  const legs = [-1, 1].map(side => {
    const leg = pivot(body, side * 0.13, 0.87, 0);
    bone(leg, trousers, [0, 0, 0], [0, -0.68, 0], 0.09);
    ball(leg, shoes, 0, -0.76, 0.06, 0.12, 0.1, 0.19); return leg;
  });
  let stride = 0;
  return { group, update(actor, dt) {
    place(group, actor); stride += dt * actor.speed * 5;
    const moving = Math.min(1, actor.speed);
    legs.forEach((leg, i) => { leg.rotation.x = Math.sin(stride + i * Math.PI) * moving * 0.4; });
    arm.rotation.x = -Math.sin(stride) * moving * 0.3;
    body.position.y = Math.abs(Math.sin(stride)) * 0.025 * moving;
  } };
}
export function makeSquirrel() {
  const group = new THREE.Group(), fur = material('#b77242'), pale = material('#efd4ac'), dark = material('#303530');
  ball(group, fur, 0, 0.23, 0, 0.14, 0.2, 0.24);
  ball(group, fur, 0, 0.44, 0.17, 0.13, 0.13, 0.15);
  ball(group, pale, 0, 0.39, 0.28, 0.07, 0.06, 0.08);
  ball(group, fur, 0, 0.42, -0.28, 0.16, 0.33, 0.18);
  for (const x of [-0.08, 0.08]) {
    ball(group, fur, x, 0.57, 0.16, 0.045, 0.09, 0.04);
    ball(group, dark, x, 0.47, 0.26, 0.022, 0.022, 0.02);
    ball(group, pale, x, 0.07, 0.08, 0.06, 0.05, 0.13);
  }
  return { group, update(actor, dt, state) {
    place(group, actor); group.position.y += Math.abs(Math.sin(state.time * 18)) * Math.min(0.1, actor.speed * 0.03);
  } };
}
