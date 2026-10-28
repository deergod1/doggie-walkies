import { tr, msg, language, setLanguage } from '../i18n/i18n.js';
import { createWalk, stepWalk, setControl, setStyle, setDestination, startSniff, nearbyScent, together, rest } from './simulation.js';
import { cellKey } from './world.js';
import { distance } from './navigation.js';
import { readSave, writeSave } from './save.js';
import { createView } from './view.js';

const INTENTS = {
  idle: msg('Taking it all in'), waiting: msg('Waiting for you'), driving: msg('Choosing the way'),
  walking: msg('Following the route'), following: msg('Coming along'), heeling: msg('Walking at heel'),
  investigating: msg('That smells interesting!'), sniffing: msg('Reading the local news'), resting: msg('Taking a breather'),
  makingRoom: msg('Making a little room'),
};
const $ = id => document.getElementById(id);
let storage;
try { storage = localStorage; } catch { storage = null; }
const params = new URLSearchParams(location.search);
if (params.get('lang') === 'de' || params.get('lang') === 'en') await setLanguage(params.get('lang'));
document.documentElement.lang = language();
const seedParam = params.get('seed'), explicitSeed = seedParam !== null && /^\d{1,10}$/.test(seedParam) ? Number(seedParam) >>> 0 : null;
const saved = readSave(storage);
let state = saved && (explicitSeed === null || saved.seed === explicitSeed) ? saved : createWalk(explicitSeed ?? 2026);

