// The splash screen, before the main menu (not with the dev tools, ?seed= or in the guide's game
// window; ?splash=1 shows it anyway, ?splash=0 never). The glass bird (blender/glassbird.py,
// docs/story.md) stands alone in the dark under one narrow light, in a little mist, over a black
// floor that mirrors it. It waits for the first click or key: browsers let sound start only
// then, and the click is the blow. Something invisible hits it and it breaks: fast, then time
// nearly stands still with the pieces hanging in the light, then it runs again, faster, the
// shatter is heard and the pieces fall away, out of the picture, as it fades to black. A deep
// swell takes over, and the main menu comes out of the black. A second click or key cuts it short.
//
// It draws with a renderer and canvas of its own, over everything, through a float target and a
// dithered last pass (the dark gradients would band); the main menu is set up behind it
// meanwhile (main.js draws nothing of it while the splash covers it: splashCovers).
// The music waits for it (audio/music.js holdMusic), its sounds are audio/splash.js.
// Reducing motion: no camera kick, a softer flash, the hint does not breathe.
import * as THREE from 'three';
import { loadGLB } from '../render/gltf.js';
import { splashHit, splashShatter, splashSwell } from '../audio/splash.js';
import { holdMusic } from '../audio/music.js';
import { reduceMotion } from './settings.js';
import { state } from './state.js';
import { tr } from '../i18n/i18n.js';

const params = new URLSearchParams(location.search);
const embedded = (() => { try { return window.top !== window; } catch { return true; } })();
export const splashWanted = () => params.get('splash') === '1'
  || (params.get('splash') !== '0' && !state.dev && !embedded && state.mode === 'menu');

// --- timing (s) ---------------------------------------------------------------------------------
const FADE_IN = 1.6;        // from black to the bird, once it is loaded
const HINT_AFTER = 1.8;     // then the hint comes
// after the click:
const HIT = 0.05;           // the blow lands; the pieces burst at full speed
const SLOW_FROM = 0.07, SLOW_AT = 0.16;   // time slows down (from, reached)
const SLOW = 0.065;         // how fast time runs then
const FAST_FROM = 1.2, FAST_AT = 1.3;     // and runs again (from, reached), faster than before
const FAST = 1.5;
const SHATTER = 1.27;       // the shatter is heard
const SWELL = 1.42;         // and the swell takes over
const DARK_FROM = 1.25, DARK_AT = 2.05;   // the picture fades to black, as the pieces fall
const REVEAL = 1.0;         // the menu comes out of the black
const CUT = 0.3;            // a second click: to black this fast

// --- the scene ----------------------------------------------------------------------------------
const LIGHT = new THREE.Vector3(0.12, 2.7, 0.08);    // the one light, above the bird
const TARGET = new THREE.Vector3(0, 0.2, 0.03);      // what the camera looks at
const CORE = new THREE.Vector3(0, 0.17, 0);          // the amber core in its chest (where the GLB has it)
const GRAVITY = 6;
const GLASS = new THREE.Color('#86e0d2'), BREAK = new THREE.Color('#d8f6f0'), EYE = new THREE.Color('#05080b');
const AMBER = new THREE.Color('#ffa040');

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// how fast the bird's time runs, s after the click
function rate(s) {
  if (s < SLOW_FROM) return 1;
  if (s < FAST_FROM) return lerp(1, SLOW * (1 + 0.5 * (s - SLOW_AT)), smooth(SLOW_FROM, SLOW_AT, s));
  return lerp(SLOW * (1 + 0.5 * (s - SLOW_AT)), FAST, smooth(FAST_FROM, FAST_AT, s));
}

const NOISE = /* glsl */`
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }`;

// the uniforms every glass surface shares: the light (how bright: it flashes with the blow and
// dims at the end), the core's glow on the glass around it
const shared = {
  uLight: { value: LIGHT }, uLevel: { value: 1 }, uFlash: { value: 0 },
  uCore: { value: CORE }, uCoreGlow: { value: 1 }, uAmber: { value: AMBER },
};

