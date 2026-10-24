// Fireflies: glowing motes drifting about the character where its theme has them (themes/index.js
// `fireflies`: the dark forest), a few a second from the shared particles' glow layer
// (render/particles.js): they come up out of the dark around the character, drift and fade.
import { glow, emit, rand } from './particles.js';

const RATE = 7;   // a second
const COLORS = ['#d8ff6a', '#d8ff6a', '#b8ff8a', '#9affd8'];
let due = 0;

// theme: the current cube's (or none); (x, y, z): the character
export function tickFireflies(dt, theme, x, y, z) {
  if (!theme?.fireflies) { due = 0; return; }
  for (due += dt * RATE; due >= 1; due--) {
    const a = Math.random() * Math.PI * 2, d = rand(1.2, 7.5);
    emit(glow, x + Math.cos(a) * d, y + rand(0.3, 2.4), z + Math.sin(a) * d, {
      v: [rand(-0.3, 0.3), rand(-0.06, 0.14), rand(-0.3, 0.3)], life: rand(2.5, 5.5), size: rand(0.035, 0.065),
      color: COLORS[Math.floor(Math.random() * COLORS.length)], alpha: 0.95, drag: 0.15 });
  }
}
