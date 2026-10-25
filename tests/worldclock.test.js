// The world's play time playing together (core/worldclock.js): a guest follows the host's clock
// from its pings, never a little back, and the drift of counting frames is gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostClock, heard, follow, HOLD, KEEP } from '../src/core/worldclock.js';

test('the host\'s clock runs on from its words, the quickest one wins', () => {
  assert.equal(hostClock([], 1000), null);
  // heard 100 s at our 1000 ms: 2 s later it is 102
  let s = heard([], 100, 1000);
  assert.equal(hostClock(s, 3000), 102);
  // a word that was 0.2 s on its way (100.8 at our 2000 ms, where 101 was true) changes nothing
  s = heard(s, 100.8, 2000);
  assert.equal(hostClock(s, 3000), 102);
  // one that came quicker than the first does
  s = heard(s, 101.1, 2000);
  assert.ok(Math.abs(hostClock(s, 3000) - 102.1) < 1e-9);
});

test('old words go, the newest stays', () => {
  let s = heard([], 100, 0);
  s = heard(s, 100 + KEEP / 1000 + 1, KEEP + 1000);
  assert.equal(s.length, 1);
  assert.equal(heard([], 5, 0).length, 1);
});

test('the host\'s clock going back (a new world) starts over', () => {
  let s = heard([], 500, 0);
  s = heard(s, 10, 1000);
  assert.deepEqual(s, [{ c: 10, at: 1000 }]);
  assert.equal(hostClock(s, 2000), 11);
});

test('a guest goes forward at once, waits a little ahead, goes back far ahead', () => {
  assert.equal(follow(10, 12), 12);
  assert.equal(follow(10, 9.5), 10, 'a little ahead: it waits');
  assert.equal(follow(10, 10 - HOLD + 0.01), 10);
  assert.equal(follow(100, 10), 10, 'far ahead: back to the host\'s');
});

test('following the host, the clocks stay together however the frames go', () => {
  // the host's clock on real time, pings once a second taking 20..120 ms; the guest's frames
  // stall now and then (a slow frame, a hidden tab): its clock is never far from the host's
  const host = t => 50 + t / 1000;
  let samples = [], clock = 0, worst = 0, last = -Infinity;
  for (let t = 0; t < 600000; t += 16) {
    if (t % 1000 === 0) samples = heard(samples, host(t), t + 20 + (t * 7919 % 100));
    if (t % 5000 > 4000) continue;   // (a second without frames every five)
    const target = hostClock(samples.filter(s => s.at <= t), t);
    if (target === null) continue;
    clock = follow(clock, target);
    assert.ok(clock >= last, 'never back');
    last = clock;
    if (t > 2000) worst = Math.max(worst, Math.abs(clock - host(t)));
  }
  assert.ok(worst < 0.15, `within the trip of a word (${worst})`);
});