function setupUI() {
  $('walk-ui').innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="paw" aria-hidden="true">✿</span><div><h1>Doggie Walkies</h1><p>${tr('A little adventure, together.')}</p></div></div>
      <div class="top-actions"><select id="walk-language" aria-label="${tr('Language')}"><option value="en">EN</option><option value="de">DE</option></select><button id="pause" aria-label="${tr('Pause the walk')}">Ⅱ</button><button id="help" aria-label="${tr('Walking controls')}">?</button></div>
    </header>
    <section class="location-card panel"><span class="eyebrow">${tr('OUT AND ABOUT')}</span><h2 id="place-title"></h2><p id="walk-totals"></p><div class="location-meta"><small id="seed-label"></small><small id="map-coords"></small></div></section>
    <aside class="map-card panel"><canvas id="walk-map" width="160" height="160" tabindex="0" aria-label="${tr('Local map; remembered places are marked. Click to choose a destination.')}"></canvas></aside>
    <details class="plan-card panel" id="plan-menu">
      <summary aria-label="${tr('Walk plan')}"><span><small>${tr('Walk plan')}</small><strong id="plan-summary"></strong></span><span class="disclosure" aria-hidden="true">⌄</span></summary>
      <div class="plan-popover">
        <span class="eyebrow">${tr('WHO IS LEADING?')}</span>
        <div class="segmented" id="control-options"><button data-control="handler">${tr('Person')}</button><button data-control="dog">${tr('Dog')}</button><button data-control="auto">${tr('Shared plan')}</button></div>
        <span class="eyebrow">${tr('TODAY FEELS LIKE')}</span>
        <div class="segmented"><button data-style="sniffari">${tr('A sniffari')}</button><button data-style="exercise">${tr('Some exercise')}</button></div>
        <p class="plan-note" id="plan-note"></p>
      </div>
    </details>
    <div class="toast" id="walk-toast" role="status" aria-live="polite"></div>
    <div class="discovery-card panel" id="discovery-card" hidden><small id="discovery-eyebrow"></small><h2 id="discovery-name"></h2></div>
    <section class="bottom-hud">
      <div class="pair-status panel">
        <article class="actor-status dog-card"><span class="status-dot" aria-hidden="true"></span><div class="actor-copy"><strong>Miso</strong><span id="dog-intent"></span></div><meter id="dog-energy" min="0" max="1"></meter></article>
        <div class="connection"><span id="leash-label"></span><div class="tension-track"><div id="tension-fill"></div></div><small id="leash-detail"></small><div class="sniff-progress" id="sniff-progress" hidden><progress id="sniff-meter" max="1"></progress><small>${tr('A story in every scent')}</small></div></div>
        <article class="actor-status person-card"><span class="status-dot" aria-hidden="true"></span><div class="actor-copy"><strong>June</strong><span id="handler-intent"></span></div><meter id="handler-energy" min="0" max="1"></meter></article>
        <details class="pair-details" id="character-details"><summary aria-label="${tr('Meet the pair')}" title="${tr('Meet the pair')}">•••</summary><div class="pair-popover"><span class="eyebrow">${tr('Meet the pair')}</span><div id="character-stats"></div></div></details>
      </div>
      <nav class="action-bar panel" aria-label="${tr('Walk actions')}"><button id="sniff"><kbd>E</kbd> ${tr('Have a sniff')}</button><button id="together"><kbd>F</kbd> ${tr('Come along')}</button><button id="rest"><kbd>Space</kbd> <span id="rest-label"></span></button></nav>
    </section>
    <section id="help-panel" class="help-panel panel" hidden aria-label="${tr('Walking controls')}">
      <h2>${tr('Two minds. One little adventure.')}</h2>
      <p>${tr('Drive either partner, or let a shared plan unfold. Gold rings are scents; named corners become places you both remember.')}</p>
      <p>${tr('The leash has a firm limit. If you disagree, pause, give space, or invite your partner along. A sniff is a good reason to stop.')}</p>
      <ul><li>${tr('E: sniff a nearby golden ring')}</li><li>${tr('F: invite cooperation · Space: rest')}</li><li>${tr('C: switch dog/person · G: shared plan')}</li><li>${tr('[ and ]: rotate camera · Esc: pause')}</li></ul>
      <p>${tr('Progress is saved in this browser, separately from the original game. So is what the two of you have noticed together.')}</p>
      <div class="memory"><h3>${tr('Memory')}</h3><p id="memory-stats"></p><ul id="memory-list"></ul></div>
      <button id="new-walk">${tr('Start a new seeded walk')}</button><a href="index.html">${tr('Open the original game')}</a><button id="close-help">${tr('Back to our walk')}</button>
    </section>
    <div id="pause-cover" hidden><div class="panel"><h2>${tr('A moment of quiet')}</h2><button id="resume">${tr('Continue our walk')}</button></div></div>`;
  $('walk-language').value = language() === 'de' ? 'de' : 'en';
}

async function boot() {
  setupUI();
  const canvas = $('walk-view'); canvas.setAttribute('aria-label', tr('Walking scene; use WASD or arrow keys to move'));
  const view = createView(canvas), keys = new Set();
  let toastUntil = 0, last = performance.now(), accumulator = 0, uiElapsed = 0, saveElapsed = 0;
  let pointerStart = null, helpWasPaused = false, hiddenWasPaused = false, saveWarning = false;
  const notify = text => { $('walk-toast').textContent = text; $('walk-toast').classList.add('visible'); toastUntil = performance.now() + 4200; };
  const save = () => {
    const ok = writeSave(storage, state);
    if (!ok && !saveWarning) notify(tr('Saving is unavailable; this walk will last for this tab only.'));
    saveWarning = !ok;
  };
  const pause = value => { state.paused = value; keys.clear(); $('pause-cover').hidden = !value || !$('help-panel').hidden; };
  const help = value => {
    if (value) { helpWasPaused = state.paused; state.paused = true; keys.clear(); }
    else state.paused = helpWasPaused;
    $('help-panel').hidden = !value; $('pause-cover').hidden = !state.paused || value;
  };
  const action = () => {
    if (state.paused) return;
    if (!startSniff(state)) notify(tr('Bring Miso near a golden scent ring.'));
  };
  let discoveryUntil = 0;
  const discovery = name => {
    $('discovery-eyebrow').textContent = tr('A PLACE TO REMEMBER');
    $('discovery-name').textContent = tr(name);
    $('discovery-card').hidden = false; $('discovery-card').classList.remove('shown');
    requestAnimationFrame(() => $('discovery-card').classList.add('shown'));
    discoveryUntil = performance.now() + 4600;
  };
  document.querySelectorAll('[data-control]').forEach(b => b.onclick = () => { setControl(state, b.dataset.control); $('plan-menu').open = false; });
  document.querySelectorAll('[data-style]').forEach(b => b.onclick = () => { setStyle(state, b.dataset.style); $('plan-menu').open = false; });
  $('sniff').onclick = action;
  $('together').onclick = () => { if (!state.paused) together(state); };
  $('rest').onclick = () => { if (!state.paused) rest(state); };
  $('pause').onclick = () => pause(!state.paused); $('resume').onclick = () => pause(false);
  $('help').onclick = () => help($('help-panel').hidden); $('close-help').onclick = () => help(false);
  $('new-walk').onclick = () => {
    const revision = state.revision + 1;
    state = createWalk(crypto.getRandomValues(new Uint32Array(1))[0]); state.revision = revision;
    const url = new URL(location.href); url.searchParams.set('seed', String(state.seed)); history.replaceState(null, '', url);
    helpWasPaused = false; help(false); save(); notify(tr('A fresh corner, a fresh set of stories.'));
  };
  $('walk-language').onchange = () => {
    save(); const url = new URL(location.href); url.searchParams.set('lang', $('walk-language').value); location.assign(url);
  };
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
  addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.code === 'Space' && e.target.tagName === 'BUTTON') return;
    if (movementKeys.has(e.code)) { e.preventDefault(); keys.add(e.code); }
    if (e.repeat) return;
    switch (e.code) {
      case 'KeyC': setControl(state, state.control === 'handler' ? 'dog' : 'handler'); break;
      case 'KeyG': setControl(state, 'auto'); break;
      case 'KeyE': action(); break;
      case 'KeyF': if (!state.paused) together(state); break;
      case 'Space': e.preventDefault(); if (!state.paused) rest(state); break;
      case 'Escape': if (!$('help-panel').hidden) help(false); else pause(!state.paused); break;
      case 'BracketLeft': view.rotate(-Math.PI / 6); break;
      case 'BracketRight': view.rotate(Math.PI / 6); break;
    }
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); });
  document.addEventListener('visibilitychange', () => {
    keys.clear(); accumulator = 0;
    if (document.hidden) { hiddenWasPaused = state.paused; state.paused = true; save(); }
    else { state.paused = hiddenWasPaused; last = performance.now(); }
  });
  addEventListener('pagehide', save);
  canvas.addEventListener('pointerdown', e => { if (e.button === 0) pointerStart = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointercancel', () => { pointerStart = null; });
  canvas.addEventListener('pointerup', e => {
    if (!state.paused && pointerStart && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) < 12) {
      const p = view.pick(e.clientX, e.clientY);
      // Only the materialized window around the pair is real; keep clicks inside it.
      const mid = { x: (state.dog.x + state.handler.x) / 2, z: (state.dog.z + state.handler.z) / 2 };
      if (p && distance(p, mid) > 42) {
        const k = 42 / distance(p, mid); p.x = mid.x + (p.x - mid.x) * k; p.z = mid.z + (p.z - mid.z) * k;
      }
      if (!p || !setDestination(state, p)) notify(tr('Choose an open path or a patch of grass.'));
      canvas.focus({ preventScroll: true });
    }
    pointerStart = null;
  });
  canvas.addEventListener('wheel', e => { if (!e.ctrlKey) { e.preventDefault(); view.zoom(Math.sign(e.deltaY) * 0.8); } }, { passive: false });
  $('walk-map').addEventListener('click', e => {
    if (state.paused) return;
    const r = e.target.getBoundingClientRect();
    const p = { x: state.wx + ((e.clientX - r.left) / r.width * 2 - 1) * 40, z: state.wz + ((e.clientY - r.top) / r.height * 2 - 1) * 40 };
    if (!setDestination(state, p)) notify(tr('Choose an open path or a patch of grass.'));
  });

  function mapDraw() {
    const ctx = $('walk-map').getContext('2d'), half = 50, scale = 160 / (half * 2);
    const ox = state.wx, oz = state.wz;
    const atX = v => (v - ox + half) * scale, atZ = v => (v - oz + half) * scale;
    ctx.fillStyle = '#d2dcb9'; ctx.fillRect(0, 0, 160, 160);
    // Streets are known everywhere; everything else only shows once the pair has walked it.
    ctx.strokeStyle = '#f4e8cf'; ctx.lineWidth = 6.4 * scale;
    for (let gx = Math.floor((ox - half) / 26) * 26; gx <= ox + half; gx += 26) { ctx.beginPath(); ctx.moveTo(atX(gx), 0); ctx.lineTo(atX(gx), 160); ctx.stroke(); }
    for (let gz = Math.floor((oz - half) / 26) * 26; gz <= oz + half; gz += 26) { ctx.beginPath(); ctx.moveTo(0, atZ(gz)); ctx.lineTo(160, atZ(gz)); ctx.stroke(); }
    const known = (x, z) => state.memory.cells.has(cellKey(x, z));
    ctx.fillStyle = 'rgba(255,252,235,0.4)';
    for (const c of state.memory.cells) {
      const [cx, cz] = c.split(',').map(Number);
      if (Math.abs(cx * 8 + 4 - ox) > half + 8 || Math.abs(cz * 8 + 4 - oz) > half + 8) continue;
      ctx.fillRect(atX(cx * 8), atZ(cz * 8), 8 * scale, 8 * scale);
    }
    ctx.fillStyle = '#879c79';
    for (const o of state.map.obstacles) if (known(o.x, o.z)) ctx.fillRect(atX(o.x - o.w / 2), atZ(o.z - o.d / 2), o.w * scale, o.d * scale);
    const dot = (p, color, r) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(atX(p.x), atZ(p.z), r, 0, Math.PI * 2); ctx.fill(); };
    for (const p of state.map.scents) if (known(p.x, p.z) && !state.discovered.includes(p.id)) dot(p, '#c39945', 2);
    for (const p of state.map.places) if (state.memory.places[p.id]) dot(p, '#fff3c4', 3);
    if (state.route?.target) { ctx.strokeStyle = '#d49c4b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(atX(state.route.target.x), atZ(state.route.target.z), 3, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = '#856746'; ctx.lineWidth = 1.5; ctx.beginPath();
    state.leash?.forEach((p, i) => i ? ctx.lineTo(atX(p.x), atZ(p.z)) : ctx.moveTo(atX(p.x), atZ(p.z))); ctx.stroke();
    dot(state.handler, '#355e55', 3); dot(state.dog, '#bd7945', 3.5);
    if (state.clickGoal) { ctx.strokeStyle = '#355e55'; ctx.strokeRect(atX(state.clickGoal.x) - 3, atZ(state.clickGoal.z) - 3, 6, 6); }
  }
  function updateUI() {
    const mid = { x: (state.dog.x + state.handler.x) / 2, z: (state.dog.z + state.handler.z) / 2 };
    const here = Object.values(state.memory.places).find(p => p.name && distance(p, mid) < 7);
    $('place-title').textContent = here ? tr('Near {name}', { name: tr(here.name) }) : tr('Out and about');
    $('walk-totals').textContent = tr('{meters} m wandered · {sniffs} scents · {places} places', { meters: Math.floor(state.metrics.distance), sniffs: state.metrics.sniffs, places: Object.keys(state.memory.places).length });
    $('seed-label').textContent = tr('World seed {seed}', { seed: String(state.seed) });
    $('map-coords').textContent = `${Math.round(state.dog.x)}, ${Math.round(state.dog.z)}`;
    const leader = state.control === 'handler' ? tr('Person') : state.control === 'dog' ? tr('Dog') : tr('Shared plan');
    const style = state.style === 'sniffari' ? tr('A sniffari') : tr('Some exercise');
    $('plan-summary').textContent = `${leader} · ${style}`;
    $('plan-note').textContent = state.style === 'sniffari' ? tr('No hurry. There is a whole world to smell.') : tr('Find a rhythm. A little movement feels good.');
    for (const b of document.querySelectorAll('[data-control]')) { const selected = b.dataset.control === state.control; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); }
    for (const b of document.querySelectorAll('[data-style]')) { const selected = b.dataset.style === state.style; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', String(selected)); }
    for (const id of ['dog', 'handler']) {
      $(id + '-intent').textContent = tr(INTENTS[state[id].intent.kind] ?? INTENTS.idle);
      $(id + '-energy').value = state[id].state.energy;
      $(id + '-energy').setAttribute('aria-label', tr('{name}: energy', { name: id === 'dog' ? 'Miso' : 'June' }));
    }
    $('leash-label').textContent = state.disagreement > 0.3 ? tr('Different ideas') : state.tension > 0.65 ? tr('At the end of the leash') : tr('Room to wander');
    $('leash-detail').textContent = state.disagreement > 0.3 ? tr('A pause or an invitation can help.') : tr('Connected, not in a hurry.');
    $('tension-fill').style.width = `${Math.round(state.tension * 100)}%`;
    $('tension-fill').classList.toggle('taut', state.tension > 0.65);
    $('sniff-progress').hidden = !state.sniff;
    $('sniff-meter').value = state.sniff ? 1 - state.sniff.remaining / state.sniff.duration : 0;
    $('sniff-meter').setAttribute('aria-label', tr('Sniff progress'));
    $('sniff').disabled = !nearbyScent(state) || !!state.sniff;
    $('rest-label').textContent = state.resting ? tr('Ready to wander') : tr('Take a breather');
    $('rest').setAttribute('aria-pressed', String(state.resting));
    if (!$('discovery-card').hidden && performance.now() > discoveryUntil) $('discovery-card').hidden = true;
    if ($('character-details').open) {
      const n = v => Math.round(v * 100);
      $('character-stats').textContent = tr('Miso: curiosity {curiosity} · stimulation need {need} · trust {trust}. June: persistence {persistence}.', {
        curiosity: n(state.dog.personality.curiosity), need: n(state.dog.needs.stimulation), trust: n(state.dog.relationships.handler.trust),
        persistence: n(state.handler.personality.persistence),
      });
    }
    if (!$('help-panel').hidden) {
      $('memory-stats').textContent = tr('{places} places · {cells} little pieces of the world remembered', {
        places: Object.keys(state.memory.places).length, cells: state.memory.cells.size,
      });
      const recent = state.journal.slice(-6).reverse();
      $('memory-list').innerHTML = recent.map(e => `<li>${e.kind === 'place'
        ? tr('Found: {name}', { name: tr(e.name ?? '') }) : tr('Read: {label}', { label: tr(e.label ?? '') })}</li>`).join('');
    }
    if (state.event) {
      if (state.event === 'discovered') notify(tr('Local news, thoroughly read. A good little discovery.'));
      else if (state.event === 'place') discovery(state.journal[state.journal.length - 1]?.name ?? '');
      else if (state.event === 'together') notify(tr('An invitation to find the same direction.'));
      state.event = null;
    }
    if (performance.now() > toastUntil) $('walk-toast').classList.remove('visible');
    mapDraw();
  }
  // Test/debug access deliberately uses explicit actors, never the original window.__game.
  window.__walk = { get state() { return state; }, view, setControl: mode => setControl(state, mode),
    setStyle: style => setStyle(state, style), destination: p => setDestination(state, p),
    sniff: () => startSniff(state), together: () => together(state),
    pause, save, step: (dt, input) => stepWalk(state, dt, input) };
  $('boot').hidden = true;
  if (!saved) notify(tr('Start with a stroll. Miso has already noticed something.'));
  updateUI();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!state.paused) {
      accumulator += dt;
      while (accumulator >= 1 / 60) {
        const x = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
        const z = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
        stepWalk(state, 1 / 60, view.direction(x, z)); accumulator -= 1 / 60;
      }
    } else accumulator = 0;
    view.render(state, state.paused ? 0 : dt); uiElapsed += dt; saveElapsed += dt;
    if (uiElapsed > 0.1) { updateUI(); uiElapsed = 0; }
    if (saveElapsed > 10) { save(); saveElapsed = 0; }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
boot().catch(error => {
  console.error(error); $('boot').hidden = false;
  $('boot').textContent = tr('The walk could not start. Please use a WebGL-capable browser and reload.');
});
