// The fixed lights of a cube and their baked shadows (the shaders' side: render/lighthook.js).
//
// A cube's fixed lights (lanterns, fires, lava, portals: what render/lightpool.js adoptLights
// finds in it that does not move) all shine all the time, each with its shadow, baked when the
// cube is shown:
//   - the lightmap (SETS RGBA8 atlases laid out in the worker, render/lightmap.js): for the sun
//     and eleven channels of lights, the signed distance of each texel of the cube's solids to
//     the shadow's edge, found by testing points round it against the light's shadow map. Drawn,
//     it gives shadow edges as sharp as a pixel, smooth, however close the camera comes.
//   - the volume (SETS RGBA8 3D textures, VOXEL a unit): how much of each light reaches each
//     point round the cube, for what is not lightmapped (props, figures, fluids).
//   - the sun's shadow map of the fixed parts (for what is not lightmapped too).
// What the shadows are cast by: the cube's solids and its fixed props.
//
// Baking never holds a frame up: it goes a few steps a frame (tickBakes: the sun, then a light a
// step, STEPS a frame), while the cube is still faded out (entering through a
// portal it fades in after a moment; render/fade.js). Its lights stay dark until then and come on
// over FADE_IN, the baked shadows with them. A cube built again as it was (the quests' changes,
// a prop set come late) takes the bake it had at once (CACHE).
import * as THREE from 'three';
import { renderer, sun } from './scene.js';
import { BAKE, MAX_BAKED, SETS, NO_SUN, lightTable, CELLS, CELL0, CELL_MAX } from './lighthook.js';
import { lightCells as cellsOf } from '../core/lightcells.js';

const SUN_MAP = 2048;           // texels a side of the sun's shadow map of the fixed parts
const CUBE_MAP = 1024;          // texels a side of each light's cube of shadow maps (while baking)
const NEAR = 0.3;               // a light's shadow starts this far from it (not its own lamp's frame)
const VOXEL = 4;                // volume samples a world unit
const CHANNELS = SETS * 4 - 1;  // channels for lights (the lightmap's first is the sun's)
const STEPS = 2;                // bake steps a frame (a light each: its six shadow maps, its lightmap, its volume)
const BUDGET = 3;               // and no more than this many ms of the frame (at least a step)
const FADE_IN = 350;            // ms: a cube's lights and baked shadows come on over this, once baked
const CACHE = 3;                // bakes of cubes no longer shown, kept to be taken again

// the bakes of the cubes built (their lights follow them every frame: updateBakes)
const live = new Set();
// geometry of a cube (render/cubegeo.js, the same for a cube built again) -> its bake when it went
const kept = new Map();

