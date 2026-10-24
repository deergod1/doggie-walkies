// The quests of a whole world, planned from its seed by the game's own questPlan
// (src/core/questplan.js) over the world's layouts (src/world/layout.js makeLayouts): a hundred
// slots, so many a depth, each with its kind and who asks. Nothing of this is saved: the seed
// makes it again. What is saved is only what players did with a quest (the quest log,
// src/core/quests.js), the notebook.
import { makeLayouts } from '../../src/world/layout.js';
import { questPlan } from '../../src/core/questplan.js';
import { GIVERS } from '../../src/core/quests.js';
import { residentOf, spotOfGiver } from '../../src/core/npcs.js';
import { canvas, html, t as tr, gameName } from '../deck.js';

const W = 640, H = 330, OX = 60, OY = 16, ROW = 14.6, CH = 22;
const KINDS = {
  find: ['find a lost thing', 'etwas Verlorenes finden', '#5fd3ff'], gather: ['gather three', 'drei sammeln', '#70d6aa'],
  treasure: ['treasure map', 'Schatzkarte', '#ffcf7a'], rescue: ['rescue somebody', 'jemanden retten', '#ff9a8a'],
  scout: ['explore', 'erkunden', '#b98cff'], bounty: ['bounty', 'Kopfgeld', '#ff6b6b'],
  delivery: ['delivery', 'Lieferung', '#c4a882'], relay: ['ask around, then find', 'herumfragen, dann finden', '#8ab0ff'],
  defense: ['defend an outpost', 'einen Außenposten verteidigen', '#ff9a3a'],
};

export default function mount(el) {
  const { c, g, at } = canvas(el, W, H);
  const row = html(el, `<div class="row"><label>Seed <input type="number" class="seed" value="${1 + Math.floor(Math.random() * 999)}"></label>
    <button class="dice">${tr('New seed', 'Neuer Seed')}</button></div>`);
  const out = html(el, '<div class="out"></div>');
  html(el, `<p class="small muted" style="margin:6px 0 0">${tr('Point at a quest.', 'Zeig auf einen Auftrag.')}</p>`);
  const $ = s => row.querySelector(s);
  let plan, layouts, seed, hover = null, chips = [];

  function build() {
    seed = +$('.seed').value || 1;
    layouts = makeLayouts(seed);
    plan = questPlan(seed, layouts);
    draw();
  }
  function who(giver, depth) {
    if (GIVERS[giver]) return tr(`the ${gameName(GIVERS[giver].title)}, in town`, `${gameName(GIVERS[giver].title)} (in der Stadt)`);
    const id = spotOfGiver(giver);
    for (const d of [depth, depth - 1, depth - 2]) {
      if (d < 0) continue;
      const spot = layouts(d).spotList.find(s => s.id === id), r = spot && residentOf(spot);
      if (r) return tr(`${r.name}, who lives on depth ${d}`, `${r.name}, wohnt auf Tiefe ${d}`);
    }
    return tr('somebody out in the world', 'jemand draußen in der Welt');
  }
  function draw() {
    g.fillStyle = '#07080c'; g.fillRect(0, 0, W, H);
    chips = [];
    g.font = "12px 'Crimson Text', serif";
    for (let d = 0; d <= 20; d++) {
      const y = OY + d * ROW, mine = plan.slots.filter(s => s.depth === d);
      g.fillStyle = '#8a96a8'; g.textAlign = 'right'; g.fillText(tr(`depth ${d}`, `Tiefe ${d}`), OX - 8, y + 10); g.textAlign = 'left';
      mine.forEach((s, i) => {
        const x = OX + i * (CH + 4);
        g.fillStyle = KINDS[s.kind]?.[2] ?? '#888';
        g.globalAlpha = hover && hover !== s ? 0.55 : 1;
        g.fillRect(x, y, CH, ROW - 3);
        g.globalAlpha = 1;
        if (!GIVERS[s.giver]) { g.fillStyle = '#000a'; g.beginPath(); g.arc(x + CH / 2, y + (ROW - 3) / 2, 2.5, 0, 7); g.fill(); }
        chips.push({ s, x, y });
      });
    }
    if (hover) { const ch = chips.find(k => k.s === hover); g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(ch.x - 1, ch.y - 1, CH + 2, ROW - 1); }
    // the legend: how many of each kind this world got
    const lx = 260;
    g.font = "13px 'Crimson Text', serif";
    Object.entries(KINDS).forEach(([k, [en, de, col]], i) => {
      const n = plan.slots.filter(s => s.kind === k).length, y = 30 + i * 22;
      g.fillStyle = col; g.fillRect(lx, y - 10, 14, 12);
      g.fillStyle = '#d8dde6'; g.fillText(`${tr(en, de)}: ${n}`, lx + 22, y);
    });
    g.fillStyle = '#8a96a8';
    g.fillText(tr('dot: asked by somebody out in the world;', 'Punkt: Jemand draußen in der Welt fragt;'), lx, 250);
    g.fillText(tr('no dot: by one of the villagers', 'kein Punkt: einer der Leute in der Stadt'), lx, 268);
    g.fillStyle = '#ffe4ae';
    g.fillText(tr(`${plan.slots.length} quests, all from Seed ${seed}`, `${plan.slots.length} Aufträge, alle aus Seed ${seed}`), lx, 300);
    out.innerHTML = hover ? tr(`Depth ${hover.depth}: <b>${KINDS[hover.kind][0]}</b>, asked by ${who(hover.giver, hover.depth)}.`,
      `Tiefe ${hover.depth}: <b>${KINDS[hover.kind][1]}</b>, gefragt von ${who(hover.giver, hover.depth)}.`)
      : tr('Every world has the same number of quests on each depth, but which ones, and who asks, comes from its seed.', 'Jede Welt hat auf jeder Tiefe gleich viele Aufträge, aber welche und wer fragt, kommt aus ihrem Seed.');
  }
  c.addEventListener('pointermove', e => {
    const [x, y] = at(e), hit = chips.find(k => x >= k.x && x < k.x + CH && y >= k.y && y < k.y + ROW - 3);
    if ((hit?.s ?? null) !== hover) { hover = hit?.s ?? null; draw(); }
  });
  $('.seed').onchange = build;
  $('.dice').onclick = () => { $('.seed').value = 1 + Math.floor(Math.random() * 99999); build(); };
  build();
}
