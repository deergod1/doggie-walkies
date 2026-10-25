// The lights in every lit shader (render/bake.js bakes the fixed ones' shadows). three.js
// recompiles every lit shader when its number of point lights changes, so the game's lights are
// instead tables (float textures) every lit shader walks, all of them always on, however far away:
//   - the moving ones (render/lightpool.js: shots, enemies, loot, villagers' lamps), without
//     shadows, where they are in the world;
//   - the cube's fixed ones (lanterns, fires, lava, portals), each with its baked shadow: on the
//     cube's solids from their lightmap (crisp at any zoom: signed distances to the shadow's edge,
//     antialiased over a pixel), on everything else (props, figures, fluids) from a volume of the
//     light's visibility round the cube (soft).
// The sun's shadow of the cube's fixed parts is baked too (render/bake.js); three.js's own shadow
// map of the sun then only holds what moves.
//
// Every lit material takes part without being told: this module wraps Material.onBeforeCompile
// (whatever a material sets, three.js calls the wrapper), so it must be imported before any
// material sets its own (main.js imports it first). Only the game's renderer (bakeRenderer,
// render/scene.js) draws with the edit: the others (the item pictures, the skin painter) never
// turn the lights on, and their programs, compiled in a context of their own that nothing
// warms, would be the big ones for nothing. The edit is the same for every material and
// steered by uniforms and defines, so no program's cache key changes (and each renderer keeps
// its own programs):
//   - BAKED_LM (render/bake.js bakedSurface): the cube's solids, lightmapped (attribute `lm`)
//   - NO_BAKE: none of it (the proxies of the surroundings, render/neighbors.js)
// A material that brings uniforms of the same names keeps its own: what a cube is built of shows
// its own cube's lights (render/bake.js bakeMaterials), also while another cube is the one played
// in; everything else (the hero, enemies, loot) the cube played in.
import * as THREE from 'three';

// learn: light.html#kinds (see learn/README.md)
export const MAX_BAKED = 128;  // fixed lights a cube gives off at most
// learn: light.html#kinds (see learn/README.md)
export const MAX_MOVING = 64;  // moving lights shining at once at most (render/lightpool.js)
// learn: light.html#pots (see learn/README.md)
export const SETS = 3;         // the lightmap's (and volume's) textures, four channels each: the sun's and eleven for lights
// The fixed lights a point walks are its cell's (render/bake.js lightCells): the cube's ground in
// cells of a unit (CELLS a side from CELL0, a little round the cube), each with the lights that
// reach it, the strongest first, CELL_MAX at most (uBakeK: how many of them a point takes, fewer
// on the lower quality levels, eased between them). A dark forest's cube has 40-50 lights, a point is reached by a dozen.
// learn: light.html#cells (see learn/README.md)
export const CELLS = 20, CELL0 = -2, CELL_MAX = 16;