// a cube's cells and the lights each takes (lightCells): CELL_MAX / 4 texels a cell, four indices each
const cellTable = () => {
  const t = new THREE.DataTexture(new Float32Array(CELL_MAX * CELLS * CELLS).fill(-1), CELL_MAX / 4, CELLS * CELLS, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
};
const uniformsOf = () => ({
  uBakeR: { value: 0 }, uBakeN: { value: 0 }, uBakeT: { value: lightTable(MAX_BAKED) }, uBakeC: { value: cellTable() }, uBakeO: { value: new THREE.Vector3() },
  ...Object.fromEntries(Array.from({ length: SETS }, (_, i) => [['uBakeLm' + i, { value: null }], ['uBakeVol' + i, { value: null }]]).flat()),
  uBakeV0: { value: new THREE.Vector3() }, uBakeVS: { value: new THREE.Vector3(1, 1, 1) },
  uBakeSun: { value: NO_SUN }, uBakeSunM: { value: new THREE.Matrix4() },
});

// A new cube's bake: its uniforms exist before it is baked (its lights dark until then).
// group: the cube's (render/world.js); flip: Flip's turning box, not baked (its lights are moving ones)
export function newBake(geo, group, flip = false) {
  const bake = { geo, group, flip, lights: [], cells: -1, ready: false, failed: false, job: null, readyAt: 0, owned: null, u: uniformsOf() };
  live.add(bake);
  return bake;
}

// a fixed light of the cube: where it is in the cube (it is taken out of the scene: the shaders
// walk the list instead); false if the cube has as many as it can take. holder: what it hung on
// (it shines only while that shows: a portal's gate hidden once its face opens)
export function addBakedLight(bake, light, group, holder = group) {
  if (bake.lights.length >= MAX_BAKED) return false;
  group.updateWorldMatrix(true, true);
  const at = light.getWorldPosition(new THREE.Vector3());
  group.worldToLocal(at);
  bake.lights.push({ light, at, holder, channel: -1, twin: null });
  bake.cells = -1;   // (its cells are laid out again: lightCells)
  return true;
}

// which fixed lights each cell of the cube takes (core/lightcells.js), in its table by their place
// in the cube's list (the row each has in uBakeT)
function lightCells(bake) {
  const t = bake.u.uBakeC.value;
  t.image.data.set(cellsOf(bake.lights.map(s => ({ x: s.at.x, z: s.at.z, reach: s.light.distance || 6, intensity: s.light.intensity })),
    { cells: CELLS, from: CELL0, max: CELL_MAX }));
  t.needsUpdate = true;
  bake.cells = bake.lights.length;
}

// Whether the fixed lights' shadows are baked (render/quality.js: not in the simple look, where
// no cube is baked and every light shines without a shadow, the cube's fixed parts in three's
// shadow map of the sun like everything else)
let shadows = true;
export const shadowsBaked = () => shadows;
export function setShadowsBaked(on) { shadows = on; }
// whether a fixed light's holder shows (all the way up to its cube)
const shows = (s, group) => { for (let o = s.holder; o && o !== group; o = o.parent) if (!o.visible) return false; return s.light.visible; };

// The cube's solids drawn with their baked shadows (render/partmeshes.js): their lightmap's
// texels (attribute lm).
export function bakedSurface(mat, bake) {
  if (!bake) return mat;
  mat.defines = { ...mat.defines, BAKED_LM: '' };
  const compile = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    compile.call(mat, sh, r);
    sh.vertexShader = 'attribute vec2 lm;\nvarying vec2 vBakeLm;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBakeLm = lm;');
  };
  return mat;
}

// Everything a cube is built of shows its own cube's lights and shadows (also while travelling,
// when another cube is the one played in). Like render/fade.js: a cube's materials are its own.
export function bakeMaterials(group, bake) {
  group.traverse(o => {
    if (o.material) for (const m of [].concat(o.material)) {
      if (m.userData.bakeU) continue;
      m.userData.bakeU = bake.u;
      const compile = m.onBeforeCompile;
      m.onBeforeCompile = (sh, r) => {
        compile.call(m, sh, r);
        if ('uBakeOn' in sh.uniforms) Object.assign(sh.uniforms, bake.u);
      };
    }
  });
}

// the fixed parts stay out of three's shadow map of the sun: their shadows are baked
function outOfSun(mesh) {
  const own = Object.getPrototypeOf(mesh).intersectsFrustum;
  mesh.intersectsFrustum = function (f) { return (f !== sun.shadow._frustum || !shadows) && own.call(this, f); };
}
// what casts the baked shadows: the solids and the props that cast shadows (render/fade.js turns
// a faded cube's off: cast0 is what they do)
const isSolid = o => o.isMesh && !o.isInstancedMesh && (o.userData.part === 'terrain' || o.userData.part === 'stone' || o.userData.part === 'wood') && !o.userData.cap;
const isProp = o => o.isInstancedMesh && (o.userData.cast0 ?? o.castShadow) && o.userData.sharedGeo;
export function fixedParts(group) {
  const solids = [], props = [];
  group.traverse(o => { if (isSolid(o)) solids.push(o); else if (isProp(o)) props.push(o); });
  return { solids, props };
}
export function keepFixedOutOfSun(group) {
  const { solids, props } = fixedParts(group);
  for (const m of [...solids, ...props]) outOfSun(m);
}

