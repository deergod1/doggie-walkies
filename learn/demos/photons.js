// Light the way nature makes it: a lamp sends out tiny bits of light (photons) in every direction;
// each flies straight until it hits something, where some of it bounces off the other way. Where
// many fly by, it is bright. This is how films are drawn (path tracing, with billions of them); the
// game has a sixtieth of a second for a picture, so it cannot (see the next slides). Seen from
// above, in 2D: the room's walls and a pillar, the light of the paths kept in a grid.
import { canvas, loop, html, t as tr, lang } from '../deck.js';

const W = 640, H = 300, S = 4, GW = W / S, GH = H / S;

export default function mount(el) {
  const { c, g, at } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label>${tr('photons a frame', 'Photonen pro Bild')} <input type="range" class="rate" min="0" max="100" value="12"> <b class="rv"></b></label>
    <label>${tr('bounces', 'Abpraller')} <input type="range" class="bounce" min="0" max="3" value="0"> <b class="bv"></b></label>
    <button class="again">${tr('Start over', 'Neu anfangen')}</button></div>`);
  const out = html(el, '<div class="out"></div>');
  html(el, `<p class="small muted" style="margin:6px 0 0">${tr('Drag the lamp.', 'Zieh die Lampe.')}</p>`);
  const $ = s => row.querySelector(s);
  // the room: walls round it, a pillar and a block
  const solid = new Uint8Array(GW * GH);
  const box = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) solid[y * GW + x] = 1; };
  box(0, 0, GW, 2); box(0, GH - 2, GW, GH); box(0, 0, 2, GH); box(GW - 2, 0, GW, GH);
  box(70, 20, 80, 46); box(110, 50, 132, 58); box(40, 52, 48, 60);
  const isSolid = (x, y) => { const i = Math.floor(x), j = Math.floor(y); return i < 0 || j < 0 || i >= GW || j >= GH || solid[j * GW + i]; };
  const light = new Float32Array(GW * GH);
  const lamp = { x: 30, y: 30 };
  let photons = 0, drag = false;
  const img = g.createImageData(GW, GH), small = document.createElement('canvas');
  small.width = GW; small.height = GH;
  const sg = small.getContext('2d');

  function reset() { light.fill(0); photons = 0; }
  // one photon: straight on in small steps, leaving its light in every square it passes; at a wall
  // it bounces off in a random direction away from it, with a little less light
  function shoot(bounces) {
    let x = lamp.x, y = lamp.y, a = Math.random() * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a), e = 1;
    for (let b = 0; b <= bounces; b++) {
      for (let n = 0; n < 400; n++) {
        const nx = x + dx * 0.5, ny = y + dy * 0.5;
        if (isSolid(nx, ny)) {
          // which way the wall faces: the axis the step crossed
          let wx = 0, wy = 0;
          if (isSolid(nx, y)) wx = -Math.sign(dx);
          if (isSolid(x, ny)) wy = -Math.sign(dy);
          if (!wx && !wy) { wx = -Math.sign(dx); wy = -Math.sign(dy); }
          const nl = Math.hypot(wx, wy), na = Math.atan2(wy / nl, wx / nl) + Math.asin(Math.random() * 2 - 1);
          dx = Math.cos(na); dy = Math.sin(na); e *= 0.6;
          break;
        }
        x = nx; y = ny;
        light[Math.floor(y) * GW + Math.floor(x)] += e;
      }
    }
  }
  function draw() {
    const k = photons ? 900 / photons : 0;
    for (let i = 0; i < GW * GH; i++) {
      const o = i * 4;
      if (solid[i]) { img.data[o] = 58; img.data[o + 1] = 50; img.data[o + 2] = 44; img.data[o + 3] = 255; continue; }
      const v = 1 - Math.exp(-light[i] * k * 0.06);
      img.data[o] = 14 + v * 241; img.data[o + 1] = 12 + v * 196; img.data[o + 2] = 10 + v * 120; img.data[o + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, W, H);
    g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(lamp.x * S, lamp.y * S, 7, 0, 7); g.fill();
    g.strokeStyle = '#ffcf7a'; g.lineWidth = 2; g.stroke();
  }
  const fmt = n => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US').format(n);
  const rate = () => Math.round(2 ** ($('.rate').value / 100 * 12));
  loop(el, () => {
    const n = drag ? 0 : rate(), b = +$('.bounce').value;
    for (let i = 0; i < n; i++) shoot(b);
    photons += n;
    $('.rv').textContent = fmt(rate()); $('.bv').textContent = b;
    draw();
    out.innerHTML = tr(`<b>${fmt(photons)}</b> photons so far. ${b ? 'Bouncing light gets into the shadows too.' : 'No bounces: behind the pillar it is pitch black.'} A film shoots <b>billions</b> for one picture and takes minutes for it. The game has a sixtieth of a second.`,
      `<b>${fmt(photons)}</b> Photonen bisher. ${b ? 'Abprallendes Licht kommt auch in die Schatten.' : 'Keine Abpraller: Hinter der Säule ist es stockdunkel.'} Ein Film schießt <b>Milliarden</b> für ein Bild und braucht dafür Minuten. Das Spiel hat eine sechzigstel Sekunde.`);
  });
  const move = e => { const [x, y] = at(e); if (!isSolid(x / S, y / S)) { lamp.x = x / S; lamp.y = y / S; reset(); } };
  c.addEventListener('pointerdown', e => { const [x, y] = at(e); if (Math.hypot(x - lamp.x * S, y - lamp.y * S) < 24) { drag = true; c.setPointerCapture(e.pointerId); move(e); } });
  c.addEventListener('pointermove', e => { if (drag) move(e); });
  c.addEventListener('pointerup', () => { drag = false; });
  $('.again').onclick = reset;
  $('.bounce').oninput = reset;
}
