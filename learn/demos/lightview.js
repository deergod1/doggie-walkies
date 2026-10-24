// A cube of the dark forest, three times from the same spot: the picture as you see it, the
// lamps' light alone (what the bake worked out, with its shadows), and the lightmap's texels (each
// coloured square a group of them: how the ground was laid flat). Screenshots of the real game
// with the dev command /lightview (docs/console.md; the Teacher can switch it on: teach.lightview).
// Drag across the picture to wipe from one to the other.
import { html, t as tr } from '../deck.js';

const VIEWS = {
  lights: ['the lamps\' light alone', 'nur das Licht der Lampen'],
  lightmap: ['the lightmap\'s texels', 'die Texel der Lichtkarte'],
};

export default function mount(el) {
  const url = n => new URL(`../img/light-${n}.jpg`, import.meta.url).href;
  const box = html(el, `<div style="position:relative;aspect-ratio:1280/800;overflow:hidden;border-radius:6px;cursor:ew-resize;touch-action:none">
    <img class="a" src="${url('picture')}" alt="" style="position:absolute;inset:0;width:100%;height:100%">
    <img class="b" src="${url('lights')}" alt="" style="position:absolute;inset:0;width:100%;height:100%">
    <div class="line" style="position:absolute;top:0;bottom:0;width:2px;background:#ffcf7a;box-shadow:0 0 6px #000"></div>
    <span class="la mono small" style="position:absolute;left:8px;top:6px;background:#000a;padding:1px 6px;border-radius:4px">${tr('the picture', 'das Bild')}</span>
    <span class="lb mono small" style="position:absolute;right:8px;top:6px;background:#000a;padding:1px 6px;border-radius:4px"></span></div>`);
  const row = html(el, `<div class="row">${Object.keys(VIEWS).map((k, i) => `<label><input type="radio" value="${k}" ${i ? '' : 'checked'}> ${tr(...VIEWS[k])}</label>`).join('')}</div>`);
  const name = 'lv-' + Math.random().toString(36).slice(2);
  row.querySelectorAll('input').forEach(r => { r.name = name; });
  const out = html(el, '<div class="out"></div>');
  const b = box.querySelector('.b'), line = box.querySelector('.line');
  let at = 0.5;
  function show() {
    const v = row.querySelector('input:checked').value;
    b.src = url(v);
    b.style.clipPath = `inset(0 0 0 ${at * 100}%)`;
    line.style.left = `calc(${at * 100}% - 1px)`;
    box.querySelector('.lb').textContent = tr(...VIEWS[v]);
    out.innerHTML = v === 'lights'
      ? tr('Only the light of the lamps that stay, as it was baked: the lanterns on the string, the glowing mushrooms, the portals. See the shadows of the trees and fences.', 'Nur das Licht der Lampen, die bleiben, so wie es ausgerechnet wurde: die Laternen an der Schnur, die leuchtenden Pilze, die Portale. Sieh dir die Schatten der Bäume und Zäune an.')
      : tr('Every coloured stripe is a run of the lightmap\'s texels: the ground was cut into pieces and laid flat. Plants, trees and props are black: they take their light from somewhere else.', 'Jeder bunte Streifen ist eine Reihe Texel der Lichtkarte: Der Boden wurde in Stücke geschnitten und flach hingelegt. Pflanzen, Bäume und Dinge sind schwarz: Sie bekommen ihr Licht woandersher.');
  }
  const drag = e => { const r = box.getBoundingClientRect(); at = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); show(); };
  box.addEventListener('pointerdown', e => { box.setPointerCapture(e.pointerId); drag(e); });
  box.addEventListener('pointermove', e => { if (e.buttons) drag(e); });
  row.querySelectorAll('input').forEach(r => r.oninput = show);
  show();
}