// Per frame: the cubes' lights where the cubes are now, as bright as they shine now, and how far
// their bakes have come on.
export function updateBakes() {
  const now = performance.now();
  for (const b of live) updateBake(b, now);
}
const smooth = t => t * t * (3 - 2 * t);
function updateBake(bake, now) {
  const group = bake.group;
  group.getWorldPosition(bake.u.uBakeO.value);
  // (not baked: its lights shine without shadows, a failed bake, none at all for Flip's box, or
  // none in the simple look)
  const on = bake.ready ? smooth(Math.min(1, (now - bake.readyAt) / FADE_IN)) : 0;
  const plain = bake.failed || !shadows, lit = plain ? 1 : on;
  bake.u.uBakeR.value = plain ? 0 : on;
  if (bake.cells !== bake.lights.length) lightCells(bake);
  // every light keeps its row (the cells point at it); one dark, hidden or the cube faded out
  // reaches nothing
  const table = bake.u.uBakeT.value, L = table.image.data, fade = group.visible ? (group.userData.fade ?? 1) * lit : 0;
  bake.lights.forEach((s, i) => {
    const l = s.light, o = i * 8, k = l.intensity * fade, on = k > 0 && shows(s, group);
    L[o] = s.at.x; L[o + 1] = s.at.y; L[o + 2] = s.at.z; L[o + 3] = on ? l.distance || 1e3 : 0;
    L[o + 4] = l.color.r * k; L[o + 5] = l.color.g * k; L[o + 6] = l.color.b * k; L[o + 7] = bake.ready && !plain ? s.channel : -1;
  });
  const n = fade > 0 ? bake.lights.length : 0;
  if (n || bake.u.uBakeN.value) table.needsUpdate = true;
  bake.u.uBakeN.value = n;
}

// the cube being played in: its lights and shadows for everything not built with it
export function setCurrentBake(bake) {
  if (!bake) { BAKE.uBakeN.value = 0; BAKE.uBakeR.value = 0; return; }
  for (const k in bake.u) BAKE[k].value = bake.u[k].value;
}

// A cube's bake when it goes: kept a while (a cube built again takes it), else let go.
export function disposeBake(bake) {
  if (!bake) return;
  live.delete(bake);
  bake.job?.return();
  bake.job = null;
  if (bake.ready && !bake.failed && bake.owned) {
    kept.delete(bake.geo);
    kept.set(bake.geo, { sig: bake.sig, owned: bake.owned, channels: bake.lights.map(s => s.channel), u: bake.u });
    while (kept.size > CACHE) { const [g, k] = kept.entries().next().value; kept.delete(g); release(k.owned); }
  } else if (bake.owned) release(bake.owned);
  bake.u.uBakeT.value.dispose(); bake.u.uBakeC.value.dispose();
  bake.owned = null;
  bake.ready = false;
}
function release(owned) {
  for (const t of owned.targets) t.dispose();
  owned.sun?.shadow.dispose();
}

// ---- baking ----

// whether a cube's lights are baked (or never will be)
export const baked = world => !shadows || !world?.bake || world.bake.ready || world.bake.failed || world.bake.flip;

// Bake what is shown a little each frame: the cube played in first, then the others (a cube
// travelled into is the one played in from the start). Before drawing (main.js), after anything
// that builds the cube again. hidden: nothing shows (game/hud.js curtained): all at once.
export function tickBakes(current, hidden = false) {
  if (!shadows) return;
  const start = performance.now();
  const order = [current?.bake, ...live].filter((b, i, a) => b && a.indexOf(b) === i && !b.ready && !b.failed && !b.flip && b.group.parent);
  for (const bake of order) {
    if (!bake.job) {
      if (takeKept(bake)) continue;
      bake.job = bakeSteps(bake);
    }
    const saved = saveState();
    try {
      for (let steps = 0; hidden || steps < STEPS && (steps === 0 || performance.now() - start < BUDGET); steps++)
        if (bake.job.next().done) { bake.job = null; if (hidden) bake.readyAt = -Infinity; break; }   // (baked unseen: on at once)
    } catch (e) {
      console.error('bake failed', e);
      bake.failed = true; bake.job = null;
    } finally { restoreState(saved); }
    break;   // (one cube a frame)
  }
  // (the light's cube of shadow maps is only needed while baking)
  if (!order.some(b => b.job) && shared.light?.shadow.map) shared.light.shadow.dispose();
}

// what the cube looks like to its shadows: its lights and props (its solids are its geometry)
function signature(bake) {
  const { props } = fixedParts(bake.group), r = v => Math.round(v * 100);
  const lights = bake.lights.map(s => [r(s.at.x), r(s.at.y), r(s.at.z), r(s.light.distance)].join(',')).join(';');
  const things = props.map(p => { let h = 0; const a = p.instanceMatrix.array; for (let i = 12; i < a.length; i += 16) h += a[i] * 3 + a[i + 1] * 5 + a[i + 2] * 7; return p.name + ':' + p.count + ':' + r(h); }).join(';');
  return lights + '|' + things + '|' + sun.position.toArray().map(r).join(',');
}
// the bake the cube had when it was last built, if it looks the same
function takeKept(bake) {
  bake.sig = signature(bake);
  const k = kept.get(bake.geo);
  if (!k || k.sig !== bake.sig) return false;
  kept.delete(bake.geo);
  bake.owned = k.owned;
  bake.lights.forEach((s, i) => { s.channel = k.channels[i]; });
  for (const key in bake.u) if (!['uBakeR', 'uBakeN', 'uBakeT', 'uBakeC', 'uBakeO'].includes(key)) bake.u[key].value = k.u[key].value;
  bake.ready = true; bake.readyAt = -Infinity;
  return true;
}

