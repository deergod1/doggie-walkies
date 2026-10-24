// The fixed lights of a cube and their baked shadows (the shaders' side: render/lighthook.js).
//
// A cube's fixed lights (lanterns, fires, lava, portals: what render/lightpool.js adoptLights
// finds in it that does not move) all shine all the time, each with its shadow, baked once when
// the cube is entered:
//   - the lightmap (two RGBA8 atlases laid out in the worker, render/lightmap.js): for the sun
//     and seven channels of lights, the signed distance of each texel of the cube's solids to the
//     shadow's edge, found by testing points round it against the light's shadow map. Drawn,
//     it gives shadow edges as sharp as a pixel, smooth, however close the camera comes.
//   - the volume (two RGBA8 3D textures, VOXEL a unit): how much of each light reaches each
//     point round the cube, for what is not lightmapped (props, figures, fluids).
//   - the sun's shadow map of the fixed parts (for what is not lightmapped too).
// Lights whose reaches overlap get different channels (assignChannels). What the shadows are cast
// by: the cube's solids and its fixed props.
import * as THREE from 'three';
import { renderer, sun } from './scene.js';
import { BAKE, MAX_BAKED } from './lighthook.js';

const SUN_MAP = 2048;           // texels a side of the sun's shadow map of the fixed parts
const CUBE_MAP = 1024;          // texels a side of each light's cube of shadow maps (while baking)
const NEAR = 0.3;               // a light's shadow starts this far from it (not its own lamp's frame)
const VOXEL = 4;                // volume samples a world unit
const CHANNELS = 7;             // channels for lights (the lightmap's first is the sun's)

// the bakes of the cubes built (their lights follow them every frame: updateBakes)
const live = new Set();

// A new cube's bake: its uniforms exist (and its lights shine, without shadows) before it is baked.
// group: the cube's (render/world.js); flip: Flip's turning box, not baked (its lights are moving ones)
export function newBake(geo, group, flip = false) {
  const bake = {
    geo, group, flip, lights: [], ready: false, failed: false, textures: [],
    u: {
      uBakeR: { value: 0 }, uBakeN: { value: 0 }, uBakeL: { value: new Float32Array(MAX_BAKED * 8) },
      uBakeO: { value: new THREE.Vector3() }, uBakeLmA: { value: null }, uBakeLmB: { value: null },
    },
    vol: { a: null, b: null, v0: new THREE.Vector3(), vs: new THREE.Vector3(1, 1, 1) },
    sun: null, sunM: new THREE.Matrix4(),
  };
  live.add(bake);
  return bake;
}

// a fixed light of the cube: where it is in the cube (it is taken out of the scene: the shaders
// walk the list instead); false if the cube has as many as it can take
export function addBakedLight(bake, light, group) {
  if (bake.lights.length >= MAX_BAKED) return false;
  group.updateWorldMatrix(true, true);
  const at = light.getWorldPosition(new THREE.Vector3());
  group.worldToLocal(at);
  bake.lights.push({ light, at, channel: -1, twin: null });
  return true;
}

// The cube's solids drawn with their baked shadows (render/partmeshes.js): their lightmap's
// texels (attribute lm) and their own cube's lights, also while another cube is played in.
export function bakedSurface(mat, bake) {
  if (!bake) return mat;
  mat.defines = { ...mat.defines, BAKED_LM: '' };
  const compile = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    compile.call(mat, sh, r);
    Object.assign(sh.uniforms, bake.u);
    sh.vertexShader = 'attribute vec2 lm;\nvarying vec2 vBakeLm;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vBakeLm = lm;');
  };
  return mat;
}

// the fixed parts stay out of three's shadow map of the sun: their shadows are baked
function outOfSun(mesh) {
  const own = Object.getPrototypeOf(mesh).intersectsFrustum;
  mesh.intersectsFrustum = function (f) { return f !== sun.shadow._frustum && own.call(this, f); };
}
// what casts the baked shadows: the solids and the props that cast shadows
const isSolid = o => o.isMesh && !o.isInstancedMesh && (o.userData.part === 'terrain' || o.userData.part === 'stone' || o.userData.part === 'wood') && !o.userData.cap;
const isProp = o => o.isInstancedMesh && o.castShadow && o.userData.sharedGeo;
export function fixedParts(group) {
  const solids = [], props = [];
  group.traverse(o => { if (isSolid(o)) solids.push(o); else if (isProp(o)) props.push(o); });
  return { solids, props };
}
export function keepFixedOutOfSun(group) {
  const { solids, props } = fixedParts(group);
  for (const m of [...solids, ...props]) outOfSun(m);
}