// a table of lights: two texels a light (x, y, z, reach; r, g, b, channel)
export function lightTable(n) {
  const t = new THREE.DataTexture(new Float32Array(n * 8), 2, n, THREE.RGBAFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// uBakeSun before a cube's sun is baked (and where it never is): never sampled then (uBakeR is
// 0), but a shadow sampler must always have a depth texture that compares, or WebGL drops the
// draw (three's own fallback for an empty shadow sampler is never uploaded). needsUpdate: every
// renderer (the item pictures have their own) makes its own.
export const NO_SUN = new THREE.DepthTexture(1, 1);
NO_SUN.compareFunction = THREE.LessEqualCompare;
NO_SUN.needsUpdate = true;

// the volume where there is none (not baked yet, or baked without one: render/bake.js): every
// light reaches everywhere. (A 2D atlas of slices: render/bake.js; uBakeVD says how it is laid out.)
export const NO_VOL = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
NO_VOL.needsUpdate = true;

// the shared uniforms: the bake of the cube being played in (render/bake.js setCurrentBake)
export const BAKE = {
  uBakeOn: { value: 0 },                       // 1 while the world's scene is drawn
  uBakeR: { value: 0 },                        // how far its baked shadows are trusted (0 before they are baked, fading to 1)
  uBakeN: { value: 0 },                        // how many fixed lights
  uBakeT: { value: null },                     // their table (x, y, z in the cube)
  uBakeC: { value: null },                     // the lights each cell of the cube takes (render/bake.js lightCells)
  uBakeK: { value: CELL_MAX },                 // how many of them a point walks at most, eased (game/quality.js)
  uBakeO: { value: new THREE.Vector3() },      // the cube's origin in the world
  ...Object.fromEntries(Array.from({ length: SETS }, (_, i) => [['uBakeLm' + i, { value: null }], ['uBakeVol' + i, { value: NO_VOL }]]).flat()),
  uBakeV0: { value: new THREE.Vector3() }, uBakeVS: { value: new THREE.Vector3(1, 1, 1) },   // the volume's corner and size (in the cube)
  uBakeVD: { value: new THREE.Vector4(1, 1, 1, 1) },   // its samples across, up (slices), deep, and slices a row of its atlas
  uBakeSun: { value: NO_SUN },                 // the sun's shadow map of the cube's fixed parts
  uBakeSunM: { value: new THREE.Matrix4() },   // from the cube's coordinates into it
  uMoveN: { value: 0 },                        // how many moving lights
  uMoveT: { value: lightTable(MAX_MOVING) },   // their table (x, y, z in the world; channel unused)
  uBakeDbg: { value: 0 },                      // dev (/lightview): 1 the sun's baked shadow, 2 the fixed lights' light, 3 the lightmap's texels
};

// the scene's lights on, only while the world's scene is drawn (not the main menu's portrait,
// which the game's renderer draws too)
const baking = new WeakSet();   // the renderers whose programs take the edit
export const bakeRenderer = renderer => { baking.add(renderer); };
export function bakeScene(scene) {
  scene.onBeforeRender = () => { BAKE.uBakeOn.value = 1; };
  scene.onAfterRender = () => { BAKE.uBakeOn.value = 0; };
}

const sets = f => Array.from({ length: SETS }, (_, i) => f(i)).join('');
const HEAD = `
#ifndef NO_BAKE
uniform float uBakeOn, uBakeR, uBakeDbg, uBakeK;
uniform int uBakeN, uMoveN;
uniform highp sampler2D uBakeT, uMoveT, uBakeC;
uniform vec3 uBakeO;
#ifdef BAKED_LM
  varying vec2 vBakeLm;
  ${sets(i => `uniform sampler2D uBakeLm${i};\n`)}
#else
  ${sets(i => `uniform sampler2D uBakeVol${i};\n`)}
  uniform vec3 uBakeV0, uBakeVS;
  uniform vec4 uBakeVD;
  uniform highp sampler2DShadow uBakeSun;
  uniform mat4 uBakeSunM;
#endif
float bakeFalloff(float d, float reach) {
  return 1.0 / max(d * d, 0.01) * pow2(saturate(1.0 - pow4(d / reach)));
}
#endif
`;

// before the lights: where the point is (in the world: bakeW, in the cube: bakeP), the
// visibility of the sun (bakeSun) and of the fixed lights' channels (bake0..: four each; channel
// 0 is the sun's in the lightmap)
// learn: light.html#edge-code #sharp (see learn/README.md)
const VIS = `
#ifndef NO_BAKE
  float bakeSun = 1.0;
  ${sets(i => `vec4 bake${i} = vec4(1.0);\n`)}
  vec3 bakeW = ((vec4(-vViewPosition, 1.0) - viewMatrix[3]) * viewMatrix).xyz, bakeP = bakeW - uBakeO;
  #ifdef BAKED_LM
    {
      // signed distances to the shadows' edges, 0.5 on the edge: one pixel wide whatever the zoom
      // (none while there are no baked shadows: not yet baked, or the bake failed)
      if (uBakeOn > 0.5 && uBakeR > 0.0) {
        ${sets(i => `vec4 s${i} = texture(uBakeLm${i}, vBakeLm), v${i} = clamp((s${i} - 0.5) / max(fwidth(s${i}), vec4(1e-4)) + 0.5, 0.0, 1.0);\n`)}
        ${sets(i => `bake${i} = mix(vec4(1.0), v${i}, uBakeR);\n`)}
        bakeSun = bake0.r;
      }
    }
  #else
    if (uBakeR > 0.0 && uBakeOn > 0.5) {
      vec3 bakeN = inverseTransformDirection(normal, viewMatrix);
      vec3 vc = (bakeP + bakeN * 0.15 - uBakeV0) / uBakeVS;
      bool inside = all(greaterThanEqual(vc, vec3(0.0))) && all(lessThanEqual(vc, vec3(1.0)));
      // (its slices go up, side by side in the atlas: the two round the point, each read off
      // its tile's edge, then blended)
      float vz = clamp(vc.y * uBakeVD.y - 0.5, 0.0, uBakeVD.y - 1.0), vz0 = floor(vz), vz1 = min(vz0 + 1.0, uBakeVD.y - 1.0);
      vec2 vtile = clamp(vc.xz * uBakeVD.xz, vec2(0.5), uBakeVD.xz - 0.5);
      vec2 vatlas = vec2(uBakeVD.w, ceil(uBakeVD.y / uBakeVD.w)) * uBakeVD.xz;
      vec2 vt0 = (vec2(mod(vz0, uBakeVD.w), floor(vz0 / uBakeVD.w)) * uBakeVD.xz + vtile) / vatlas;
      vec2 vt1 = (vec2(mod(vz1, uBakeVD.w), floor(vz1 / uBakeVD.w)) * uBakeVD.xz + vtile) / vatlas;
      ${sets(i => `bake${i} = mix(vec4(1.0), inside ? mix(texture(uBakeVol${i}, vt0), texture(uBakeVol${i}, vt1), vz - vz0) : vec4(0.0), uBakeR);\n`)}
      vec4 sc = uBakeSunM * vec4(bakeP + bakeN * 0.03, 1.0);
      sc.xyz /= sc.w;
      if (all(greaterThan(sc.xyz, vec3(0.0))) && all(lessThan(sc.xyz, vec3(1.0)))) bakeSun = mix(1.0, texture(uBakeSun, vec3(sc.xy, sc.z - 0.0004)), uBakeR);
    }
  #endif
#endif
`;

// after three's lights: the moving ones, then the fixed ones
const LOOP = `
#if !defined( NO_BAKE )
  vec3 bakeDbgL = vec3(0.0);
#endif
#if defined( RE_Direct ) && !defined( NO_BAKE )
  if (uBakeOn > 0.5) {
    for (int i = 0; i < ${MAX_MOVING}; i++) {
      if (i >= uMoveN) break;
      vec4 la = texelFetch(uMoveT, ivec2(0, i), 0);
      vec3 lw = la.xyz - bakeW;
      float d2 = dot(lw, lw);
      if (d2 >= la.w * la.w) continue;
      vec4 lb = texelFetch(uMoveT, ivec2(1, i), 0);
      float d = sqrt(d2);
      directLight.direction = normalize((viewMatrix * vec4(lw, 0.0)).xyz);
      directLight.color = lb.rgb * bakeFalloff(d, la.w);
      directLight.visible = true;
      RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
    }
    // the fixed lights of the point's cell (four indices a texel, -1: no more)
    ivec2 bakeCell = clamp(ivec2(floor(bakeP.xz)) - ${CELL0}, ivec2(0), ivec2(${CELLS - 1}));
    int bakeRow = bakeCell.y * ${CELLS} + bakeCell.x;
    bool bakeDone = uBakeN == 0;
    for (int j = 0; j < ${CELL_MAX / 4}; j++) {
      if (bakeDone || float(j * 4) >= uBakeK) break;
      vec4 ids = texelFetch(uBakeC, ivec2(j, bakeRow), 0);
      ${['x', 'y', 'z', 'w'].map((c, k) => `{
        int i = int(ids.${c});
        // (the last light a point takes fades in and out as uBakeK eases between levels)
        float kw = clamp(uBakeK - float(j * 4 + ${k}), 0.0, 1.0);
        if (i < 0 || kw <= 0.0) bakeDone = true;
        else {
          vec4 la = texelFetch(uBakeT, ivec2(0, i), 0);
          vec3 lw = la.xyz - bakeP;
          float d2 = dot(lw, lw);
          if (d2 < la.w * la.w) {
            vec4 lb = texelFetch(uBakeT, ivec2(1, i), 0);
            float d = sqrt(d2);
            int ch = int(floor(lb.w + 0.5));
            float vis = ch < 0 ? 1.0 : ${Array.from({ length: SETS - 1 }, (_, i) => `ch < ${4 * (i + 1)} ? bake${i}[ch - ${4 * i}] : `).join('')}bake${SETS - 1}[ch - ${4 * (SETS - 1)}];
            directLight.direction = normalize((viewMatrix * vec4(lw, 0.0)).xyz);
            directLight.color = lb.rgb * (bakeFalloff(d, la.w) * vis * kw);
            directLight.visible = true;
            bakeDbgL += directLight.color * saturate(dot(geometryNormal, directLight.direction));
            RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
          }
        }
        if (bakeDone) break;
      }`).join('\n      ')}
    }
  }
#endif
`;

// three's lights, the sun (the scene's one directional light) dimmed by its baked shadow
const DIRECTIONAL = 'getDirectionalLightInfo( directionalLight, directLight );';
const BEGIN = THREE.ShaderChunk.lights_fragment_begin.replace(DIRECTIONAL, DIRECTIONAL + `
		#ifndef NO_BAKE
		directLight.color *= bakeSun;
		#endif`);
if (BEGIN === THREE.ShaderChunk.lights_fragment_begin) throw Error('lighthook: three.js lights changed');

function edit(sh) {
  const f = sh.fragmentShader;
  if (!f.includes('#include <lights_fragment_begin>') || f.includes('uBakeOn')) return;
  for (const k in BAKE) if (!(k in sh.uniforms)) sh.uniforms[k] = BAKE[k];
  sh.fragmentShader = f.replace('void main()', HEAD + 'void main()')
    .replace('#include <lights_fragment_begin>', VIS + BEGIN + LOOP)
    .replace('#include <dithering_fragment>', `#include <dithering_fragment>
      #ifndef NO_BAKE
        if (uBakeDbg > 0.5) gl_FragColor = vec4(uBakeDbg < 1.5 ? vec3(bakeSun) : uBakeDbg < 2.5 ? bakeDbgL * 0.3 : vec3(0.0), 1.0);
        #ifdef BAKED_LM
          if (uBakeDbg > 2.5) gl_FragColor = vec4(fract(vBakeLm * 32.0), uBakeR, 1.0);
        #endif
      #endif`);
}

// Material.prototype.onBeforeCompile: what a material sets is kept and called first, then edit;
// its text stays what three.js keys programs by (customProgramCacheKey)
const OWN = Symbol('onBeforeCompile'), WRAPPED = Symbol('wrapped');
const plain = THREE.Material.prototype.onBeforeCompile;
Object.defineProperty(THREE.Material.prototype, 'onBeforeCompile', {
  configurable: true,
  get() {
    const own = this[OWN] ?? plain;
    let w = this[WRAPPED];
    if (!w || w.own !== own) {
      w = function (sh, r) { own.call(this, sh, r); if (baking.has(r)) edit(sh); };
      w.own = own;
      w.toString = () => own.toString();
      this[WRAPPED] = w;
    }
    return w;
  },
  set(fn) { this[OWN] = fn; },
});
