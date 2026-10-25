// A dropdown: a button showing the chosen option, which opens a list of all of them (the settings'
// language, game/settingsmenu.js). A click, Enter, Space, Up or Down opens it; in the list Up and
// Down, Home and End and a first letter move, a click, Enter or Space chooses, and Esc, Tab or a
// click elsewhere closes it with the choice as it was. Built into an element of the page:
//
//   const d = dropdown(box, { labelledBy: 'its-label-id', choose: value => ... });
//   d.set([{ value, label, lang }], current);   // the options and the chosen one (drawn anew)
//   d.key(e)                                    // a keydown for it? (handled then)
//
// `lang` names an option's language, for one written in its own. A dialog that keeps the keys
// from the game (it stops them on the way down) hands them on with `key`; elsewhere the dropdown
// can be given them from its own listener the same way.
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
let made = 0;

export function dropdown(box, { labelledBy = null, choose = () => {} } = {}) {
  const id = `dropdown-${++made}`;
  box.classList.add('dropdown');
  box.innerHTML = `<button type="button" id="${id}-button" class="dropdown-button" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-list">`
    + `<span class="dropdown-value"></span><span class="dropdown-arrow" aria-hidden="true"></span></button>`
    + `<ul id="${id}-list" class="dropdown-list" role="listbox" tabindex="-1" hidden></ul>`;
  const button = box.querySelector('.dropdown-button'), shown = box.querySelector('.dropdown-value'), list = box.querySelector('.dropdown-list');
  if (labelledBy) {
    button.setAttribute('aria-labelledby', `${labelledBy} ${id}-button`);
    list.setAttribute('aria-labelledby', labelledBy);
  }
  let options = [], value;

  const isOpen = () => !list.hidden;
  const items = () => [...list.children];
  const at = el => items().indexOf(el?.closest?.('[role="option"]'));
  const focusAt = i => { const all = items(); all[Math.max(0, Math.min(all.length - 1, i))]?.focus(); };

  function set(opts, current) {
    const was = isOpen() ? at(document.activeElement) : -1;
    options = opts; value = current;
    const now = options.find(o => o.value === value);
    shown.textContent = now?.label ?? '';
    if (now?.lang) shown.lang = now.lang; else shown.removeAttribute('lang');
    list.innerHTML = options.map((o, i) => `<li role="option" id="${id}-${i}" tabindex="-1" data-index="${i}" aria-selected="${o.value === value}"`
      + `${o.value === value ? ' class="on"' : ''}${o.lang ? ` lang="${esc(o.lang)}"` : ''}>${esc(o.label)}</li>`).join('');
    if (was >= 0) focusAt(was);
  }
  function open() {
    if (isOpen() || !options.length) return;
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    box.classList.add('open');
    focusAt(Math.max(0, options.findIndex(o => o.value === value)));
  }
  function close(refocus = true) {
    if (!isOpen()) return;
    const inside = box.contains(document.activeElement);
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    box.classList.remove('open');
    if (refocus || inside) button.focus();
  }
  function pick(i) {
    const o = options[i];
    close();
    if (o && o.value !== value) choose(o.value);
  }

  function key(e) {
    if (!box.contains(e.target)) return false;
    const k = e.key;
    if (!isOpen()) {
      if (k !== 'ArrowDown' && k !== 'ArrowUp') return false;   // Enter and Space click the button
      e.preventDefault(); open();
      return true;
    }
    const i = at(e.target);
    if (k === 'ArrowDown' || k === 'ArrowUp') focusAt(i + (k === 'ArrowDown' ? 1 : -1));
    else if (k === 'Home' || k === 'End') focusAt(k === 'Home' ? 0 : options.length - 1);
    else if (k === 'Enter' || k === ' ') { if (i >= 0) pick(i); }
    else if (k === 'Escape') close();
    else if (k === 'Tab') { close(); return true; }   // Tab goes on from the button
    else if (k.length === 1 && /\S/.test(k)) {
      // the next option starting with the letter, round from the one after the focused
      const n = options.length, first = s => s.toLocaleLowerCase().startsWith(k.toLocaleLowerCase());
      for (let s = 1; s <= n; s++) if (first(options[(i + s + n) % n].label)) { focusAt((i + s + n) % n); break; }
    } else return false;
    e.preventDefault();
    return true;
  }

  button.addEventListener('click', () => (isOpen() ? close() : open()));
  list.addEventListener('click', e => { const i = at(e.target); if (i >= 0) pick(i); });
  // the pointer moves the focus along, so the keys go on from where it is
  list.addEventListener('pointermove', e => {
    const el = e.target.closest('[role="option"]');
    if (el && el !== document.activeElement) el.focus({ preventScroll: true });
  });
  // a click or the focus elsewhere closes it, the choice as it was
  addEventListener('pointerdown', e => { if (isOpen() && !box.contains(e.target)) close(false); }, true);
  box.addEventListener('focusout', e => { if (isOpen() && !box.contains(e.relatedTarget)) close(false); });

  return { set, open, close, isOpen, key, button };
}