// Glass, premultiplied: it darkens what is behind it a little (`opacity`, more at grazing
// angles) and adds what it reflects and lets through. Each flat facet mirrors a made-up room:
// the light's bright disc straight above, a faint band of lit mist at the horizon, the dark
// everywhere else; so facets turned up flash bright and the others stay dark, as cut glass
// does. On top: a hard glint where a facet turns the light into your eye, thin edges along the
// facets, and the amber core shining through.
function glassMaterial(color, { opacity = 0.2, edge = 1, side = THREE.FrontSide, spec = 1, reflect = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...shared, uTint: { value: color }, uOpacity: { value: opacity }, uEdge: { value: edge }, uSpec: { value: spec },
      uReflect: { value: reflect } },
    vertexShader: /* glsl */`
      attribute vec3 bary;
      varying vec3 vWorld, vNormal, vBary;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz; vNormal = normalize(mat3(modelMatrix) * normal); vBary = bary;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLight, uTint, uCore, uAmber;
      uniform float uLevel, uFlash, uCoreGlow, uOpacity, uEdge, uSpec, uReflect;
      varying vec3 vWorld, vNormal, vBary;
      void main() {
        vec3 N = normalize(vNormal), V = normalize(cameraPosition - vWorld);
        if (!gl_FrontFacing) N = -N;
        float ndv = abs(dot(N, V)), fres = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
        vec3 toL = uLight - vWorld, L = normalize(toL), H = normalize(L + V);
        // the light is a narrow cone straight down: how much of it reaches here
        float cone = smoothstep(0.86, 0.97, dot(-L, vec3(0.0, -1.0, 0.0))) / (1.0 + 0.05 * dot(toL, toL));
        float lit = uLevel * (cone + 0.04) * (1.0 + uFlash) * (0.6 + 0.4 * smoothstep(-0.05, 0.4, vWorld.y));
        vec3 R = reflect(-V, N);
        float room = 1.7 * smoothstep(0.6, 0.93, R.y) + 0.3 * exp(-(R.y - 0.06) * (R.y - 0.06) / 0.01) + 0.05;
        float glint = pow(max(dot(N, H), 0.0), 140.0) * 2.2 * uSpec;
        float b = min(min(vBary.x, vBary.y), vBary.z);
        float edge = (1.0 - smoothstep(0.0, fwidth(b) * 1.2, b)) * uEdge;
        float a = clamp(uOpacity + 0.35 * fres, 0.0, 1.0);
        vec3 through = uTint * (0.16 + 0.55 * max(dot(N, L), 0.0)) * a;
        vec3 col = (through + mix(vec3(1.0), uTint, 0.45) * room * (0.2 + 0.8 * fres) * uReflect) * lit;
        col += vec3(1.0, 0.98, 0.94) * glint * lit;
        col += mix(uTint, vec3(1.0), 0.6) * edge * (0.05 + 0.35 * room * (0.3 + fres)) * lit;
        float d = distance(vWorld, uCore);
        col += uAmber * uCoreGlow * exp(-d * d / 0.007) * (0.15 + 0.45 * ndv) * uLevel;
        gl_FragColor = vec4(col, a);
      }`,
    side, transparent: true, premultipliedAlpha: true, depthWrite: false,
  });
}

// flat facets, and each corner's barycentric coordinate for the edges
function facets(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  g.computeVertexNormals();
  const n = g.attributes.position.count, bary = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) bary[i * 3 + (i % 3)] = 1;
  g.setAttribute('bary', new THREE.BufferAttribute(bary, 3));
  return g;
}

// the glass of one piece: its back faces first (dimmer), then its front ones
function glassMeshes(geometry, color, opts, order) {
  const back = new THREE.Mesh(geometry, glassMaterial(color, { ...opts, side: THREE.BackSide, opacity: (opts.opacity ?? 0.2) * 0.6,
    spec: 0.4, reflect: 0.45, edge: (opts.edge ?? 1) * 0.4 }));
  const front = new THREE.Mesh(geometry, glassMaterial(color, opts));
  back.renderOrder = order; front.renderOrder = order + 1;
  return [back, front];
}