// Per frame: the cubes' lights where the cubes are now, as bright as they shine now.
export function updateBakes() { for (const b of live) updateBake(b, b.group); }
function updateBake(bake, group) {
  group.getWorldPosition(bake.u.uBakeO.value);
  const L = bake.u.uBakeL.value, fade = group.userData.fade ?? 1;
  let n = 0;
  if (group.visible) for (const s of bake.lights) {
    const l = s.light, o = n * 8, k = l.intensity * fade;
    if (k <= 0) continue;
    L[o] = s.at.x; L[o + 1] = s.at.y; L[o + 2] = s.at.z; L[o + 3] = l.distance || 1e3;
    L[o + 4] = l.color.r * k; L[o + 5] = l.color.g * k; L[o + 6] = l.color.b * k; L[o + 7] = bake.ready ? s.channel : -1;
    n++;
  }
  bake.u.uBakeN.value = n;
}

// the cube being played in: its lights and shadows for everything not lightmapped
export function setCurrentBake(bake) {
  if (!bake) { BAKE.uBakeN.value = 0; BAKE.uBakeR.value = 0; return; }
  BAKE.uBakeN.value = bake.u.uBakeN.value;
  BAKE.uBakeL.value = bake.u.uBakeL.value;
  BAKE.uBakeO.value = bake.u.uBakeO.value;
  BAKE.uBakeR.value = bake.ready ? 1 : 0;
  BAKE.uBakeVolA.value = bake.vol.a?.texture ?? null;
  BAKE.uBakeVolB.value = bake.vol.b?.texture ?? null;
  BAKE.uBakeV0.value = bake.vol.v0; BAKE.uBakeVS.value = bake.vol.vs;
  BAKE.uBakeSun.value = bake.sun?.shadow.map?.depthTexture ?? null;
  BAKE.uBakeSunM.value = bake.sunM;
}

export function disposeBake(bake) {
  if (!bake) return;
  live.delete(bake);
  for (const t of bake.textures) t.dispose();
  bake.textures = [];
  bake.sun?.shadow.dispose();
  bake.ready = false;
}

// ---- baking ----

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
  const S = shared;
  casters.add(light);
  renderer.setRenderTarget(S.dummy);
  renderer.render(casters, S.nowhere);
  casters.remove(light);
}
const MASKS = [0, 1, 2, 3].map(i => new THREE.Vector4(...[0, 1, 2, 3].map(j => +(i === j))));

