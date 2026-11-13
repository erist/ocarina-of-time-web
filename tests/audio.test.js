import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { OcarinaAudio } from '../app/audio.js';

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
  resumeWaiters = [];
  createGain() { return new AudioNodeStub(); }
  createPeriodicWave(real, imaginary) { return { real, imaginary }; }
  createOscillator() {
    const node = new AudioNodeStub();
    this.oscillators.push(node);
    return node;
  }
  resume() { return new Promise(resolve => this.resumeWaiters.push(resolve)); }
  finishResume() {
    this.state = 'running';
    for (const resolve of this.resumeWaiters.splice(0)) resolve();
  }
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
