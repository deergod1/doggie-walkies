import * as THREE from 'three';
import { tr } from '../i18n/i18n.js';
import { makeDog, makePerson, makeSquirrel } from './models.js';
import { distance, pathLength } from './navigation.js';
import { STREET, ROAD } from './world.js';

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#dce9db'); scene.fog = new THREE.Fog('#dce9db', 42, 95);
  scene.add(new THREE.HemisphereLight('#fff3d7', '#72966a', 2.3));
  const sun = new THREE.DirectionalLight('#fff1d2', 3.2); sun.position.set(-12, 25, 12);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -23, right: 23, top: 23, bottom: -23, near: 1, far: 65 });
  sun.shadow.normalBias = 0.04; scene.add(sun); scene.add(sun.target);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120), focus = new THREE.Vector3(0, 0, 3);
  const dog = makeDog(), handler = makePerson(), squirrel = makeSquirrel(), neighbor = makePerson('#c48b70');
  for (const model of [dog, handler, squirrel, neighbor]) scene.add(model.group);
  const ropePositions = new Float32Array(64 * 3), ropeGeo = new THREE.BufferGeometry();
  ropeGeo.setAttribute('position', new THREE.BufferAttribute(ropePositions, 3)); ropeGeo.setDrawRange(0, 0);
  const ropeMat = new THREE.LineBasicMaterial({ color: '#39756e' }), rope = new THREE.Line(ropeGeo, ropeMat);
  rope.frustumCulled = false; scene.add(rope);
  const cursor = new THREE.Mesh(new THREE.RingGeometry(0.26, 0.34, 24), new THREE.MeshBasicMaterial({ color: '#fcf2cf', side: THREE.DoubleSide }));
  cursor.rotation.x = -Math.PI / 2; cursor.position.y = 0.09; cursor.visible = false; scene.add(cursor);
  const selection = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.52, 32), new THREE.MeshBasicMaterial({ color: '#fff5c6', side: THREE.DoubleSide }));
  selection.rotation.x = -Math.PI / 2; scene.add(selection);
  const routeMarker = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.41, 24), new THREE.MeshBasicMaterial({ color: '#d49c4b', side: THREE.DoubleSide, transparent: true, opacity: 0.65 }));
  routeMarker.rotation.x = -Math.PI / 2; scene.add(routeMarker);
  let world = null, revision = -1, markers = [], foliage = [], zoom = 16, yaw = 0.46, lastW = 0, lastH = 0;

  function build(s) {
    if (world) {
      const geos = new Set(), mats = new Set();
      world.traverse(o => { if (o.geometry) geos.add(o.geometry); if (o.material) mats.add(o.material); });
      for (const g of geos) g.dispose(); for (const m of mats) { m.map?.dispose(); m.dispose(); } scene.remove(world);
    }
    world = new THREE.Group(); scene.add(world); markers = []; foliage = [];
    const colors = new Map();
    const mat = color => { if (!colors.has(color)) colors.set(color, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })); return colors.get(color); };
    const add = (geometry, color, x, y, z) => {
      const m = new THREE.Mesh(geometry, mat(color)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; world.add(m); return m;
    };
    const box = (x, y, z, w, h, d, color) => add(new THREE.BoxGeometry(w, h, d), color, x, y, z);
    const { wx, wz, half } = s.map;
    const grass = ['#9eb984', '#a6bc8f', '#a7bc80'][s.map.palette];
    box(wx, -0.48, wz, half * 2 + 30, 0.95, half * 2 + 30, '#ac9c7d');
    box(wx, -0.04, wz, half * 2 + 30, 0.12, half * 2 + 30, grass);
    // Streets run to the horizon of the window; the corridor is clear by construction.
    const path = '#e5d6b3';
    for (let gx = Math.floor((wx - half - STREET) / STREET); gx * STREET <= wx + half + STREET; gx++) {
      box(gx * STREET, 0.02, wz, ROAD * 2, 0.035, half * 2 + STREET * 2, path);
      box(wx, 0.021, gx * STREET, half * 2 + STREET * 2, 0.035, ROAD * 2, path);
    }
    const sign = (text, x, y, z, rotY, wide = 2.2) => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 128;
      const ctx = c.getContext('2d'); ctx.fillStyle = '#3c554a'; ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = '#fff0cf'; ctx.font = '40px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 64, 470);
      const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wide, wide / 4), new THREE.MeshBasicMaterial({ map: texture }));
      m.position.set(x, y, z); m.rotation.y = rotY; world.add(m); return m;
    };
    for (const h of s.map.houses) {
      const color = ['#ead4ad', '#c0c9b1', '#d9b6a5', '#c3d2ca'][h.color];
      const bw = h.axis === 'x' ? h.d : h.w, bd = h.axis === 'x' ? h.w : h.d;
      box(h.x, h.h / 2, h.z, bw, h.h, bd, color);
      // Village District reference: flat parapets, glazed storefronts, brick piers and awnings.
      box(h.x, h.h + 0.04, h.z, bw + 0.18, 0.16, bd + 0.18, '#f5e5bf');
      box(h.x, h.h + 0.12, h.z, bw - 0.22, 0.08, bd - 0.22, '#9b9989');
      const front = (o, y, out, len, height, thick, c) => h.axis === 'x'
        ? box(h.x + h.sign * (h.d / 2 + out + thick / 2), y, h.z + o, thick, height, len, c)
        : box(h.x + o, y, h.z + h.sign * (h.d / 2 + out + thick / 2), len, height, thick, c);
      for (const o of [-h.w / 4 - 0.35, h.w / 4 + 0.35]) {
        front(o, 1, 0.035, 1.1, 1.6, 0.07, '#faf0d8');
        front(o, 1, 0.08, 0.94, 1.43, 0.04, '#719393');
        front(o, 0.55, 0.11, 0.94, 0.035, 0.03, '#e8e0c7');
      }
      front(0, 0.94, 0.05, 0.7, 1.88, 0.1, '#e8ddc1');
      front(0, 1.02, 0.12, 0.53, 1.55, 0.04, '#527976');
      for (const o of [-h.w / 2 + 0.45, h.w / 2 - 0.45]) {
        front(o, 1.04, 0.13, 0.26, 2.08, 0.26, '#ae7e61');
        for (let y = 0.2; y < 2; y += 0.22) front(o, y, 0.27, 0.26, 0.018, 0.015, '#d0b396');
      }
      const awning = ['#477e79', '#b8818b', '#c3a850', '#4f6462'][h.color];
      front(0, 2.13, 0.43, Math.min(3.5, h.w - 0.4), 0.13, 0.9, awning);
      front(0, 2.02, 0.85, Math.min(3.5, h.w - 0.4), 0.18, 0.055, awning);
      const label = [tr('Coffee & crumbs'), tr('Little bookshop'), tr('Flowers & things'), tr('The good dog')][h.color];
      const sx = h.axis === 'x' ? h.x + h.sign * (h.d / 2 + 0.1) : h.x, sz = h.axis === 'x' ? h.z : h.z + h.sign * (h.d / 2 + 0.1);
      sign(label, sx, h.h - 0.35, sz, h.axis === 'x' ? (h.sign > 0 ? Math.PI / 2 : -Math.PI / 2) : (h.sign > 0 ? 0 : Math.PI), 2.4);
    }
    for (const p of s.map.places) {
      add(new THREE.CylinderGeometry(5.2, 5.2, 0.04, 28), p.home ? '#dfdbb8' : '#e0d3ae', p.x, 0.055, p.z);
      if (p.home) {
        // Home corner: one old oak, a bench, and a name to come back to.
        add(new THREE.CylinderGeometry(0.3, 0.48, 2.2, 7), '#8a7050', p.x + 2.6, 1.1, p.z + 2.6);
        const leaf = '#6d8f62';
        const crown = add(new THREE.IcosahedronGeometry(1.7, 1), leaf, p.x + 2.6, 3.1, p.z + 2.6); crown.scale.y = 1.2;
        const branch = add(new THREE.IcosahedronGeometry(1.15, 0), leaf, p.x + 3.3, 2.5, p.z + 3.2);
        for (const m of [crown, branch]) { m.material = m.material.clone(); m.material.transparent = true; foliage.push(m); }
      } else {
        // A little plaza with a fountain at its heart.
        add(new THREE.CylinderGeometry(0.95, 1.05, 0.5, 12), '#b9b3a0', p.x, 0.25, p.z);
        add(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 12), '#9fc4c9', p.x, 0.52, p.z);
        add(new THREE.CylinderGeometry(0.1, 0.14, 0.7, 8), '#b9b3a0', p.x, 0.8, p.z);
        add(new THREE.SphereGeometry(0.14, 8, 6), '#cfe4e6', p.x, 1.18, p.z);
      }
      for (const [bx, bz] of [[-3.1, 3.1], [3.1, -3.1]]) {
        box(p.x + bx, 0.28, p.z + bz, 1.15, 0.08, 0.38, '#a08059');
        box(p.x + bx - 0.4, 0.12, p.z + bz, 0.08, 0.24, 0.34, '#8a6c49');
        box(p.x + bx + 0.4, 0.12, p.z + bz, 0.08, 0.24, 0.34, '#8a6c49');
      }
      add(new THREE.CylinderGeometry(0.05, 0.06, 1.6, 6), '#6d5a3f', p.x + 4.3, 0.8, p.z - 1.4);
      sign(tr(p.name), p.x + 4.3, 1.75, p.z - 1.4, Math.PI / 2, 2.0);
    }
    for (const t of s.map.trees) {
      add(new THREE.CylinderGeometry(0.18, 0.3, 1.8, 7), '#8a7050', t.x, 0.9, t.z);
      const leafColor = t.hue < 0.3 ? '#c5b96b' : t.hue < 0.6 ? '#7c9c68' : '#658c65';
      const crown = add(new THREE.IcosahedronGeometry(t.size * 1.12, 1), leafColor, t.x, 2.5, t.z); crown.scale.y = 1.25;
      const branch = add(new THREE.IcosahedronGeometry(t.size * 0.8, 0), leafColor, t.x + 0.45, 2.1, t.z + 0.35);
      for (const m of [crown, branch]) { m.material = m.material.clone(); m.material.transparent = true; foliage.push(m); }
    }
    for (const p of s.map.lamps) {
      add(new THREE.CylinderGeometry(0.045, 0.07, 2.5, 8), '#526557', p.x, 1.25, p.z);
      add(new THREE.SphereGeometry(0.16, 8, 6), '#fff2cc', p.x, 2.62, p.z);
      add(new THREE.ConeGeometry(0.2, 0.15, 8), '#526557', p.x, 2.8, p.z);
    }
    for (const f of s.map.flowers) {
      for (let i = 0; i < 3; i++) {
        const x = f.x + Math.sin(i * 2.1) * 0.16, z = f.z + Math.cos(i * 2.1) * 0.16;
        box(x, 0.14, z, 0.025, 0.25, 0.025, '#718c56');
        add(new THREE.IcosahedronGeometry(0.085, 0), ['#f5df9a', '#dca39b', '#e8e5ca'][f.color], x, 0.29, z);
      }
    }
    for (const p of s.map.scents) {
      const m = add(new THREE.TorusGeometry(0.35, 0.035, 5, 24), '#d5ac53', p.x, 0.12, p.z); m.rotation.x = Math.PI / 2;
      const mote = add(new THREE.OctahedronGeometry(0.095), '#fff1b0', p.x, 0.65, p.z);
      markers.push({ p, m, mote });
    }
    // The light travels with the window, like everything else.
    sun.position.set(wx - 12, 25, wz + 12); sun.target.position.set(wx, 0, wz);
    focus.set(s.dog.x, 0.6, s.dog.z); revision = s.revision;
  }
  function drawRope(s) {
    const path = s.leash;
    if (!path || path.length < 2) { ropeGeo.setDrawRange(0, 0); return; }
    const total = pathLength(path), slack = Math.max(0, 2.7 - Math.hypot(total, 0.45));
    let at = 0, traversed = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], length = distance(a, b);
      const pieces = Math.max(2, Math.ceil(length * 7));
      for (let n = i === 1 ? 0 : 1; n <= pieces && at < 64; n++) {
        const k = n / pieces, t = total > 0 ? (traversed + length * k) / total : 0;
        ropePositions[at * 3] = a.x + (b.x - a.x) * k;
        ropePositions[at * 3 + 1] = 0.98 + t * 0.45 - Math.sin(Math.PI * t) * Math.min(0.65, slack * 0.65);
        ropePositions[at * 3 + 2] = a.z + (b.z - a.z) * k; at++;
      }
      traversed += length;
    }
    ropeGeo.setDrawRange(0, at); ropeGeo.attributes.position.needsUpdate = true;
    ropeMat.color.set(s.tension > 0.65 ? '#c4823f' : '#39756e');
  }
  const raycaster = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  return {
    renderer, scene, camera,
    pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -(clientY - r.top) / r.height * 2 + 1), camera);
      const p = raycaster.ray.intersectPlane(ground, new THREE.Vector3()); return p ? { x: p.x, z: p.z } : null;
    },
    direction(x, z) { return { x: x * Math.cos(yaw) + z * Math.sin(yaw), z: -x * Math.sin(yaw) + z * Math.cos(yaw) }; },
    zoom(delta) { zoom = THREE.MathUtils.clamp(zoom + delta, 8, 28); },
    rotate(delta) { yaw += delta; },
    render(s, dt) {
      if (revision !== s.revision) build(s);
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w !== lastW || h !== lastH) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); lastW = w; lastH = h; }
      dog.update(s.dog, dt, s); handler.update(s.handler, dt, s);
      squirrel.update(s.npcs[0], dt, s); neighbor.update(s.npcs[1], dt, s);
      const target = new THREE.Vector3(s.dog.x * 0.65 + s.handler.x * 0.35, 0.65, s.dog.z * 0.65 + s.handler.z * 0.35);
      focus.lerp(target, 1 - Math.exp(-dt * 6));
      camera.position.set(focus.x + Math.sin(yaw) * zoom, zoom * 0.92, focus.z + Math.cos(yaw) * zoom);
      camera.lookAt(focus); drawRope(s);
      // Let the dog remain visible while sniffing beneath a canopy; trunks still collide.
      for (const m of foliage) {
        const obscures = [s.dog, s.handler].some(a => {
          const end = new THREE.Vector3(a.x, 0.8, a.z), ray = end.sub(camera.position);
          const t = m.position.clone().sub(camera.position).dot(ray) / ray.lengthSq();
          return t > 0 && t < 1 && m.position.distanceTo(camera.position.clone().addScaledVector(ray, t)) < m.geometry.parameters.radius * m.scale.y + 0.2;
        });
        m.material.opacity += ((obscures ? 0.22 : 1) - m.material.opacity) * Math.min(1, dt * 8);
        m.material.depthWrite = m.material.opacity > 0.95;
      }
      const active = s.control === 'handler' ? s.handler : s.dog;
      selection.position.set(active.x, 0.08, active.z);
      cursor.visible = !!s.clickGoal; if (s.clickGoal) cursor.position.set(s.clickGoal.x, 0.09, s.clickGoal.z);
      routeMarker.visible = !!s.route?.target;
      if (s.route?.target) routeMarker.position.set(s.route.target.x, 0.09, s.route.target.z);
      for (const { p, m, mote } of markers) {
        const discovered = s.discovered.includes(p.id); m.visible = mote.visible = !discovered;
        mote.position.y = 0.6 + Math.sin(s.time * 2 + p.x) * 0.12; mote.rotation.y = s.time;
      }
      renderer.render(scene, camera);
    },
  };
}