// the GLB's meshes in the bird's frame, as [geometry, material name], by the node they are
// under: the whole bird, the core (only its place is used: the glow is drawn), each shard
function parts(gltf) {
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const out = { bird: [], core: [], shards: new Map() };
  root.traverse(o => {
    if (!o.isMesh) return;
    let owner = o;
    while (owner.parent && owner.parent !== root && !/^GlassBirdShard\d/.test(owner.name)) owner = owner.parent;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld), mat = o.material?.name ?? '';
    if (/^GlassBirdShard\d/.test(owner.name)) {
      if (!out.shards.has(owner.name)) out.shards.set(owner.name, []);
      out.shards.get(owner.name).push([g, mat]);
    } else if (owner.name.startsWith('GlassBirdCore')) out.core.push([g, mat]);
    else if (owner.name.startsWith('GlassBird')) out.bird.push([g, mat]);
  });
  return out;
}

const KINDS = {
  GlassBirdGlass: [GLASS, { opacity: 0.2 }], GlassBirdBreak: [BREAK, { opacity: 0.3, edge: 0.5, reflect: 0.7 }],
  GlassBirdEye: [EYE, { opacity: 0.94, edge: 0, spec: 1.6 }],
};
function pieceGroup(list, order) {
  const group = new THREE.Group();
  for (const [g, mat] of list) {
    const [color, opts] = KINDS[mat] ?? KINDS.GlassBirdGlass;
    for (const m of glassMeshes(facets(g), color, opts, order + (mat === 'GlassBirdEye' ? 4 : 0))) group.add(m);
  }
  return group;
}

