import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { OcarinaAudio } from '../app/audio.js';
import { NOTES, SONGS } from '../app/songs.js';
import { songPlaybackSequence } from '../app/song-performance.js';

class AudioParamStub {
  value = 0;
  events = [];
  setValueAtTime(value, at) { this.value = value; this.events.push(['set', value, at]); }
  linearRampToValueAtTime(value, at) { this.events.push(['ramp', value, at]); }
  setTargetAtTime(value, at, constant) { this.value = value; this.events.push(['target', value, at, constant]); }
  cancelAndHoldAtTime(at) { this.events.push(['hold', at]); }
  cancelScheduledValues(at) { this.events.push(['cancel', at]); }
}

class AudioNodeStub {
  gain = new AudioParamStub();
  frequency = new AudioParamStub();
  detune = new AudioParamStub();
  disconnected = false;
  connect() {}
  disconnect() { this.disconnected = true; }
  setPeriodicWave(wave) { this.wave = wave; }
  start(at) { this.startedAt = at; }
  stop(at) { this.stoppedAt = at; }
  end() { this.onended?.(); }
}

class AudioContextStub {
  currentTime = 5;
  state = 'suspended';
  destination = {};
  oscillators = [];
  gains = [];
  resumeWaiters = [];
  createGain() {
    const node = new AudioNodeStub();
    this.gains.push(node);
    return node;
  }
  createPeriodicWave(real, imaginary) { return { real, imaginary }; }
  createOscillator() {
    const node = new AudioNodeStub();
    this.oscillators.push(node);
    return node;
  }
  resume() { return new Promise((resolve, reject) => this.resumeWaiters.push({ resolve, reject })); }
  finishResume() {
    this.state = 'running';
    for (const waiter of this.resumeWaiters.splice(0)) waiter.resolve();
  }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

class ClockStub {
  now = 0;
  nextId = 0;
  jobs = new Map();
  setTimeout = (callback, delay) => {
    const id = ++this.nextId;
    this.jobs.set(id, { callback, at: this.now + delay });
    return id;
  };
  clearTimeout = id => this.jobs.delete(id);
  tick(milliseconds) {
    const end = this.now + milliseconds;
    while (true) {
      const next = [...this.jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      this.now = next[1].at;
      this.jobs.delete(next[0]);
      next[1].callback();
    }
    this.now = end;
  }
}

const original = {
  AudioContext: globalThis.AudioContext,
  webkitAudioContext: globalThis.webkitAudioContext,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
};
let clock;

beforeEach(() => {
  clock = new ClockStub();
  globalThis.AudioContext = AudioContextStub;
  globalThis.webkitAudioContext = undefined;
  globalThis.setTimeout = clock.setTimeout;
  globalThis.clearTimeout = clock.clearTimeout;
});
afterEach(() => Object.assign(globalThis, original));

async function readyAudio() {
  const audio = new OcarinaAudio();
  const ready = audio.unlock();
  audio.context.finishResume();
  await ready;
  return audio;
}

test('a release gesture retries a blocked resume and unlocks every waiter', async () => {
  const audio = new OcarinaAudio();
  const first = audio.unlock();
  const context = audio.context;
  const concurrent = audio.unlock();
  assert.equal(context.resumeWaiters.length, 1, 'ordinary calls share the same resume request');

  const activated = audio.activate();
  assert.equal(context.resumeWaiters.length, 2, 'retry happens synchronously inside the gesture');
  // A late denial of the initial touch must not cancel the eligible release.
  context.resumeWaiters[0].reject(new Error('Old activation denied'));
  await Promise.resolve();
  context.state = 'running';
  context.resumeWaiters[1].resolve();
  const [firstContext, secondContext] = await Promise.all([first, concurrent, activated]);
  assert.equal(firstContext, context);
  assert.equal(secondContext, context);

  clock.tick(2100);
  assert.equal(audio.context, context);
  assert.equal(context.oscillators.length, 0, 'activation alone must not play a released note');
  assert.equal(clock.jobs.size, 0);
});

test('a hung resume releases the old context and the next attempt uses the saved volume', async () => {
  const audio = new OcarinaAudio();
  audio.setVolume(.37);
  const failed = assert.rejects(audio.unlock());
  const stale = audio.context;
  clock.tick(2000);
  await failed;
  assert.equal(audio.context, null);
  assert.equal(clock.jobs.size, 0);

  const next = audio.unlock();
  const replacement = audio.context;
  assert.notEqual(replacement, stale);
  replacement.finishResume();
  assert.equal(await next, replacement);
  assert.equal(audio.master.gain.value, .37 * .42);
  const voice = audio.noteOn(74);

  stale.finishResume();
  await Promise.resolve();
  assert.equal(audio.context, replacement);
  assert.equal(audio.activeVoice, voice);
  assert.equal(stale.oscillators.length, 0);
});

test('a running context with a frozen render clock is replaced on the next input', async (t) => {
  let now = 100;
  t.mock.method(performance, 'now', () => now);
  const audio = await readyAudio();
  const originalContext = audio.context;
  now += 1100;
  originalContext.currentTime += 1.1;
  assert.equal(await audio.unlock(), originalContext, 'healthy audio uses the existing context');

  now += 1100;
  const recovery = audio.unlock();
  const replacement = audio.context;
  assert.notEqual(replacement, originalContext, 'a stalled clock requires a fresh output graph');
  replacement.finishResume();
  assert.equal(await recovery, replacement);
  assert.equal(clock.jobs.size, 0);
});

test('a foreground interruption is recovered by the same song play gesture', async () => {
  const audio = await readyAudio();
  const interrupted = audio.context;
  interrupted.state = 'interrupted';
  const playing = audio.play([{ midi: 74, beats: 1 }]);
  const replacement = audio.context;
  assert.notEqual(replacement, interrupted);
  assert.equal(replacement.resumeWaiters.length, 1);
  replacement.finishResume();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(replacement.oscillators[0]?.frequency.value, 440 * 2 ** ((74 - 69) / 12));
  clock.tick(2000);
  assert.equal(await playing, true, 'recreating the context must not cancel this song');
});

test('reset during resume cancels pending playback before a stale browser response arrives', async () => {
  const audio = new OcarinaAudio();
  const callbacks = [];
  const playing = audio.play([{ midi: 81, beats: 1 }], {
    onNote: (index) => callbacks.push(index), onEnd: () => callbacks.push('end'),
  });
  const stale = audio.context;
  const canceledUnlock = assert.rejects(audio.unlock());
  audio.reset();
  assert.equal(audio.context, null);
  assert.equal(await playing, false);
  await canceledUnlock;
  assert.equal(clock.jobs.size, 0);

  const ready = audio.unlock();
  const replacement = audio.context;
  replacement.finishResume();
  await ready;
  const currentVoice = audio.noteOn(77);
  stale.finishResume();
  await Promise.resolve();
  clock.tick(3000);
  assert.deepEqual(callbacks, []);
  assert.equal(stale.oscillators.length, 0);
  assert.equal(audio.context, replacement);
  assert.equal(audio.activeVoice, currentVoice);
});

test('stopping while mobile audio unlock is pending never starts a delayed song', async () => {
  const audio = new OcarinaAudio();
  const playing = audio.play([{ midi: 74, beats: 1 }]);
  audio.stopAll();
  audio.context.finishResume();
  assert.equal(await playing, false);
  assert.equal(audio.context.oscillators.length, 0);
  assert.equal(clock.jobs.size, 0);
});

test('only the newest song survives two plays waiting on the same unlock', async () => {
  const audio = new OcarinaAudio();
  const oldSong = audio.play([{ midi: 74, beats: 1 }]);
  const newSong = audio.play([{ midi: 81, beats: 1 }]);
  audio.context.finishResume();
  assert.equal(await oldSong, false);
  // Each audible voice uses one oscillator plus its low-frequency vibrato.
  assert.equal(audio.context.oscillators.length, 2);
  assert.ok(Math.abs(audio.context.oscillators[0].frequency.value - 880) < 1e-9);
  audio.stopPlayback();
  assert.equal(await newSong, false);
});

test('releasing an old touch does not stop the newer touch', async () => {
  const audio = await readyAudio();
  const oldVoice = audio.noteOn(69);
  const oldOscillator = audio.context.oscillators[0];
  const newVoice = audio.noteOn(72);
  const newOscillator = audio.context.oscillators[2];
  assert.equal(oldOscillator.frequency.value, 440);
  assert.ok(oldOscillator.stoppedAt > audio.context.currentTime);
  audio.noteOff(oldVoice);
  assert.equal(audio.activeVoice, newVoice);
  assert.equal(newOscillator.stoppedAt, undefined);
  audio.noteOff(newVoice);
  assert.equal(audio.activeVoice, null);
  assert.ok(newOscillator.stoppedAt > audio.context.currentTime);
});

test('a manual note cancels playback callbacks and every future scheduled voice', async () => {
  const audio = await readyAudio();
  const callbacks = [];
  const playing = audio.play([{ midi: 74, beats: 1 }, { midi: 77, beats: 1 }], {
    onNote: index => callbacks.push(index), onEnd: () => callbacks.push('end'),
  });
  await Promise.resolve();
  const futureOscillator = audio.context.oscillators[2];
  audio.noteOn(81);
  assert.equal(await playing, false);
  assert.ok(futureOscillator.stoppedAt < futureOscillator.startedAt);
  clock.tick(5000);
  assert.deepEqual(callbacks, []);
  assert.equal(clock.jobs.size, 0);
});

test('beat spacing and rests use the audio clock, independently of UI timer delivery', async () => {
  const audio = await readyAudio();
  const playing = audio.play([
    { midi: 74, beats: 1 }, { midi: null, beats: 2 }, { midi: 77, beats: 1 },
  ], { bpm: 120 });
  await Promise.resolve();
  const oscillators = audio.context.oscillators;
  assert.equal(oscillators.length, 4, 'a rest must not create an audible oscillator');
  assert.ok(Math.abs(oscillators[2].startedAt - oscillators[0].startedAt - 1.5) < 1e-9);
  assert.ok(oscillators[0].stoppedAt < oscillators[2].startedAt);
  audio.stopAll();
  assert.equal(await playing, false);
});

test('automatic notes use the same pitch, wave and vibrato as all five manual buttons', async () => {
  const audio = await readyAudio();
  for (const { midi } of Object.values(NOTES)) {
    const manualOffset = audio.context.oscillators.length;
    const manualGainOffset = audio.context.gains.length;
    audio.noteOn(midi);
    const [manualTone, manualVibrato] = audio.context.oscillators.slice(manualOffset);
    const manualDepth = audio.context.gains[manualGainOffset + 1].gain.events.at(-1)[1];

    const automaticOffset = audio.context.oscillators.length;
    const automaticGainOffset = audio.context.gains.length;
    const playing = audio.play([{ midi, beats: 0.5 }]);
    await Promise.resolve();
    const [automaticTone, automaticVibrato] = audio.context.oscillators.slice(automaticOffset);
    const automaticDepth = audio.context.gains[automaticGainOffset + 1].gain.events.at(-1)[1];
    assert.equal(automaticTone.frequency.value, manualTone.frequency.value, `pitch ${midi}`);
    assert.equal(automaticTone.wave, manualTone.wave, `wave ${midi}`);
    assert.equal(automaticVibrato.frequency.value, manualVibrato.frequency.value, `vibrato rate ${midi}`);
    assert.equal(automaticDepth, manualDepth, `vibrato depth ${midi}`);
    clock.tick(1000);
    assert.equal(await playing, true);
  }
});

test('song playback separates repeated notes and releases every final note without a long tail', async () => {
  const songs = [...SONGS, { id: 'custom', notes: ['D', 'D', 'F', 'F', 'A', 'A', 'B', 'B'] }];
  let repeatedPairs = 0;
  for (const song of songs) {
    const audio = await readyAudio();
    const playing = audio.play(songPlaybackSequence(song), { bpm: 100 });
    await Promise.resolve();
    const tones = audio.context.oscillators.filter((_, index) => index % 2 === 0);
    assert.equal(tones.length, song.notes.length, song.id);
    for (let index = 1; index < tones.length; index++) {
      assert.ok(tones[index - 1].stoppedAt < tones[index].startedAt, `${song.id}: notes must not overlap`);
      if (song.notes[index - 1] === song.notes[index]) {
        repeatedPairs++;
        assert.notEqual(tones[index - 1], tones[index], `${song.id}: repeated notes need distinct attacks`);
        assert.equal(tones[index - 1].frequency.value, tones[index].frequency.value);
      }
    }
    const final = tones.at(-1);
    assert.ok(final.stoppedAt - final.startedAt <= 0.35 + 1e-9, `${song.id}: short final note`);
    clock.tick(10000);
    assert.equal(await playing, true);
    assert.equal(clock.jobs.size, 0, song.id);
  }
  assert.ok(repeatedPairs >= 6, 'exercise repeated pitches in Serenade, Nocturne, and the custom song');
});

test('normal completion reports each note and exactly one completion', async () => {
  const audio = await readyAudio();
  const callbacks = [];
  const playing = audio.play([{ midi: 74, beats: 1 }, { midi: 77, beats: 1 }], {
    bpm: 120, onNote: index => callbacks.push(index), onEnd: () => callbacks.push('end'),
  });
  await Promise.resolve();
  clock.tick(2000);
  assert.equal(await playing, true);
  assert.deepEqual(callbacks, [0, 1, -1, 'end']);
  assert.equal(audio.lastMidi, 77);
  assert.equal(clock.jobs.size, 0);
});

test('lullaby notes have only a brief separation at every supported speed', async () => {
  const song = SONGS.find(song => song.id === 'zelda');
  for (const bpm of [50, 100, 160]) {
    const audio = await readyAudio();
    const playing = audio.play(songPlaybackSequence(song), { bpm });
    await Promise.resolve();
    const tones = audio.context.oscillators.filter((_, index) => index % 2 === 0);
    assert.equal(tones.length, 6);
    for (let index = 1; index < tones.length; index++) {
      const gap = tones[index].startedAt - tones[index - 1].stoppedAt;
      assert.ok(gap > 0 && gap < .025, `${bpm}%: no overlap or extended silence`);
    }
    const finalDuration = tones.at(-1).stoppedAt - tones.at(-1).startedAt;
    assert.ok(finalDuration <= .35 * 100 / bpm, 'last note stays short');
    clock.tick(10000);
    assert.equal(await playing, true);
  }
});

test('ending an old voice cleans up its graph without clearing the current voice', async () => {
  const audio = await readyAudio();
  audio.noteOn(74);
  const oldOscillator = audio.context.oscillators[0];
  const current = audio.noteOn(77);
  oldOscillator.end();
  assert.equal(oldOscillator.disconnected, true);
  assert.equal(audio.activeVoice, current);
});

test('volume is bounded and invalid values never reach the audio output', async () => {
  const audio = await readyAudio();
  audio.setVolume(100);
  assert.equal(audio.volume, 1);
  assert.equal(audio.master.gain.value, 0.42);
  audio.setVolume(-100);
  assert.equal(audio.volume, 0);
  assert.equal(audio.master.gain.value, 0);
  audio.setVolume(Number.NaN);
  assert.equal(audio.master.gain.value, 0);
});

test('invalid notes, durations, and tempo fail before scheduling audio', async () => {
  const audio = await readyAudio();
  assert.throws(() => audio.noteOn(Number.NaN), RangeError);
  assert.throws(() => audio.noteOn(128), RangeError);
  await assert.rejects(audio.play([{ midi: 74, beats: 0 }]), RangeError);
  await assert.rejects(audio.play([{ midi: -1, beats: 1 }]), RangeError);
  await assert.rejects(audio.play([{ midi: 74, beats: 1 }], { bpm: 0 }), RangeError);
  assert.equal(audio.context.oscillators.length, 0);
  assert.equal(clock.jobs.size, 0);
});

test('unsupported browsers give a useful error instead of crashing during construction', async () => {
  globalThis.AudioContext = undefined;
  const audio = new OcarinaAudio();
  await assert.rejects(audio.unlock(), /오디오 재생을 지원하지/);
});
