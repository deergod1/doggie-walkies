// Decoration props (assets/props/, clutter/, themes/, the town's and the treasure chest; one
// file per library and prop set, tools/prop-metadata.mjs PROP_FILES): instanced meshes per
// cube. The catalog (core/propcatalog.js) knows every prop from the start; a set's geometry is
// loaded when a cube shows it (loadPropSets, before the cube is entered: render/cubeassets.js).
// Materials are cloned per cube (cubes fade and get cut on their own); props with `sway` move
// in the wind; glowing props add light sources.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cutMaterial } from './section.js';
import { underwaterMaterial } from './underwater.js';
import { buildChests } from './chests.js';
import { loadGLB } from './gltf.js';
import { PROP_FILES } from '../core/propmetadata.js';
import { splitFlames, flameSet } from './flames.js';

import { props } from '../core/propcatalog.js';
export { props } from '../core/propcatalog.js';

const wind = { value: 0 };
export const tickProps = t => { wind.value = t; };

// a loaded library: its props' parts (and an animated prop's node tree and clips) into their catalog entries
export function registerProps(gltf) {
  gltf.scene.updateMatrixWorld(true);
  for (const o of gltf.scene.children) {
    // a prop is one mesh, or a group of meshes when it has a glowing material as well
    const parts = (o.isMesh ? [o] : o.children.filter(c => c.isMesh)).map(c => ({ geometry: c.geometry, material: c.material }));
    if (!parts.length) continue;
    const p = props.byName.get(o.name);
    if (!p) { console.warn('prop without metadata (tools/prop-metadata.mjs):', o.name); continue; }
    p.parts = parts; delete p.flames; delete p.wholeParts;
    splitFlames(p);   // a fire's flames are drawn as flames (render/flames.js)
    // an animated prop (the treasure chest) keeps its whole node tree and clips (render/chests.js)
    if (o.userData.clips) Object.assign(p, { template: o, clips: gltf.animations });
  }
}

// set -> Promise (resolves when its geometry is in the catalog, or failed to load: logged, tried again next time)
const loading = new Map(), loaded = new Set(), onLoaded = [];
export const propSetLoaded = set => loaded.has(set) || !PROP_FILES[set];
// fn(set) whenever a set's geometry arrives
export const onPropSet = fn => { onLoaded.push(fn); };
export function loadPropSets(sets) {
  return Promise.all(sets.filter(set => !propSetLoaded(set)).map(set => {
    if (!loading.has(set)) loading.set(set, Promise.all(PROP_FILES[set].map(f => loadGLB('assets/' + f))).then(libraries => {
      libraries.forEach(registerProps);
      loaded.add(set);
      for (const fn of onLoaded) fn(set);
    }, e => { loading.delete(set); console.error('prop set failed to load:', set, e); }));
    return loading.get(set);
  }));
}

// sway: bend with the wind, more the further from the attachment point; per-instance phase
function swayMaterial(mat, sway) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uWind = wind; sh.uniforms.uSway = { value: sway };
    sh.vertexShader = 'uniform float uWind, uSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = 0.0;
      #ifdef USE_INSTANCING
        ph = instanceMatrix[3].x * 0.9 + instanceMatrix[3].z * 1.7;
      #endif
      float bend = abs(position.y) * uSway * 0.07;
      transformed.x += sin(uWind * 1.9 + ph) * bend;
      transformed.z += cos(uWind * 1.4 + ph * 1.3) * bend * 0.7;`);
  };
  mat.customProgramCacheKey = () => key + '|sway';
  return mat;
}

// a glowing part of a prop whose light lives (`flicker`): its glow flickers like a flame ('flame',
// render/flames.js flicker) or breathes ('pulse', breathe), each instance in its own time and in
// step with its light (both seeded by where it stands: fireSeed below; wind is the game's clock)
function glowMaterial(mat, kind) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, r) => {
    prev.call(mat, sh, r);
    sh.uniforms.uWind = wind;
    sh.vertexShader = 'uniform float uWind;\nvarying float vGlowK;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float glowSeed = 0.0;
      #ifdef USE_INSTANCING
        glowSeed = mod(instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3, 6.28);
      #endif
      vGlowK = ${kind === 'pulse' ? '0.72 + 0.28 * sin(uWind * (0.9 + glowSeed * 0.08) + glowSeed * 5.0)'
        : '0.8 + 0.2 * sin(uWind * 13.0 + glowSeed * 7.0) * sin(uWind * 7.3 + glowSeed * 3.0)'};`);
    sh.fragmentShader = 'varying float vGlowK;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vGlowK;');
  };
  mat.customProgramCacheKey = () => key + '|glow-' + kind;
  return mat;
}

const qt = new THREE.Quaternion(), tilt = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), at = new THREE.Vector3(), size = new THREE.Vector3();
// where a placed prop { x, y, z, yaw, s, normal } stands, in its cube (also the proxies' landmarks)
export function propMatrix(q, target = new THREE.Matrix4()) {
  qt.setFromAxisAngle(up, q.yaw);
  if (q.normal) qt.premultiply(tilt.setFromUnitVectors(up, new THREE.Vector3(...q.normal).normalize()));
  return target.compose(at.set(q.x, q.y, q.z), qt, size.setScalar(q.s ?? 1));
}
// ... or its own matrix (`matrix`, 16 numbers: a string's segments, sheared along its curve)
const placeMatrix = (q, target) => q.matrix ? target.fromArray(q.matrix) : propMatrix(q, target);

