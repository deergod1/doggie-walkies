// What comes on at night (game/daycycle.js state.night): the town's lamp posts (a placement's
// `night`, world/town.js) and the houses' windows (a prop's "_window" material, blender/town.py).
// Each house and each lamp comes on at its own moment of the dusk and goes out at its own of the
// dawn (by where it stands: its seed, the one its flicker has), its glowing parts in the shader
// (props.js) and its lights (flames.js) alike.

// how far into the night the cube played in is (main.js, every frame; a uniform)
export const nightGlow = { value: 0 };
export const setNight = n => { nightGlow.value = n; };

// seed (0 .. 2π: props.js fireSeed) -> where in the night's coming (0 .. 1) it comes on
const FROM = 0.15, SPREAD = 0.55, TURN = 0.12;
// how far a thing of `seed` is lit at night n
export const litAt = (n, seed) => Math.min(1, Math.max(0, (n - FROM - SPREAD * seed / 6.28) / TURN));
// the same in GLSL: float litAt(float n, float seed)
export const LIT_GLSL = `float litAt(float n, float seed) { return clamp((n - ${FROM.toFixed(3)} - ${SPREAD.toFixed(3)} * seed / 6.28) / ${TURN.toFixed(3)}, 0.0, 1.0); }`;
