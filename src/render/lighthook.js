// The lights in every lit shader (render/bake.js bakes the fixed ones' shadows). three.js
// recompiles every lit shader when its number of point lights changes, so the game's lights are
// instead lists of uniforms every lit shader walks, all of them always on, however far away:
//   - the moving ones (render/lightpool.js: shots, enemies, loot, villagers' lamps), without
//     shadows, where they are in the world;
//   - the cube's fixed ones (lanterns, fires, lava, portals), each with its baked shadow: on the cube's solids from their lightmap (crisp at any zoom: signed distances to the
// shadow's edge, antialiased over a pixel), on everything else (props, figures, fluids) from a
// volume of the light's visibility round the cube (soft). The sun's shadow of the cube's fixed
// parts is baked too (render/bake.js); three.js's own shadow map of the sun then only holds what
// moves (render/scene.js: the fixed parts stay out of it).
//
// Every lit material takes part without being told: this module wraps Material.onBeforeCompile
// (whatever a material sets, three.js calls the wrapper), so it must be imported before any
// material sets its own (main.js imports it first). The edit is the same for every material and
// steered by uniforms and defines, so no program's cache key changes:
//   - BAKED_LM (render/bake.js bakedSurface): the cube's solids, lightmapped (attribute `lm`)
//   - NO_BAKE: none of it (the proxies of the surroundings, render/neighbors.js)
// A material that brings uniforms of the same names keeps its own (a cube's solids: their cube's
// bake, also while another cube is the one played in).
import * as THREE from 'three';

export const MAX_BAKED = 32;   // fixed lights a cube gives off at most
export const MAX_MOVING = 32;  // moving lights shining at once at most (render/lightpool.js)

// the shared uniforms: the bake of the cube being played in (render/bake.js setCurrentBake)
export const BAKE = {
  uBakeOn: { value: 0 },                       // 1 while the world's scene is drawn
  uBakeR: { value: 0 },                        // 1 once its shadows are baked
  uBakeN: { value: 0 },                        // how many fixed lights
  uBakeL: { value: new Float32Array(MAX_BAKED * 8) },   // per light: x, y, z (in the cube), reach; r, g, b, channel
  uBakeO: { value: new THREE.Vector3() },      // the cube's origin in the world
  uBakeVolA: { value: null }, uBakeVolB: { value: null },   // the volume's channels 0-3, 4-7
  uBakeV0: { value: new THREE.Vector3() }, uBakeVS: { value: new THREE.Vector3(1, 1, 1) },   // its corner and size (in the cube)
  uBakeSun: { value: null },                   // the sun's shadow map of the cube's fixed parts
  uBakeSunM: { value: new THREE.Matrix4() },   // from the cube's coordinates into it
  uMoveN: { value: 0 },                        // how many moving lights
  uMoveL: { value: new Float32Array(MAX_MOVING * 8) },  // per light: x, y, z (in the world), reach; r, g, b, 0
  uBakeDbg: { value: 0 },                      // dev (/lightview): 1 the sun's baked shadow, 2 the fixed lights' light, 3 the lightmap's texels
};

// the scene's lights on, only while the world's scene is drawn (not the portrait, the item
// pictures: their materials take part as well)
export function bakeScene(scene) {
  scene.onBeforeRender = () => { BAKE.uBakeOn.value = 1; };
  scene.onAfterRender = () => { BAKE.uBakeOn.value = 0; };
}

const HEAD = `
#ifndef NO_BAKE
uniform float uBakeOn, uBakeR, uBakeDbg;
uniform int uBakeN;
uniform vec4 uBakeL[${MAX_BAKED * 2}];
uniform int uMoveN;
uniform vec4 uMoveL[${MAX_MOVING * 2}];
uniform vec3 uBakeO;
#ifdef BAKED_LM
  varying vec2 vBakeLm;
  uniform sampler2D uBakeLmA, uBakeLmB;
#else
  uniform highp sampler3D uBakeVolA, uBakeVolB;
  uniform vec3 uBakeV0, uBakeVS;
  uniform highp sampler2DShadow uBakeSun;
  uniform mat4 uBakeSunM;
#endif
float bakeFalloff(float d, float reach) {
  return 1.0 / max(d * d, 0.01) * pow2(saturate(1.0 - pow4(d / reach)));
}
#endif
`;