// A prop's parts as one plain geometry for the proxies' batch (render/neighbors.js): position,
// normal, color (vertex colour times the part's colour) and glow (its emissive light times
// `glow`), so glowing windows and braziers still glow in the surroundings.
export function propBatchGeometry(p, glow) {
  const parts = (p.wholeParts ?? p.parts).map(({ geometry, material }) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry.clone(), n = g.attributes.position.count;
    const base = material.color || new THREE.Color(1, 1, 1);
    const light = (material.emissive || new THREE.Color(0, 0, 0)).clone().multiplyScalar((material.emissiveIntensity ?? 1) * glow);
    const src = g.attributes.color, color = new Float32Array(n * 3), lit = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      color[i * 3] = (src ? src.getX(i) : 1) * base.r; color[i * 3 + 1] = (src ? src.getY(i) : 1) * base.g; color[i * 3 + 2] = (src ? src.getZ(i) : 1) * base.b;
      lit[i * 3] = light.r; lit[i * 3 + 1] = light.g; lit[i * 3 + 2] = light.b;
    }
    const vec3 = a => { const v = new Float32Array(n * 3); for (let i = 0; i < n; i++) { v[i * 3] = a.getX(i); v[i * 3 + 1] = a.getY(i); v[i * 3 + 2] = a.getZ(i); } return v; };
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(vec3(g.attributes.position), 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(vec3(g.attributes.normal), 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
    out.setAttribute('glow', new THREE.Float32BufferAttribute(lit, 3));
    g.dispose();
    return out;
  });
  const merged = mergeGeometries(parts);
  parts.forEach(g => g.dispose());
  merged.setIndex([...Array(merged.attributes.position.count).keys()]);
  return merged;
}

const fireSeed = q => (q.x * 1.7 + q.z * 2.3) % 6.28;   // (a fire's flame and light flicker as one)
// how many glowing props of a cube give off light (a theme may want more: themes/index.js `lights`)
export const PROP_LIGHTS = 6;
const LIGHT_SPACING = 2.2;   // lights of a cube at least this far apart while others are left (spread over it)
// placed: [{ name, x, y, z, yaw, s, tint }] -> instanced meshes (and light sources) in group;
// water: the cube's (render/wet.js waterUniforms): what lies all under it wavers with the bed
// (render/underwater.js); maxLights: how many of them give off light
export function buildProps(placed, group, water = null, maxLights = PROP_LIGHTS) {
  const byName = new Map();
  for (const q of placed) { if (!byName.has(q.name)) byName.set(q.name, []); byName.get(q.name).push(q); }
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), flames = [], fireLights = [], glowing = [];
  for (const [name, list] of byName) {
    const p = props.byName.get(name);
    if (p?.template) { buildChests(p, list, group); continue; }
    if (!p?.parts) continue;
    for (const part of p.parts) {
      const c = cutMaterial(part.material.clone(), 'self', true);
      if (water) underwaterMaterial(c, water, p.maxY ?? p.height ?? 0);
      if (p.flicker && part.material.name.endsWith('_glow')) glowMaterial(c, p.flicker);
      const mesh = new THREE.InstancedMesh(part.geometry, p.sway ? swayMaterial(c, p.sway) : c, list.length);
      mesh.name = p.name;
      mesh.userData.sharedGeo = true;   // the catalog owns the geometry
      list.forEach((q, i) => {
        mesh.setMatrixAt(i, placeMatrix(q, m4));
        mesh.setColorAt(i, col.set(q.tint || '#ffffff'));
      });
      // glowing parts (windows, lantern glass) are light, not matter: no shadow
      mesh.castShadow = (p.blocking || p.height > 0.8) && !part.material.name.endsWith('_glow');
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    // a fire's flames, where its model's stood (the first of them for each of the props: flames
    // first0 + its index in the list)
    const first0 = flames.length;
    for (const f of p.flames ?? []) for (const q of list) {
      const at = new THREE.Vector3(f.x, f.y, f.z).applyMatrix4(placeMatrix(q, m4)), s = q.s ?? 1;
      flames.push({ x: at.x, y: at.y, z: at.z, w: f.w * s, h: f.h * s, seed: fireSeed(q) });
    }
    if (p.light && !p.cover) for (const [qi, q] of list.entries()) if (!q.unlit)   // (unlit: e.g. daytime lamp posts in the town clearings)
      glowing.push({ p, q, flame: p.flames?.length ? first0 + qi : -1 });
  }
  // a few glowing props light their surroundings (all of them, always: render/lightpool.js): the big ones
  // first, then the brightest, spread over the cube; a fire's light flickers with its flame, a
  // lantern's like a flame (`flicker` 'flame'), a glowing mushroom's breathes ('pulse')
  const big = g => g.p.landmark || g.p.vignette ? 1 : 0;
  glowing.sort((a, b) => big(b) - big(a) || b.p.intensity - a.p.intensity);
  const lit = [];
  for (const pass of [LIGHT_SPACING, 0]) for (const g of glowing) {
    if (lit.length >= maxLights) break;
    if (lit.includes(g) || lit.some(h => Math.hypot(h.q.x - g.q.x, h.q.z - g.q.z) < pass)) continue;
    lit.push(g);
  }
  for (const { p, q, flame } of lit) {
    const l = new THREE.PointLight(p.light, p.intensity * 2, p.landmark || p.vignette ? 5 : 4, 2);
    l.position.set(q.x, q.y + (p.attach === 'ceiling' ? -0.4 : p.landmark || p.vignette ? 1.1 : 0.5), q.z);
    if (p.flames || p.flicker) fireLights.push({ light: l, gain: p.intensity * 2, seed: fireSeed(q), i: flame, pulse: p.flicker === 'pulse' });
    group.add(l);
  }
  if (flames.length || fireLights.length) group.add(flameSet(flames, fireLights).mesh);
}
