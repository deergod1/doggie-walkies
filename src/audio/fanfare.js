// The fanfare a beaten boss gets (game/enemies.js): a jingle written as a score like the songs
// (music/jingles/victory.scrim), played once by a synth of its own (vendor/scrimshaw) into the
// sound effects' bus. So it is a sound, not music: heard with the music off too, at the sounds'
// volume; the music ducks under it (audio/music.js duckMusic). Its synth is built when audio
// starts, its harp warmed up (plucked strings are rendered ahead), and it hangs on the bus only
// while the jingle plays and rings out: the audio thread works on every node it can reach.
import { createSynth } from '../../vendor/scrimshaw/synth.js';
import { loadScore } from './score.js';
import { onAudioStart } from './context.js';

const FILE = '../../music/jingles/victory.scrim';
const LEVEL = 0.7;   // its synth's output level, into the sounds' bus
const RING = 3;      // s after its last note before its synth leaves the bus (the reverb's tail)

let ctx = null, out = null, syn = null, song = null, until = 0, timer = 0;

onAudioStart((ac, sounds) => {
  ctx = ac; out = sounds;
  fetch(new URL(FILE, import.meta.url))
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
    .then(text => {
      const score = loadScore(text);
      if (score.errors.length) console.warn(`music/jingles/victory.scrim:\n${score.errors.join('\n')}`);
      song = score.song;
      syn = createSynth(ctx, out);
      syn.out.disconnect();   // (from the bus and the analyser nobody reads, until it plays)
      syn.out.gain.value = LEVEL;
      syn.warm(song);
    })
    .catch(e => console.warn(`music/jingles/victory.scrim: ${e.message}`));
});

// play it now; how long it lasts (s), 0 if it cannot (no audio yet, or not loaded)
export function fanfare() {
  if (!syn || ctx.state !== 'running') return 0;
  if (ctx.currentTime >= until) syn.out.connect(out);
  const sess = syn.session(song), t0 = ctx.currentTime + 0.05;
  for (const ev of song.loop.events) sess.play(ev, t0 + ev.t);
  until = t0 + song.loop.dur + RING;
  clearTimeout(timer);
  timer = setTimeout(() => { sess.stop(0.1); syn.out.disconnect(); until = 0; }, (until - ctx.currentTime) * 1000);
  return song.loop.dur;
}