// a soft round glow (the core's)
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// the black floor: it lets a little of the mirrored bird through, most near the light's pool
function floorMesh() {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShaderMaterial({
    uniforms: { uLevel: shared.uLevel, uFlash: shared.uFlash },
    vertexShader: /* glsl */`varying vec3 vWorld; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uLevel, uFlash; varying vec3 vWorld;
      ${NOISE}
      void main() {
        float r = length(vWorld.xz - vec2(0.05, 0.04));
        float pool = exp(-r * r / 0.18) * 0.11 * uLevel * (1.0 + uFlash);
        float grain = fbm(vWorld.xz * 9.0) * 0.5 + 0.5;
        float a = mix(0.7, 1.0, smoothstep(0.2, 2.2, r));
        gl_FragColor = vec4(vec3(0.62, 0.7, 0.72) * pool * grain / a, a);
      }`,
    transparent: true, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 5;
  return m;
}

// the light's beam, a faint cone of lit mist from above
function beamMesh() {
  const h = 3.1;
  const g = new THREE.ConeGeometry(0.62, h, 48, 1, true);
  g.translate(0, h / 2, 0);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { uLevel: shared.uLevel, uFlash: shared.uFlash, uTime: { value: 0 } },
    vertexShader: /* glsl */`varying vec3 vWorld, vNormal; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vNormal = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uLevel, uFlash, uTime; varying vec3 vWorld, vNormal;
      ${NOISE}
      void main() {
        float ndv = abs(dot(normalize(vNormal), normalize(cameraPosition - vWorld)));
        float n = fbm(vec2(vWorld.x * 2.2 + uTime * 0.05, vWorld.y * 1.3 - uTime * 0.08));
        float along = smoothstep(3.1, 1.6, vWorld.y) * smoothstep(-0.1, 0.5, vWorld.y);
        float a = pow(ndv, 2.0) * along * (0.35 + 0.9 * n) * 0.06 * uLevel * (1.0 + 0.6 * uFlash);
        gl_FragColor = vec4(vec3(0.78, 0.88, 0.92) * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  m.position.copy(LIGHT).setY(0);
  m.renderOrder = 30;
  return m;
}

// a sheet of drifting mist, facing the camera
function mistMesh(w, h, strength, speed, seed) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShaderMaterial({
    uniforms: { uLevel: shared.uLevel, uTime: { value: 0 }, uStrength: { value: strength }, uSpeed: { value: speed }, uSeed: { value: seed } },
    vertexShader: /* glsl */`varying vec2 vUv; varying vec3 vWorld; void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      uniform float uLevel, uTime, uStrength, uSpeed, uSeed; varying vec2 vUv; varying vec3 vWorld;
      ${NOISE}
      void main() {
        vec2 p = vUv * vec2(3.0, 1.6) + vec2(uSeed, uSeed * 0.7);
        float n = fbm(p + vec2(uTime * uSpeed, uTime * uSpeed * 0.3) + fbm(p * 1.7 - uTime * 0.03));
        float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
        float d = length(vWorld.xz - vec2(0.1, 0.0));
        float lit = 0.25 + exp(-d * d / 0.6);
        float a = smoothstep(0.35, 0.9, n) * edge * lit * uStrength * uLevel;
        gl_FragColor = vec4(vec3(0.6, 0.68, 0.72) * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  return m;
}

// sparks of the core and glass dust: points with a colour, a size and a life of their own
function pointCloud(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(n), 1));
  g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(n), 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 400 } },
    vertexShader: /* glsl */`
      attribute vec3 color; attribute float alpha, size; uniform float uScale; varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = color; vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = max(1.0, size * uScale / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vAlpha;
      void main() { vec2 q = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(q)) * vAlpha; gl_FragColor = vec4(vColor * a, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = 25;
  return p;
}

// onto the screen: the picture darkened towards its edges (a vignette) and by `uDark` (the fades
// to black), with a little noise of about one step of 8 bits (a triangular distribution, moving
// each frame) so the dark gradients do not band
function finishMesh(texture) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { tScene: { value: texture }, uDark: { value: 1 }, uSeed: { value: 0 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tScene; uniform float uDark, uSeed; varying vec2 vUv;
      float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 c = texture2D(tScene, vUv).rgb;
        float d = length((vUv - vec2(0.5, 0.45)) / vec2(0.5, 0.55)) * 0.7071;
        c *= mix(1.0, 0.35, smoothstep(0.45, 1.0, d)) * (1.0 - uDark);
        vec2 p = gl_FragCoord.xy + uSeed * 97.0;
        c += (rand(p) + rand(p + vec2(17.3, 5.1)) - 1.0) / 255.0;
        gl_FragColor = vec4(max(c, 0.0), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  }));
  m.frustumCulled = false;
  return m;
}

// --- running it ---------------------------------------------------------------------------------
let covering = false;
// while the splash hides the main menu completely (main.js need not draw it)
export const splashCovers = () => covering;

export function playSplash() {
  if (!splashWanted()) return;
  let renderer;
  const box = document.createElement('div'), canvas = document.createElement('canvas');
  const hint = document.createElement('div'), black = document.createElement('div');
  box.id = 'splash'; hint.id = 'splash-hint'; black.id = 'splash-black';
  box.append(canvas, hint);
  document.body.append(box, black);
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); }
  catch { box.remove(); black.remove(); return; }
  covering = true;
  holdMusic(true);
  renderer.setClearColor(0x000000, 1);
  // the scene is drawn into a float target (multisampled), then onto the screen with the
  // vignette and the fades to black, dithered: smooth gradients this dark would band in 8 bits
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const finish = finishMesh(target.texture), finishScene = new THREE.Scene(), finishCamera = new THREE.Camera();
  finishScene.add(finish);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(26, 1, 0.05, 40);
  const calm = reduceMotion();

  // the input: the first one is the blow, a later one cuts it short; none of it reaches the
  // menu behind (the audio context started on it already: audio/context.js listens first)
  let phase = 'loading', t0 = performance.now() / 1000, clickAt = 0, cutAt = Infinity;
  const EVENTS = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'touchstart', 'touchend', 'wheel', 'contextmenu'];
  const swallow = e => {
    if (!covering) return;
    e.stopImmediatePropagation();
    if (!e.type.startsWith('key')) e.preventDefault();
    const press = e.type === 'pointerdown' || (e.type === 'keydown' && !e.repeat && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key));
    if (!press) return;
    const now = performance.now() / 1000;
    if (phase === 'waiting') { phase = 'breaking'; clickAt = now; hint.classList.remove('shown'); }
    else if (phase === 'breaking') cutAt = Math.min(cutAt, now);
    else if (phase === 'loading') end();
  };
  for (const ev of EVENTS) addEventListener(ev, swallow, { capture: true, passive: false });

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const px = renderer.getDrawingBufferSize(new THREE.Vector2());
    target.setSize(px.x, px.y);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);

  // the stage
  const real = new THREE.Group(), mirror = new THREE.Group();
  mirror.scale.y = -1;
  scene.add(real, mirror, floorMesh());
  const beam = beamMesh();
  scene.add(beam);
  const mists = [mistMesh(5, 2.2, 0.16, 0.03, 0.0), mistMesh(4, 1.2, 0.12, -0.05, 3.1), mistMesh(3.5, 1.0, 0.09, 0.07, 7.3)];
  mists[0].position.set(-0.4, 0.9, -1.4); mists[1].position.set(0.2, 0.35, -0.5); mists[2].position.set(0.3, 0.15, 0.7);
  for (const [i, m] of mists.entries()) { m.renderOrder = i === 2 ? 32 : 6; scene.add(m); }

  const actors = [];   // { bird, glow, shards: [Object3D], dust } for the real one and its mirror image
  let shards = [];     // the pieces' motion: { p, q, v, w, r, centre }
  let points = null;   // { pos, vel, life, max, color, size } of the sparks and dust
  const DUST = 140, SPARKS = 60;

  loadGLB(new URL('../../assets/glassbird.glb', import.meta.url).href).then(gltf => {
    if (phase === 'done') return;
    const p = parts(gltf);
    if (p.core.length) { p.core[0][0].computeBoundingBox(); p.core[0][0].boundingBox.getCenter(CORE); }
    const glowTex = glowTexture();
    // each shard's pieces moved to sit round its own centre
    const centres = [...p.shards.values()].map(list => {
      const box3 = new THREE.Box3();
      for (const [g] of list) { g.computeBoundingBox(); box3.union(g.boundingBox); }
      const c = box3.getCenter(new THREE.Vector3());
      for (const [g] of list) g.translate(-c.x, -c.y, -c.z);
      return { c, r: box3.getSize(new THREE.Vector3()).length() / 2 };
    });
    for (const [k, group] of [real, mirror].entries()) {
      const offset = k ? -30 : 0;   // the mirror image draws first, under the floor
      const bird = pieceGroup(p.bird, 12 + offset);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: AMBER, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.position.copy(CORE); glow.scale.setScalar(0.42); glow.renderOrder = 20 + offset;
      const pieces = [...p.shards.values()].map((list, i) => {
        const o = pieceGroup(list, 12 + offset);
        o.position.copy(centres[i].c);
        o.visible = false;
        return o;
      });
      const dust = pointCloud(DUST + SPARKS);
      dust.renderOrder = 25 + offset;
      group.add(glow, bird, dust, ...pieces);
      actors.push({ bird, glow, shards: pieces, dust });
    }
    actors[1].dust.geometry = actors[0].dust.geometry;   // (the mirror shows the same points)
    shards = centres.map(({ c, r }) => ({ p: c.clone(), q: new THREE.Quaternion(), v: new THREE.Vector3(), w: new THREE.Vector3(), r, centre: c.clone() }));
    phase = 'waiting';
    t0 = performance.now() / 1000;
  }).catch(e => { console.warn('splash:', e); end(); });

  // the blow: from the left of the screen, a little away from the camera
  const right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), spin = new THREE.Quaternion();
  let simTime = 0, sounded = { hit: false, shatter: false, swell: false };
  function hit() {
    camera.getWorldDirection(tmp);
    right.crossVectors(tmp, up).normalize();
    const from = TARGET.clone().addScaledVector(right, -0.2).add(new THREE.Vector3(0, -0.02, 0.08));
    const away = tmp.clone().setY(0).normalize();
    for (const s of shards) {
      const d = s.centre.distanceTo(from);
      // near where it was struck a piece flies off hard, to the right; further off it is
      // mostly thrown outwards, each a little differently
      const near = Math.exp(-d * d / 0.07);
      const out = s.centre.clone().sub(CORE).multiply(new THREE.Vector3(1, 0.6, 1)).normalize();
      s.v.copy(right).multiplyScalar(0.6 + 2.6 * near)
        .addScaledVector(out, 0.7 + 0.9 * Math.random())
        .addScaledVector(away, 0.2 * Math.random())
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.4, Math.random() - 0.5).multiplyScalar(0.7))
        .add(new THREE.Vector3(0, 0.3, 0));
      const push = 1 + near;
      s.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar((4 + Math.random() * 14) * push / 2);
    }
    for (const a of actors) { a.bird.visible = false; for (const o of a.shards) o.visible = true; }
    // dust from where it was hit, sparks from the core
    const n = DUST + SPARKS;
    points = { pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n) };
    const geo = actors[0].dust.geometry, col = geo.attributes.color.array, size = geo.attributes.size.array;
    for (let i = 0; i < n; i++) {
      const spark = i >= DUST;
      const o = spark ? CORE : from;
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5).normalize();
      if (!spark) dir.addScaledVector(right, 1.3).normalize();
      const speed = spark ? 0.4 + Math.random() * 1.6 : 0.8 + Math.random() * 3.2;
      points.pos.set([o.x + dir.x * 0.03, o.y + dir.y * 0.03, o.z + dir.z * 0.03], i * 3);
      points.vel.set([dir.x * speed, dir.y * speed + (spark ? 0.3 : 0), dir.z * speed], i * 3);
      points.max[i] = points.life[i] = spark ? 0.5 + Math.random() * 0.9 : 0.4 + Math.random() * 0.8;
      const c = spark ? AMBER.clone().lerp(new THREE.Color('#ffe2a8'), Math.random() * 0.5) : new THREE.Color('#d8f4f0');
      col.set([c.r, c.g, c.b], i * 3);
      size[i] = spark ? 0.008 + Math.random() * 0.01 : 0.003 + Math.random() * 0.006;
    }
    geo.attributes.color.needsUpdate = geo.attributes.size.needsUpdate = true;
  }

  function step(dt) {
    for (const s of shards) {
      s.v.y -= GRAVITY * dt;
      s.p.addScaledVector(s.v, dt);
      const angle = s.w.length() * dt;
      if (angle > 0) s.q.premultiply(spin.setFromAxisAngle(tmp.copy(s.w).normalize(), angle));
    }
    if (!points) return;
    const geo = actors[0].dust.geometry, pos = geo.attributes.position.array, alpha = geo.attributes.alpha.array;
    for (let i = 0; i < points.life.length; i++) {
      if (points.life[i] <= 0) { alpha[i] = 0; continue; }
      points.life[i] -= dt;
      const drag = Math.exp(-1.6 * dt);
      points.vel[i * 3 + 1] -= (i >= DUST ? 0.6 : 3) * dt;
      for (let k = 0; k < 3; k++) { points.vel[i * 3 + k] *= drag; points.pos[i * 3 + k] += points.vel[i * 3 + k] * dt; }
      if (points.pos[i * 3 + 1] < 0) { points.pos[i * 3 + 1] = 0; points.vel[i * 3 + 1] *= -0.3; }
      pos[i * 3] = points.pos[i * 3]; pos[i * 3 + 1] = points.pos[i * 3 + 1]; pos[i * 3 + 2] = points.pos[i * 3 + 2];
      alpha[i] = clamp01(points.life[i] / points.max[i]) ** 1.5 * (i >= DUST ? 1.6 : 0.9);
    }
    geo.attributes.position.needsUpdate = geo.attributes.alpha.needsUpdate = true;
  }

  // the camera: the bird at about the same size whatever the screen's shape, drifting slowly round
  function placeCamera(t, kick) {
    const vfov = THREE.MathUtils.degToRad(camera.fov), hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = Math.max(1.9, 0.48 / Math.tan(hfov / 2));
    const az = THREE.MathUtils.degToRad(68 + (calm ? 0 : 3 * Math.sin(t * 0.21))), el = THREE.MathUtils.degToRad(9 + (calm ? 0 : 0.8 * Math.sin(t * 0.17)));
    camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(TARGET);
    camera.lookAt(TARGET);
    if (kick) camera.position.addScaledVector(right, kick);
  }

  let last = performance.now() / 1000, ended = false;
  function frame() {
    if (ended) return;
    const now = performance.now() / 1000, dt = Math.min(now - last, 1 / 20);
    last = now;
    const t = now - t0;
    let dark = 1, flash = 0, kick = 0, level = 1, glow = 1;
    if (phase === 'waiting') {
      dark = 1 - smooth(0, FADE_IN, t);
      if (t > HINT_AFTER && !hint.textContent) {
        hint.textContent = matchMedia?.('(pointer: coarse)').matches ? tr('Tap to begin') : tr('Click to begin');
        requestAnimationFrame(() => hint.classList.add('shown'));
      }
      glow = 0.6 + (calm ? 0 : 0.12 * Math.sin(t * 1.7));
    } else if (phase === 'breaking') {
      const s = now - clickAt, cut = now - cutAt;
      dark = Math.max(1 - smooth(0, FADE_IN, t), smooth(DARK_FROM, DARK_AT, s), cut > 0 ? clamp01(cut / CUT) : 0);
      if (s >= HIT && !simTime) { hit(); simTime = 1e-6; }
      if (s >= HIT) {
        const r = rate(s), sdt = dt * r;
        for (let i = 0; i < 4; i++) step(sdt / 4);
        simTime += sdt;
        const since = s - HIT;
        flash = Math.exp(-since * 16) * (calm ? 0.5 : 1.4) + Math.exp(-Math.max(0, s - SHATTER) * 10) * (s > SHATTER ? 0.35 : 0);
        kick = calm ? 0 : Math.exp(-since * 14) * Math.sin(since * 70) * 0.012;
        glow = 1.5 * Math.exp(-simTime * 9);
      }
      level = 1 - smooth(DARK_FROM - 0.15, DARK_AT, s);
      if (!sounded.hit && s >= HIT) { sounded.hit = true; splashHit(); }
      if (!sounded.shatter && s >= SHATTER && cut < 0) { sounded.shatter = true; splashShatter(); }
      if (!sounded.swell && s >= SWELL) { sounded.swell = true; splashSwell(); }
      if (s >= DARK_AT + 0.05 || cut >= CUT + 0.05) { if (!sounded.swell) splashSwell(2.4); end(); return; }
    }
    shared.uLevel.value = level; shared.uFlash.value = flash; shared.uCoreGlow.value = glow;
    for (const m of [beam, ...mists]) if (m.material.uniforms.uTime) m.material.uniforms.uTime.value = now;
    placeCamera(now, kick);
    for (const m of mists) m.quaternion.copy(camera.quaternion);
    for (const a of actors) {
      a.glow.material.opacity = clamp01(glow * 0.55) * level;
      a.glow.scale.setScalar(0.36 + 0.25 * Math.max(0, glow - 1));
      // (the pieces fall on past the floor, out of the picture: below it they have no mirror image)
      a.shards.forEach((o, i) => { o.position.copy(shards[i].p); o.quaternion.copy(shards[i].q); if (a === actors[1]) o.visible = shards[i].p.y > 0; });
      a.dust.material.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    }
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    finish.material.uniforms.uDark.value = dark;
    finish.material.uniforms.uSeed.value = (finish.material.uniforms.uSeed.value + 0.618) % 1;
    renderer.render(finishScene, finishCamera);
    if (phase !== 'loading') black.style.opacity = '0';   // (the fades are drawn, dithered, from here on)
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // over: the picture is black; the splash goes, the menu comes out of the black, its music starts
  function end() {
    if (ended) return;
    ended = true; phase = 'done';
    covering = false;
    setTimeout(() => holdMusic(false), sounded.swell ? 2000 : 0);   // (the swell rings on into the menu)
    for (const ev of EVENTS) removeEventListener(ev, swallow, { capture: true });
    removeEventListener('resize', resize);
    box.remove();
    scene.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
    target.dispose(); finish.geometry.dispose(); finish.material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    black.style.opacity = '1';
    const from = performance.now();
    const reveal = () => {
      const u = (performance.now() - from) / 1000 / REVEAL;
      black.style.opacity = String(1 - smooth(0, 1, u));
      if (u < 1) requestAnimationFrame(reveal); else black.remove();
    };
    requestAnimationFrame(reveal);
  }
}
