// The bill for many lamps, counted for the reader's own screen: every pixel asks every lamp, 60
// times a second; and a lamp with a shadow needs its six pictures of the cube (a shadow map, all
// round it) before the real picture can be drawn. Then the game's two tricks (src/render/bake.js:
// work out the shadows of what stays once; src/core/lightcells.js: ask only the lamps that reach)
// and what is left of the bill. The numbers of the tricks are the game's (docs/lighting.md: a dark
// forest cube has 40-50 lamps, a spot is reached by about a dozen).
import { canvas, html, t as tr, lang } from '../deck.js';

const W = 640, H = 250;

export default function mount(el) {
  const { g } = canvas(el, W, H);
  const row = html(el, `<div><div class="row"><label>${tr('lamps in the cube', 'Lampen im Würfel')} <input type="range" class="n" min="1" max="128" value="46"> <b class="nv"></b></label>
    <label><input type="checkbox" class="shadow" checked> ${tr('every lamp casts shadows', 'jede Lampe wirft Schatten')}</label></div>
    <div class="row"><label><input type="checkbox" class="bake"> ${tr('trick 1: work out the shadows of what stays once', 'Trick 1: die Schatten von dem, was bleibt, einmal ausrechnen')}</label>
    <label><input type="checkbox" class="cells"> ${tr('trick 2: ask only the lamps that reach', 'Trick 2: nur die Lampen fragen, die hinreichen')}</label></div></div>`);
  const out = html(el, '<div class="out"></div>');
  const $ = s => row.querySelector(s);
  const dpr = devicePixelRatio || 1, sw = Math.round(screen.width * dpr), sh = Math.round(screen.height * dpr), px = sw * sh;
  const fmt = n => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: 1 }).format(n);
  const big = n => n >= 1e9 ? tr(`${fmt(n / 1e9)} billion`, `${fmt(n / 1e9)} Milliarden`) : n >= 1e6 ? tr(`${fmt(n / 1e6)} million`, `${fmt(n / 1e6)} Millionen`) : fmt(Math.round(n));

  function draw() {
    const n = +$('.n').value, shadow = $('.shadow').checked, bake = $('.bake').checked, cells = $('.cells').checked;
    $('.nv').textContent = n;
    const asked = cells ? Math.min(n, 12) : n;
    // pictures of the cube before the real one: the sun's one, a lamp's six; baked: only the hero's lamp
    const pics = 1 + (shadow ? (bake ? 6 : n * 6) : 0);
    const questions = px * asked, perSecond = questions * 60, worst = px * 128 * 60;
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    g.font = "14px 'Crimson Text', serif"; g.fillStyle = '#d8dde6';
    g.fillText(tr(`Drawings of the whole cube before every picture: ${pics}`, `Zeichnungen des ganzen Würfels vor jedem Bild: ${pics}`), 14, 20);
    // one little square a drawing
    const size = pics > 400 ? 5 : pics > 160 ? 7 : 11, per = Math.floor((W - 28) / (size + 2));
    for (let i = 0; i < pics; i++) {
      const x = 14 + (i % per) * (size + 2), y = 30 + Math.floor(i / per) * (size + 2);
      g.fillStyle = i === 0 ? '#ffcf7a' : i <= (bake ? 6 : 0) ? '#5fd3ff' : '#b98cff';
      g.fillRect(x, y, size, size);
    }
    const y0 = 170;
    g.fillStyle = '#d8dde6';
    g.fillText(tr(`Light questions a second: ${big(perSecond)}`, `Licht-Fragen pro Sekunde: ${big(perSecond)}`), 14, y0);
    g.fillStyle = '#ffffff18'; g.fillRect(14, y0 + 10, W - 28, 22);
    g.fillStyle = '#ffcf7a'; g.fillRect(14, y0 + 10, (W - 28) * perSecond / worst, 22);
    g.fillStyle = '#8a96a8'; g.font = "12px 'Crimson Text', serif";
    g.fillText(tr('(the whole bar: 128 lamps, every lamp asked)', '(der ganze Balken: 128 Lampen, jede Lampe gefragt)'), 14, y0 + 50);
    g.fillStyle = '#ffcf7a'; g.fillRect(W - 250, y0 + 40, 10, 10); g.fillStyle = '#8a96a8'; g.fillText(tr('the sun', 'die Sonne'), W - 236, y0 + 49);
    g.fillStyle = '#b98cff'; g.fillRect(W - 180, y0 + 40, 10, 10); g.fillStyle = '#8a96a8'; g.fillText(tr('a lamp', 'eine Lampe'), W - 166, y0 + 49);
    g.fillStyle = '#5fd3ff'; g.fillRect(W - 110, y0 + 40, 10, 10); g.fillStyle = '#8a96a8'; g.fillText(tr('your lamp', 'deine Lampe'), W - 96, y0 + 49);
    out.innerHTML = tr(`Your screen: ${fmt(sw)} × ${fmt(sh)} = <b>${big(px)}</b> pixels. Each one asks <b>${asked}</b> lamp${asked === 1 ? '' : 's'}: <b>${big(questions)}</b> questions for one picture, and 60 pictures a second.`,
      `Dein Bildschirm: ${fmt(sw)} × ${fmt(sh)} = <b>${big(px)}</b> Pixel. Jedes fragt <b>${asked}</b> Lampe${asked === 1 ? '' : 'n'}: <b>${big(questions)}</b> Fragen für ein Bild, und 60 Bilder pro Sekunde.`)
      + (shadow && !bake ? tr(` And before each picture, <b>${pics}</b> drawings of the cube for the shadows. That does not fit into 16 milliseconds.`, ` Und vor jedem Bild <b>${pics}</b> Zeichnungen des Würfels für die Schatten. Das passt nicht in 16 Millisekunden.`) : '')
      + (bake ? tr(' The lamps that stay had their pictures drawn once, when you came in: now only your own lamp needs its six every frame.', ' Die Lampen, die bleiben, haben ihre Bilder einmal gemalt bekommen, als du hereinkamst: Jetzt braucht nur noch deine eigene Lampe ihre sechs in jedem Bild.') : '');
  }
  row.querySelectorAll('input').forEach(i => i.oninput = draw);
  draw();
}
