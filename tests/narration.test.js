import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assets } from './paths.js';
import { plan, clipsOf, clipFile, VOICES } from '../tools/narration.mjs';
import { LINES, SIBLING } from '../src/core/narration.js';
import { EVERY_CHANGE } from '../src/i18n/languages.js';

test('the narrator\'s lines are well formed and translated', async () => {
  const { problems } = await clipsOf();
  assert.deepEqual(problems, []);
});

test('a recorded line says no names: a parameter without forms is a problem', async () => {
  const { problems } = await clipsOf([{ id: 'x', note: 'n', text: 'Hello {owner}.' }]);
  assert.match(problems.join('\n'), /x: no value for \{owner\}/);
  const ok = await clipsOf([{ id: 'opening.looked-like', note: 'n', text: LINES[0].text, forms: SIBLING }]);
  assert.deepEqual(ok.problems, []);
  assert.deepEqual(ok.clips.filter(c => c.lang === 'en').map(c => c.key), ['opening.looked-like.m', 'opening.looked-like.f']);
});

test('every language kept with every change has a voice', () => {
  for (const lang of EVERY_CHANGE) assert.ok(VOICES[lang], `no voice for ${lang} (tools/narration.mjs VOICES)`);
});

test('the narration is rendered and current (node tools/narration.mjs)', async () => {
  const p = await plan(assets);
  const list = xs => xs.map(c => (typeof c === 'string' ? c : clipFile(c.lang, c.key)));
  assert.deepEqual(list(p.missing), [], 'missing clips: run node tools/narration.mjs');
  assert.deepEqual(list(p.changed), [], 'changed lines: run node tools/narration.mjs');
  assert.deepEqual(p.gone, [], 'clips of lines that are gone: run node tools/narration.mjs');
  for (const c of p.clips) {
    const head = readFileSync(resolve(assets, 'narration', clipFile(c.lang, c.key))).subarray(0, 3);
    assert.ok(head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] & 0xe0) === 0xe0), `${c.key} is not an MP3`);
    assert.ok(p.manifest.clips[c.lang][c.key].dur > 0.5);
  }
});
