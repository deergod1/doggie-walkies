// Reading a Scrimshaw score (vendor/scrimshaw, docs/music.md) plus the game's moods and stings.
// Both ride in comments, so a score still pastes into the Scrimshaw Jukebox as is. Each mood names
// the voices that play in it; a mood name pulls in that (earlier) mood's voices, -NAME drops one:
//   # mood explore: lead harp strings bass
//   # mood sense:   strings bass pulse          not additive: the tune drops out
//   # mood rise:    sense lead kick snare
// A mood a score leaves out falls back along FALLBACK; every score needs explore.
// A boss's song (core/bossmusic.js) names moods of its own instead, the first its base (what a
// mood it does not know plays, and what one it leaves out falls back to):
//   # moods: lurk phase1 split phase2 gone
// A sting is a pattern played once, over the loop, as a mood begins (audio/music.js). Its voices
// play only in stings, in no mood:
//   # sting phase2: three
import { compile } from '../../vendor/scrimshaw/score.js';

export const MOODS = ['explore', 'treasure', 'sense', 'rise', 'fight', 'boss'];
export const FALLBACK = { treasure: 'explore', sense: 'explore', rise: 'sense', fight: 'rise', boss: 'fight' };

const MOOD = /^\s*#\s*mood\s+(\w+)\s*:(.*)$/i;
const OWN = /^\s*#\s*moods\s*:(.*)$/i;
const STING = /^\s*#\s*sting\s+(\w+)\s*:(.*)$/i;

export function loadScore(text) {
  const song = compile(text);
  const lines = String(text).split(/\r?\n/), own = [];
  const byName = new Map(song.voices.map((v, i) => [v.name, i]));
  let names = MOODS;
  lines.forEach((line, i) => {
    const m = OWN.exec(line);
    if (!m) return;
    if (names !== MOODS) return own.push(`line ${i + 1}: the moods are named twice`);
    names = m[1].trim().split(/\s+/).filter(Boolean).map(n => n.toLowerCase());
    if (!names.length) { own.push(`line ${i + 1}: "# moods:" names no mood`); names = MOODS; }
  });
  const base = names[0];
  const given = new Map();                  // mood -> Set of voice indices, as written
  const stings = {}, stingVoices = new Set();
  lines.forEach((line, i) => {
    const err = msg => own.push(`line ${i + 1}: ${msg}`);
    const s = STING.exec(line);
    if (s) {
      const mood = s[1].toLowerCase(), pattern = s[2].trim();
      if (!names.includes(mood)) return err(`a sting for unknown mood "${s[1]}" (moods: ${names.join(' ')})`);
      if (stings[mood]) return err(`mood ${mood} has two stings`);
      if (!/^\S+$/.test(pattern)) return err(`a sting is one pattern ("# sting ${mood}: NAME")`);
      const tl = song.pattern(pattern, i + 1);
      if (!tl.dur) return;                   // (compile said why: no such pattern)
      stings[mood] = tl;
      for (const ev of tl.events) stingVoices.add(ev.v);
      return;
    }
    const m = MOOD.exec(line);
    if (!m) return;
    const mood = m[1].toLowerCase();
    if (!names.includes(mood)) return err(`unknown mood "${m[1]}" (moods: ${names.join(' ')})`);
    if (given.has(mood)) return err(`mood ${mood} is defined twice`);
    const set = new Set();
    for (const word of m[2].trim().split(/\s+/).filter(Boolean)) {
      const drop = word.startsWith('-'), name = drop ? word.slice(1) : word;
      const add = given.get(name) ?? (byName.has(name) ? [byName.get(name)] : null);
      if (!add) { err(`mood ${mood} names "${name}", which is neither a voice nor an earlier mood`); continue; }
      for (const v of add) drop ? set.delete(v) : set.add(v);
    }
    given.set(mood, set);
  });
  // compile's errors, the stings' among them, then ours
  const errors = song.errors.map(e => `line ${e.line}: ${e.msg}`).concat(own);
  for (const name of byName.keys()) if (names.includes(name)) errors.push(`voice "${name}" is named like a mood`);
  if (!given.has(base)) errors.push(`the score has no "# mood ${base}:" line`);
  for (const v of stingVoices) {
    const mood = [...given].find(([, set]) => set.has(v))?.[0];
    if (mood) errors.push(`voice "${song.voices[v].name}" plays in a sting and in mood ${mood}: a sting's voices play in no mood`);
  }
  const moods = {};
  for (const mood of names) {
    let from = mood;
    while (!given.has(from) && FALLBACK[from]) from = FALLBACK[from];
    moods[mood] = given.get(from) ?? given.get(base) ?? new Set();
  }
  song.stings = stings;                     // (drumkit.js renders their drums too)
  return { song, moods, names, base, given: [...given.keys()], stings, stingVoices, errors };
}

// the voices that play in mood (one the score does not know: its base mood's)
export const voicesIn = (score, mood) => score.moods[mood] ?? score.moods[score.base];