function saveState() {
  const s = { target: renderer.getRenderTarget(), auto: renderer.autoClear, clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha() };
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  return s;
}
function restoreState(s) {
  renderer.setRenderTarget(s.target);
  renderer.autoClear = s.auto;
  renderer.setClearColor(s.clear, s.alpha);
}

// Lights whose reaches overlap get different channels: the brightest first, each the first
// channel none of its neighbours has. (Reaches overlap only where both are faint: beyond REACH of
// its reach a light gives less than a fortieth of what it gives at a unit.) A light left without
// one takes the shadow of one next to it (TWIN: the lanterns on a string), else none (-1).
// twin: the light whose shadow it shares (not baked itself).
const REACH = 0.85, TWIN = 1.2;
function assignChannels(lights) {
  const order = [...lights].sort((a, b) => b.light.intensity * b.light.distance ** 2 - a.light.intensity * a.light.distance ** 2);
  for (const s of order) { s.channel = -1; s.twin = null; }
  for (const s of order) {
    const taken = new Set();
    for (const t of order) if (t !== s && t.channel > 0 && !t.twin && t.at.distanceTo(s.at) < (s.light.distance + t.light.distance) * REACH) taken.add(t.channel);
    for (let c = 1; c <= CHANNELS; c++) if (!taken.has(c)) { s.channel = c; break; }
    if (s.channel > 0) continue;
    const near = order.filter(t => t.channel > 0 && !t.twin && t.at.distanceTo(s.at) < TWIN).sort((a, b) => a.at.distanceTo(s.at) - b.at.distanceTo(s.at))[0];
    if (near) { s.channel = near.channel; s.twin = near; }
  }
}

// a stand-in of a mesh (same geometry and material, where it is now) for the bake's own scenes
function standIn(o) {
  const m = o.isInstancedMesh ? new THREE.InstancedMesh(o.geometry, o.material, o.count) : new THREE.Mesh(o.geometry, o.material);
  if (o.isInstancedMesh) { m.instanceMatrix = o.instanceMatrix; m.count = o.count; m.computeBoundingSphere(); }
  m.matrixAutoUpdate = false; m.matrixWorldAutoUpdate = false;
  o.updateWorldMatrix(true, false);
  m.matrix.copy(o.matrixWorld); m.matrixWorld.copy(o.matrixWorld);
  m.castShadow = true;
  return m;
}