// Bake the cube's shadows (world: render/world.js's, with its bake). Synchronous: a few tens of
// milliseconds on a desktop GPU.
export function bakeWorld(world) {
  const bake = world.bake, geo = bake?.geo;
  if (!bake || bake.ready || bake.failed || bake.flip || !geo?.lightmap) return;
  const t0 = performance.now();
  const S = materials(), group = world.group;
  group.updateWorldMatrix(true, true);
  const origin = group.getWorldPosition(new THREE.Vector3());
  const { solids, props } = fixedParts(group);
  if (!solids.length) { bake.failed = true; return; }
  // the scenes: what casts shadows, what is lightmapped
  const casters = new THREE.Scene(), lit = new THREE.Scene();
  for (const o of [...solids, ...props]) casters.add(standIn(o));
  for (const o of solids) { const m = standIn(o); m.frustumCulled = false; lit.add(m); }

  const prevTarget = renderer.getRenderTarget(), prevAuto = renderer.autoClear, prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  const prevShadowAuto = renderer.shadowMap.autoUpdate;
  renderer.autoClear = false; renderer.shadowMap.autoUpdate = true;
  renderer.setClearColor(0x000000, 0);
  try {
    const { w, h } = geo.lightmap;
    const target = () => {
      const t = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
      renderer.setRenderTarget(t); renderer.clear(); return t;
    };
    const lmA = target(), lmB = target(), cover = target();
    renderer.setRenderTarget(cover);
    lit.overrideMaterial = S.cover;
    renderer.render(lit, S.camera);
    // the volume round the cube
    const b = geo.bounds;
    bake.vol.v0.set(-1, b[1] - 1, -1);
    bake.vol.vs.set(b[3] + 1 - -1, b[4] + 2 - (b[1] - 1), b[5] + 1 - -1);
    const VX = Math.ceil(bake.vol.vs.x * VOXEL), VY = Math.ceil(bake.vol.vs.y * VOXEL), VZ = Math.ceil(bake.vol.vs.z * VOXEL);
    const volume = () => {
      const t = new THREE.WebGL3DRenderTarget(VX, VZ, VY, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
      t.texture.wrapR = t.texture.wrapS = t.texture.wrapT = THREE.ClampToEdgeWrapping;
      for (let z = 0; z < VY; z++) { renderer.setRenderTarget(t, z); renderer.clear(); }
      return t;
    };
    const volA = volume(), volB = volume();

    // the sun: its shadow map of the fixed parts, kept for what is not lightmapped
    const sunDir = sun.position.clone().sub(sun.target.position).normalize();
    const centre = new THREE.Vector3((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2).add(origin);
    const radius = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]) / 2 + 1;
    const bakeSun = new THREE.DirectionalLight(0xffffff, 1);
    bakeSun.castShadow = true;
    bakeSun.position.copy(centre).addScaledVector(sunDir, radius + 5);
    bakeSun.target.position.copy(centre);
    bakeSun.updateMatrixWorld(); bakeSun.target.updateMatrixWorld();
    Object.assign(bakeSun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: 1, far: radius * 2 + 10 });
    bakeSun.shadow.camera.updateProjectionMatrix();
    bakeSun.shadow.mapSize.set(SUN_MAP, SUN_MAP);
    shadowPass(bakeSun, casters);
    bake.sun = bakeSun;
    // (the map's matrix takes world points; the shaders give points in the cube)
    bake.sunM.copy(bakeSun.shadow.matrix).multiply(new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z));
    const su = S.sun.uniforms;
    su.uMap.value = bakeSun.shadow.map.depthTexture; su.uMapM.value.copy(bakeSun.shadow.matrix); su.uSunDir.value.copy(sunDir);
    su.uMask.value.copy(MASKS[0]);
    renderer.setRenderTarget(lmA);
    lit.overrideMaterial = S.sun;
    renderer.render(lit, S.camera);

    // the lights, one after the other
    assignChannels(bake.lights);
    const pu = S.point.uniforms, vu = S.vol.uniforms;
    for (const s of bake.lights) {
      if (s.channel < 0 || s.twin) continue;
      const at = s.at.clone().add(origin), reach = s.light.distance || 6;
      S.light.position.copy(at); S.light.distance = reach; S.light.updateMatrixWorld();
      shadowPass(S.light, casters);
      const map = S.light.shadow.map.depthTexture, mask = MASKS[s.channel % 4];
      const lmT = s.channel < 4 ? lmA : lmB, volT = s.channel < 4 ? volA : volB;
      for (const U of [pu, vu]) {
        U.uMap.value = map; U.uLight.value.copy(at); U.uNear.value = NEAR; U.uFar.value = reach; U.uReach.value = reach; U.uMask.value.copy(mask);
      }
      renderer.setRenderTarget(lmT);
      lit.overrideMaterial = S.point;
      renderer.render(lit, S.camera);
      // the slices of the volume it reaches
      vu.uV0.value.copy(bake.vol.v0); vu.uVS.value.copy(bake.vol.vs); vu.uO.value.copy(origin);
      S.quad.material = S.vol;
      const y0 = Math.max(0, Math.floor((s.at.y - reach - bake.vol.v0.y) * VOXEL)), y1 = Math.min(VY - 1, Math.ceil((s.at.y + reach - bake.vol.v0.y) * VOXEL));
      for (let z = y0; z <= y1; z++) {
        vu.uZ.value = (z + 0.5) / VY;
        renderer.setRenderTarget(volT, z);
        renderer.render(S.quadScene, S.camera);
      }
    }

    // the charts' edges filled outwards, into the textures kept
    const fill = src => {
      const t = target();
      S.fill.uniforms.uMap.value = src.texture; S.fill.uniforms.uCover.value = cover.texture; S.fill.uniforms.uTexel.value.set(1 / w, 1 / h);
      S.quad.material = S.fill;
      renderer.setRenderTarget(t);
      renderer.render(S.quadScene, S.camera);
      return t;
    };
    const A = fill(lmA), B = fill(lmB);
    lmA.dispose(); lmB.dispose(); cover.dispose();
    bake.textures.push(A, B, volA, volB);
    bake.u.uBakeLmA.value = A.texture; bake.u.uBakeLmB.value = B.texture;
    bake.vol.a = volA; bake.vol.b = volB;
    bake.ready = true;
    bake.u.uBakeR.value = 1;
    bake.ms = performance.now() - t0;
  } catch (e) {
    console.error('bake failed', e);
    bake.failed = true;
  } finally {
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAuto; renderer.shadowMap.autoUpdate = prevShadowAuto;
    renderer.setClearColor(prevClear, prevAlpha);
    lit.overrideMaterial = null;
  }
}

// dev: a bake's lightmap (0: A, 1: B) as a PNG data URL, one channel (0-3) as grey
export function lightmapImage(bake, which = 0, channel = 0) {
  const t = bake.textures[which];
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