// before the lights: the visibility of the sun (bakeSun) and of the fixed lights' channels
// (bakeA: 0-3, bakeB: 4-7; channel 0 is the sun's in the lightmap)
const VIS = `
#ifndef NO_BAKE
  float bakeSun = 1.0;
  vec4 bakeA = vec4(1.0), bakeB = vec4(1.0);
  #ifdef BAKED_LM
    {
      // signed distances to the shadows' edges, 0.5 on the edge: one pixel wide whatever the zoom
      vec4 sa = texture(uBakeLmA, vBakeLm), sb = texture(uBakeLmB, vBakeLm);
      vec4 va = clamp((sa - 0.5) / max(fwidth(sa), vec4(1e-4)) + 0.5, 0.0, 1.0);
      vec4 vb = clamp((sb - 0.5) / max(fwidth(sb), vec4(1e-4)) + 0.5, 0.0, 1.0);
      if (uBakeR > 0.5 && uBakeOn > 0.5) { bakeA = va; bakeB = vb; bakeSun = va.r; }
    }
  #else
    if (uBakeR > 0.5 && uBakeOn > 0.5) {
      vec3 bakeW = ((vec4(-vViewPosition, 1.0) - viewMatrix[3]) * viewMatrix).xyz - uBakeO;
      vec3 bakeN = inverseTransformDirection(normal, viewMatrix);
      vec3 vc = (bakeW + bakeN * 0.15 - uBakeV0) / uBakeVS;
      if (all(greaterThanEqual(vc, vec3(0.0))) && all(lessThanEqual(vc, vec3(1.0)))) {
        bakeA = texture(uBakeVolA, vc.xzy); bakeB = texture(uBakeVolB, vc.xzy);   // (its slices go up)
      } else { bakeA = vec4(0.0); bakeB = vec4(0.0); }
      vec4 sc = uBakeSunM * vec4(bakeW + bakeN * 0.03, 1.0);
      sc.xyz /= sc.w;
      if (all(greaterThan(sc.xyz, vec3(0.0))) && all(lessThan(sc.xyz, vec3(1.0)))) bakeSun = texture(uBakeSun, vec3(sc.xy, sc.z - 0.0004));
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
      vec4 la = uMoveL[i * 2], lb = uMoveL[i * 2 + 1];
      vec3 lv = (viewMatrix * vec4(la.xyz, 1.0)).xyz - geometryPosition;
      float d = length(lv);
      if (d >= la.w) continue;
      directLight.direction = lv / d;
      directLight.color = lb.rgb * bakeFalloff(d, la.w);
      directLight.visible = true;
      RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
    }
    for (int i = 0; i < ${MAX_BAKED}; i++) {
      if (i >= uBakeN) break;
      vec4 la = uBakeL[i * 2], lb = uBakeL[i * 2 + 1];
      vec3 lv = (viewMatrix * vec4(la.xyz + uBakeO, 1.0)).xyz - geometryPosition;
      float d = length(lv);
      if (d >= la.w) continue;
      int ch = int(floor(lb.w + 0.5));
      float vis = ch < 0 ? 1.0 : ch < 4 ? bakeA[ch] : bakeB[ch - 4];
      directLight.direction = lv / d;
      directLight.color = lb.rgb * (bakeFalloff(d, la.w) * vis);
      directLight.visible = true;
      bakeDbgL += directLight.color * saturate(dot(geometryNormal, directLight.direction));
      RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
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
      w = function (sh, r) { own.call(this, sh, r); edit(sh); };
      w.own = own;
      w.toString = () => own.toString();
      this[WRAPPED] = w;
    }
    return w;
  },
  set(fn) { this[OWN] = fn; },
});
