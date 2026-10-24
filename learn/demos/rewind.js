// Turning back time, like the boss Renew: the room's clock runs while you fight, and a tape keeps
// where everybody was, a frame every RENEW_FIGHT.sample seconds. To rewind, the clock runs back
// and everybody is put where the tape says they were then, blended between two frames. Afterwards
// the old tape plays again: your past self (the echo) does what you did, while you do something
// new. The tape and its functions are the game's own (src/core/renew.js: newTape, record, spanAt,
// rewindTime, rewoundAt); the room and the chasing are made up for the demo (2D, no fighting).
import { newTape, record, spanAt, tapeLength, rewindTime, rewoundAt, lerp, RENEW_FIGHT } from '../../src/core/renew.js';
import { canvas, loop, html, t as tr, lang } from '../deck.js';

const W = 640, H = 300, AH = 236;

export default function mount(el) {
  const { c, g, at } = canvas(el, W, H);
  const row = html(el, `<div class="row"><button class="rw">${tr('Rewind!', 'Zurückspulen!')}</button><button class="reset">${tr('Start over', 'Neu anfangen')}</button></div>`);
  const out = html(el, '<div class="out"></div>');
  html(el, `<p class="small muted" style="margin:6px 0 0">${tr('Move the mouse over the room: you are the cyan dot, Renew is the grey one.', 'Beweg die Maus über den Raum: Du bist der türkise Punkt, Renew der graue.')}</p>`);
  const $ = s => row.querySelector(s);
  let hero, boss, aim, tape, clock, rew, echoes, last;
  function reset() { hero = { x: 120, y: 120 }; boss = { x: 520, y: 120 }; aim = { x: 120, y: 120 }; tape = newTape(); clock = 0; rew = null; echoes = []; last = -1; }
  reset();
  const fmt = (n, d = 1) => new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US', { maximumFractionDigits: d, minimumFractionDigits: Math.min(d, 1) }).format(n);
  // everybody as the tape has them at time t
  const pose = (tp, t) => { const s = spanAt(tp, t); return s && s.a.bodies.map((A, i) => ({ x: lerp(A[0], s.b.bodies[i][0], s.k), y: lerp(A[1], s.b.bodies[i][1], s.k) })); };

  loop(el, dt => {
    if (rew) {
      // the rewind: slow at first, racing back, slowing down at the end
      rew.u += dt / rew.time;
      clock = rewoundAt(rew.length, rew.u);
      const p = pose(tape, clock);
      if (p) { [hero.x, hero.y] = [p[0].x, p[0].y]; [boss.x, boss.y] = [p[1].x, p[1].y]; }
      if (rew.u >= 1) {
        // the phase starts again: the old tape becomes an echo, a new tape begins
        echoes = [tape, ...echoes].slice(0, 3);
        tape = newTape(); clock = 0; last = -1; rew = null;
        aim = { ...hero };
      }
    } else {
      clock += dt;
      const dx = aim.x - hero.x, dy = aim.y - hero.y, d = Math.hypot(dx, dy), step = Math.min(d, dt * 170);
      if (d > 0.5) { hero.x += dx / d * step; hero.y += dy / d * step; }
      const bx = hero.x - boss.x, by = hero.y - boss.y, bd = Math.hypot(bx, by);
      if (bd > 30) { boss.x += bx / bd * dt * 90; boss.y += by / bd * dt * 90; }
      // a frame on the tape every sample seconds
      if (Math.floor(clock / RENEW_FIGHT.sample) > last) {
        last = Math.floor(clock / RENEW_FIGHT.sample);
        record(tape, clock, { bodies: [[hero.x, hero.y], [boss.x, boss.y]] });
      }
    }
    draw();
  });
  function draw() {
    g.fillStyle = '#0c0e16'; g.fillRect(0, 0, W, H);
    g.fillStyle = rew ? '#1a1830' : '#141a24'; g.fillRect(0, 0, W, AH);
    // the path on the tape, and the echoes doing again what you did
    const len = tapeLength(tape);
    g.strokeStyle = '#5fd3ff33'; g.lineWidth = 2; g.beginPath();
    tape.frames.forEach((f, i) => { if (f.t > clock) return; const [x, y] = f.bodies[0]; i ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.stroke();
    echoes.forEach((e, i) => {
      const p = pose(e, Math.min(clock, tapeLength(e)));
      if (!p) return;
      g.fillStyle = `rgba(150,220,255,${0.45 - i * 0.1})`; g.beginPath(); g.arc(p[0].x, p[0].y, 9, 0, 7); g.fill();
      g.fillStyle = `rgba(170,170,190,${0.3 - i * 0.07})`; g.beginPath(); g.arc(p[1].x, p[1].y, 12, 0, 7); g.fill();
    });
    g.fillStyle = '#8a8ea8'; g.beginPath(); g.arc(boss.x, boss.y, 12, 0, 7); g.fill();
    g.fillStyle = '#5fd3ff'; g.beginPath(); g.arc(hero.x, hero.y, 9, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke();
    if (rew) {
      g.fillStyle = '#b98cff'; g.font = "bold 18px 'Cinzel', serif"; g.textAlign = 'center';
      g.fillText(tr('◀◀ time runs back', '◀◀ die Zeit läuft zurück'), W / 2, 30); g.textAlign = 'left';
    }
    // the tape: a tick a frame, the clock's place on it
    const ty = AH + 18, tw = W - 40, shown = Math.max(len, 1);
    g.fillStyle = '#d8dde6'; g.font = "13px 'Crimson Text', serif";
    g.fillText(tr(`the tape: ${tape.frames.length} frames, one every ${fmt(RENEW_FIGHT.sample, 3)} s`, `das Band: ${tape.frames.length} Bilder, eines alle ${fmt(RENEW_FIGHT.sample, 3)} s`), 20, ty - 4);
    g.fillStyle = '#ffffff12'; g.fillRect(20, ty + 2, tw, 22);
    g.fillStyle = '#5fd3ff66';
    for (const f of tape.frames) g.fillRect(20 + f.t / shown * tw, ty + 4, 1, 18);
    g.fillStyle = '#ffcf7a'; g.fillRect(20 + Math.min(1, clock / shown) * tw - 1, ty, 3, 26);
    $('.rw').disabled = !!rew || len < 1;
    out.innerHTML = rew ? tr(`Back to the start of the phase: the clock says <b>${fmt(clock)}</b> s. Everybody goes back to where the tape says.`, `Zurück zum Anfang der Phase: Die Uhr sagt <b>${fmt(clock)}</b> s. Alle gehen dorthin zurück, wo das Band es sagt.`)
      : tr(`The clock: <b>${fmt(clock)}</b> s.`, `Die Uhr: <b>${fmt(clock)}</b> s.`) + (echoes.length
        ? tr(` The pale dots are your past self${echoes.length > 1 ? 'ves' : ''} and Renew, played from the old tape${echoes.length > 1 ? 's' : ''}.`, ` Die blassen Punkte sind dein früheres Ich${echoes.length > 1 ? ' (mehrere)' : ''} und Renew, abgespielt vom alten Band.`)
        : tr(' Run around a bit, then rewind.', ' Lauf ein bisschen herum, dann spul zurück.'));
  }
  c.addEventListener('pointermove', e => { const [x, y] = at(e); if (y < AH) aim = { x, y }; });
  $('.rw').onclick = () => { const length = tapeLength(tape); rew = { length, time: rewindTime(length), u: 0 }; };
  $('.reset').onclick = reset;
}
