import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { repo } from './paths.js';
import { loadScore, MOODS } from '../src/audio/score.js';
import { SONGS } from '../src/themes/index.js';

const dir = resolve(repo, 'music');
// the game's songs, plus reference scores in subfolders (tools/player.html FOLDERS)
const files = readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.scrim'));

test('the game finds its songs', () => {
  for (const name of SONGS) assert.ok(files.includes(`${name}.scrim`), name);
  // and plays every song in music/ (subfolders hold reference scores)
  assert.deepEqual(files.filter(f => !f.includes('/')).map(f => f.replace('.scrim', '')).sort(), [...SONGS].sort());
});

test('every reference score is listed for the player', () => {
  for (const sub of new Set(files.filter(f => f.includes('/')).map(f => f.split('/')[0]))) {
    const index = JSON.parse(readFileSync(resolve(dir, sub, 'index.json'), 'utf8')).map(e => `${sub}/${e.file}`);
    assert.deepEqual(index.sort(), files.filter(f => f.startsWith(`${sub}/`)).sort());
  }
});

for (const file of files) {
  test(`music/${file} compiles and loops`, () => {
    const { song, moods, errors } = loadScore(readFileSync(resolve(dir, file), 'utf8'));
    assert.deepEqual(errors, []);
    assert.ok(song.loop.dur > 0, 'has a loop');
    for (const mood of MOODS) assert.ok(moods[mood].size, `mood ${mood} plays something`);
    // every voice plays somewhere, and in some mood
    const used = new Set([...song.intro.events, ...song.loop.events].map(e => e.v));
    for (const [i, v] of song.voices.entries()) {
      assert.ok(used.has(i), `voice ${v.name} plays`);
      assert.ok(MOODS.some(m => moods[m].has(i)), `voice ${v.name} is in a mood`);
    }
  });
}

test('combat layers stay out of calmer moods and drive every bar', () => {
  for (const name of SONGS.filter(name => name !== 'town' && name !== 'title')) {
    const { song, moods, given } = loadScore(readFileSync(resolve(dir, `${name}.scrim`), 'utf8'));
    for (const mood of ['fight', 'boss']) {
      assert.ok(given.includes(mood), `${name}: explicit ${mood} arrangement`);
      assert.ok(moods[mood].size <= 12, `${name}: ${mood} leaves room in the mix`);
    }
    for (const voice of ['drive', 'war']) {
      const i = song.voices.findIndex(v => v.name === voice);
      assert.ok(i >= 0, `${name}: has ${voice}`);
      assert.equal(song.voices[i].drum, voice === 'war');
      for (const mood of MOODS) {
        assert.equal(moods[mood].has(i), mood === 'fight' || mood === 'boss', `${name}: ${voice} in ${mood}`);
      }
      for (const timeline of [song.intro, song.loop]) {
        for (const [s, section] of timeline.sections.entries()) {
          const events = timeline.events.filter(e => e.v === i && e.s === s);
          for (let bar = 0; bar < section.bars; bar++) {
            const start = section.start + bar * section.barDur;
            const hits = events.filter(e => e.t >= start - 1e-6 && e.t < start + section.barDur - 1e-6);
            assert.ok(hits.length >= section.beats * 2, `${name}: ${voice} drives ${section.name} bar ${bar + 1}`);
            assert.ok(hits.some(e => e.vel >= 1), `${name}: ${voice} accents each bar`);
            // Joining combat mid-bar must not wait through a long rest for either layer.
            const onsets = [...hits.map(e => e.t), hits[0].t + section.barDur];
            for (let h = 1; h < onsets.length; h++) {
              assert.ok(onsets[h] - onsets[h - 1] <= 60 / section.tempo + 1e-6, `${name}: ${voice} responds within a beat`);
            }
            if (voice === 'drive') assert.ok(hits.every(e => e.m.length === 1), `${name}: a clear single-note ostinato`);
          }
        }
      }
    }
  }
});

test('moods build on earlier moods and fall back', () => {
  const text = 'beats 1\nvoice a sine\nvoice b kick\nvoice c sine\n'
    + '# mood explore: a c\n# mood sense: explore b -a\n# mood boss: d\n'
    + 'pattern A\na | C4--- |\nb | x... |\nc | E4--- |\nloop A\n';
  const { moods, errors } = loadScore(text);
  assert.deepEqual([...moods.explore], [0, 2]);
  assert.deepEqual([...moods.sense].sort(), [1, 2]);
  assert.equal(moods.treasure, moods.explore);
  assert.equal(moods.fight, moods.sense);   // fight -> rise -> sense
  assert.deepEqual(errors, ['line 7: mood boss names "d", which is neither a voice nor an earlier mood']);
});

test('a score needs an explore mood', () => {
  const { errors } = loadScore('beats 1\nvoice a sine\n# mood calm: a\npattern A\na | C4--- |\nloop A\n');
  assert.deepEqual(errors, ['line 3: unknown mood "calm" (moods: explore treasure sense rise fight boss)',
    'the score has no "# mood explore:" line']);
});