const VERT = `
attribute vec2 lm;
varying vec3 vW, vN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = vec4(lm * 2.0 - 1.0, 0.0, 1.0);
}`;
// a point's visibility: SUN from the sun's shadow map, else from the light's cube of shadow maps
const VISIBLE = `
uniform vec3 uLight, uSunDir;
uniform float uNear, uFar;
#ifdef SUN
  uniform highp sampler2DShadow uMap;
  uniform mat4 uMapM;
#else
  uniform highp samplerCubeShadow uMap;
#endif
float visibleAt(vec3 q, vec3 n, bool facing) {
  #ifdef SUN
    if (facing && dot(n, uSunDir) <= 0.0) return 0.0;
    vec4 c = uMapM * vec4(q + n * 0.02, 1.0);
    c.xyz /= c.w;
    if (any(lessThan(c.xyz, vec3(0.0))) || any(greaterThan(c.xyz, vec3(1.0)))) return 1.0;
    return texture(uMap, vec3(c.xy, c.z - 0.0003));
  #else
    vec3 L = q + n * 0.02 - uLight;
    if (facing && dot(n, L) >= 0.0) return 0.0;
    vec3 a = abs(L);
    float z = max(max(a.x, a.y), a.z);
    if (z < uNear) return 1.0;
    float dp = (uFar * (z - uNear)) / (z * (uFar - uNear));
    return texture(uMap, vec4(L, dp - 0.0005));
  #endif
}`;
// The lightmap of one light: each texel's signed distance (in texels, +-RANGE, 0.5 on the edge)
// to the nearest point on its plane the light reaches differently, from points a quarter texel
// apart round it; only where a coarse look round finds both. Written into its channel (MAX).
const RANGE = 1.5;
const FRAG = VISIBLE + `
uniform vec4 uMask;
uniform float uReach;
varying vec3 vW, vN;
void main() {
  vec3 n = normalize(vN), dx = dFdx(vW), dy = dFdy(vW);
  #ifndef SUN
    if (distance(vW, uLight) > uReach + 2.0 * length(dx) + 2.0 * length(dy)) discard;
  #endif
  float c = step(0.5, visibleAt(vW, n, true));
  bool both = false;
  for (int j = -2; j <= 2 && !both; j++) for (int i = -2; i <= 2; i++) {
    vec2 o = vec2(i, j) * ${(RANGE / 2).toFixed(3)};
    if (step(0.5, visibleAt(vW + dx * o.x + dy * o.y, n, true)) != c) { both = true; break; }
  }
  float d = ${RANGE.toFixed(3)};
  if (both) {
    for (int j = -6; j <= 6; j++) for (int i = -6; i <= 6; i++) {
      vec2 o = vec2(i, j) * 0.25;
      float l = length(o);
      if (l >= d + 0.125) continue;
      if (step(0.5, visibleAt(vW + dx * o.x + dy * o.y, n, true)) != c) d = l - 0.125;
    }
  }
  float s = clamp(0.5 + (c > 0.5 ? d : -d) / ${(2 * RANGE).toFixed(3)}, 0.0, 1.0);
  gl_FragColor = uMask * s;
}`;
// The volume: one slice of it, how much of the light reaches each voxel (four points in it)
const VOL_VERT = `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const VOL_FRAG = VISIBLE + `
uniform vec4 uMask;
uniform vec3 uV0, uVS, uO;
uniform float uZ, uReach, uStep;
varying vec2 vUv;
void main() {
  vec3 p = uV0 + vec3(vUv.x, uZ, vUv.y) * uVS + uO;
  if (distance(p, uLight) > uReach + uStep) discard;
  float v = 0.0;
  for (int k = 0; k < 4; k++) {
    vec3 o = (vec3(k & 1, (k >> 1) & 1, ((k + 1) >> 1) & 1) - 0.5) * 0.5 * uStep;
    v += visibleAt(p + o, vec3(0.0), false);
  }
  gl_FragColor = uMask * (v * 0.25);
}`;
// the lightmap's empty texels (round the charts) take the nearest charted one's values
const FILL_FRAG = `
uniform sampler2D uMap, uCover;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  if (texture2D(uCover, vUv).r > 0.5) { gl_FragColor = texture2D(uMap, vUv); return; }
  float best = 1e9;
  vec4 v = vec4(0.0);
  for (int j = -3; j <= 3; j++) for (int i = -3; i <= 3; i++) {
    vec2 q = vUv + vec2(i, j) * uTexel;
    float d = float(i * i + j * j);
    if (d < best && texture2D(uCover, q).r > 0.5) { best = d; v = texture2D(uMap, q); }
  }
  gl_FragColor = v;
}`;

const MAX_BLEND = { blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
  depthTest: false, depthWrite: false, side: THREE.DoubleSide };
const shared = {};
function materials() {
  if (shared.point) return shared;
  const u = () => ({ uLight: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3() }, uNear: { value: NEAR }, uFar: { value: 1 },
    uMap: { value: null }, uMapM: { value: new THREE.Matrix4() }, uMask: { value: new THREE.Vector4() }, uReach: { value: 1 } });
  shared.sun = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u(), defines: { SUN: '' }, ...MAX_BLEND });
  shared.point = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: u(), ...MAX_BLEND });
  shared.cover = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }', side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  shared.vol = new THREE.ShaderMaterial({ vertexShader: VOL_VERT, fragmentShader: VOL_FRAG,
    uniforms: { ...u(), uV0: { value: new THREE.Vector3() }, uVS: { value: new THREE.Vector3() }, uO: { value: new THREE.Vector3() }, uZ: { value: 0 }, uStep: { value: 1 / VOXEL } }, ...MAX_BLEND });
  shared.fill = new THREE.ShaderMaterial({ vertexShader: VOL_VERT, fragmentShader: FILL_FRAG,
    uniforms: { uMap: { value: null }, uCover: { value: null }, uTexel: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false });
  shared.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), shared.vol);
  shared.quad.frustumCulled = false;
  shared.quadScene = new THREE.Scene();
  shared.quadScene.add(shared.quad);
  shared.light = new THREE.PointLight(0xffffff, 1, 1, 2);
  shared.light.castShadow = true;
  shared.light.shadow.mapSize.set(CUBE_MAP, CUBE_MAP);
  shared.light.shadow.camera.near = NEAR;
  shared.light.shadow.bias = 0;
  shared.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // (three.js draws shadow maps only inside a render: one of nothing, the light alone in the
  // scene, into a texel nobody looks at)
  shared.nowhere = new THREE.OrthographicCamera(-1e-3, 1e-3, 1e-3, -1e-3, 1e6, 1e6 + 1e-3);
  shared.dummy = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false });
  return shared;
}
function shadowPass(light, casters) {
  casters.add(light);
  renderer.setRenderTarget(shared.dummy);
  renderer.render(casters, shared.nowhere);
  casters.remove(light);
}
const MASKS = [0, 1, 2, 3].map(i => new THREE.Vector4(...[0, 1, 2, 3].map(j => +(i === j))));

// The baking's programs compiled ahead (render/cubeassets.js warmCube), so the first cube baked
// does not wait for the driver.
let warmed = false;
export function warmBake() {
  if (warmed) return [];
  warmed = true;
  const S = materials(), g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setAttribute('lm', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  return [S.sun, S.point, S.cover, S.vol, S.fill].map(m => ({ object: new THREE.Mesh(g, m), material: m }));
}

// The steps of a bake (tickBakes runs them a few a frame): the sun, then each light.
function* bakeSteps(bake) {
  const S = materials(), group = bake.group, geo = bake.geo;
  if (!geo?.lightmap) { bake.failed = true; return; }
  group.updateWorldMatrix(true, true);
  const origin = group.getWorldPosition(new THREE.Vector3());
  const { solids, props } = fixedParts(group);
  if (!solids.length) { bake.failed = true; return; }
  // the scenes: what casts shadows, what is lightmapped
  const casters = new THREE.Scene(), lit = new THREE.Scene();
  for (const o of [...solids, ...props]) casters.add(standIn(o));
  for (const o of solids) { const m = standIn(o); m.frustumCulled = false; lit.add(m); }
  const { w, h } = geo.lightmap;
  const target = () => {
    const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
    renderer.setRenderTarget(t); renderer.clear(); return t;
  };
  const owned = { targets: [], sun: null }, temp = [];
  let done = false;
  try {
    const lm = Array.from({ length: SETS }, target), cover = target();
    temp.push(...lm, cover);
    renderer.setRenderTarget(cover);
    lit.overrideMaterial = S.cover;
    renderer.render(lit, S.camera);
    // the volume round the cube
    const b = geo.bounds, v0 = bake.u.uBakeV0.value, vs = bake.u.uBakeVS.value;
    v0.set(-1, b[1] - 1, -1);
    vs.set(b[3] + 1 - -1, b[4] + 2 - (b[1] - 1), b[5] + 1 - -1);
    const VX = Math.ceil(vs.x * VOXEL), VY = Math.ceil(vs.y * VOXEL), VZ = Math.ceil(vs.z * VOXEL);
    const volume = () => {
      const t = new THREE.WebGL3DRenderTarget(VX, VZ, VY, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
      t.texture.wrapR = t.texture.wrapS = t.texture.wrapT = THREE.ClampToEdgeWrapping;
      for (let z = 0; z < VY; z++) { renderer.setRenderTarget(t, z); renderer.clear(); }
      return t;
    };
    const vol = Array.from({ length: SETS }, volume);
    owned.targets.push(...vol);
    yield;

    // the sun: its shadow map of the fixed parts (16-bit depth, its colour let go), kept for
    // what is not lightmapped
    const sunDir = sun.position.clone().sub(sun.target.position).normalize();
    const centre = new THREE.Vector3((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2).add(origin);
    const radius = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) / 2 + 1;
    const bakeSun = owned.sun = new THREE.DirectionalLight(0xffffff, 1);
    bakeSun.castShadow = true;
    bakeSun.position.copy(centre).addScaledVector(sunDir, radius + 5);
    bakeSun.target.position.copy(centre);
    bakeSun.updateMatrixWorld(); bakeSun.target.updateMatrixWorld();
    Object.assign(bakeSun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: radius * 2 + 10 });
    bakeSun.shadow.camera.updateProjectionMatrix();
    bakeSun.shadow.mapSize.set(SUN_MAP, SUN_MAP);
    const map = bakeSun.shadow.map = new THREE.WebGLRenderTarget(SUN_MAP, SUN_MAP, { depthBuffer: true });
    map.depthTexture = new THREE.DepthTexture(SUN_MAP, SUN_MAP, THREE.UnsignedShortType);
    Object.assign(map.depthTexture, { format: THREE.DepthFormat, compareFunction: THREE.LessEqualCompare, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    shadowPass(bakeSun, casters);
    map.texture.dispose();
    // (the map's matrix takes world points; the shaders give points in the cube)
    const sunM = new THREE.Matrix4().copy(bakeSun.shadow.matrix).multiply(new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z));
    const su = S.sun.uniforms;
    su.uMap.value = map.depthTexture; su.uMapM.value.copy(bakeSun.shadow.matrix); su.uSunDir.value.copy(sunDir);
    su.uMask.value.copy(MASKS[0]);
    renderer.setRenderTarget(lm[0]);
    lit.overrideMaterial = S.sun;
    renderer.render(lit, S.camera);
    yield;

    // the lights, one a step
    assignChannels(bake.lights);
    const pu = S.point.uniforms, vu = S.vol.uniforms;
    for (const s of bake.lights) {
      if (s.channel < 0 || s.twin) continue;
      const at = s.at.clone().add(origin), reach = s.light.distance || 6;
      S.light.position.copy(at); S.light.distance = reach; S.light.updateMatrixWorld();
      shadowPass(S.light, casters);
      const cube = S.light.shadow.map.depthTexture, mask = MASKS[s.channel % 4], set = s.channel >> 2;
      for (const U of [pu, vu]) {
        U.uMap.value = cube; U.uLight.value.copy(at); U.uNear.value = NEAR; U.uFar.value = reach; U.uReach.value = reach; U.uMask.value.copy(mask);
      }
      renderer.setRenderTarget(lm[set]);
      lit.overrideMaterial = S.point;
      renderer.render(lit, S.camera);
      // the slices of the volume it reaches
      vu.uV0.value.copy(v0); vu.uVS.value.copy(vs); vu.uO.value.copy(origin);
      S.quad.material = S.vol;
      const y0 = Math.max(0, Math.floor((s.at.y - reach - v0.y) * VOXEL)), y1 = Math.min(VY - 1, Math.ceil((s.at.y + reach - v0.y) * VOXEL));
      for (let z = y0; z <= y1; z++) {
        vu.uZ.value = (z + 0.5) / VY;
        renderer.setRenderTarget(vol[set], z);
        renderer.render(S.quadScene, S.camera);
      }
      yield;
    }

    // the charts' edges filled outwards, into the textures kept
    const filled = lm.map(src => {
      const t = target();
      S.fill.uniforms.uMap.value = src.texture; S.fill.uniforms.uCover.value = cover.texture; S.fill.uniforms.uTexel.value.set(1 / w, 1 / h);
      S.quad.material = S.fill;
      renderer.setRenderTarget(t);
      renderer.render(S.quadScene, S.camera);
      return t;
    });
    owned.targets.push(...filled);
    filled.forEach((t, i) => { bake.u['uBakeLm' + i].value = t.texture; });
    vol.forEach((t, i) => { bake.u['uBakeVol' + i].value = t.texture; });
    bake.u.uBakeSun.value = map.depthTexture;
    bake.u.uBakeSunM.value.copy(sunM);
    bake.owned = owned;
    bake.ready = true; bake.readyAt = performance.now();
    done = true;
  } finally {
    lit.overrideMaterial = null;
    for (const t of temp) t.dispose();
    if (!done) release(owned);   // (given up: the cube went before it was baked)
  }
}

// dev: a bake's lightmap (0..SETS-1) as a PNG data URL, one channel (0-3) as grey
export function lightmapImage(bake, which = 0, channel = 0) {
  const t = bake.owned.targets.find(r => r.texture === bake.u['uBakeLm' + which].value);
  const { width: w, height: h } = t;
  const px = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(t, 0, 0, w, h, px);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((h - 1 - y) * w + x) * 4, o = (y * w + x) * 4, v = px[i + channel];
    img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}
