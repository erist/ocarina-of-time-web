import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SONGS, NOTES, PLAYBACK_NOTE } from '../app/songs.js';
import { HOLES, getFingering, getMidiForHoles } from '../app/fingering.js';
import { TouchFingering } from '../app/touch-fingering.js';

// Exercise the real application event handlers with only browser presentation
// and Web Audio replaced. A controlled clock makes contact races reproducible.
const source = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '');

function fixture({ maxTouches = 10, unlock = null } = {}) {
  let now = 0, nextTimer = 0, audio;
  const timers = new Map();
  const listeners = new Map();
  const nodes = new Map();
  const makeElement = () => ({
    value: '', dataset: {}, children: [],
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    setAttribute() {}, hasAttribute() { return false; }, addEventListener() {},
    append() {}, replaceChildren() {}, focus() {}, pause() {},
    setPointerCapture() {}, matches() { return false; },
  });
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, makeElement());
      return nodes.get(selector);
    },
    querySelectorAll: () => [], createElement: makeElement, body: makeElement(),
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    elementFromPoint: () => null,
  };
  class Audio {
    constructor() {
      audio = this;
      this.context = { state: 'running' };
      this.activeVoice = null;
      this.lastMidi = null;
      this.notes = [];
      this.serial = 0;
    }
    setVolume() {}
    async unlock() { if (unlock) await unlock; return this.context; }
    noteOn(midi) {
      this.lastMidi = midi;
      this.notes.push(midi);
      return (this.activeVoice = ++this.serial);
    }
    noteOff(id) { if (id === this.activeVoice) this.activeVoice = null; }
    stopAll() { this.activeVoice = null; }
  }
  const window = { addEventListener() {} };
  vm.runInNewContext(source, {
    document, window, navigator: { maxTouchPoints: maxTouches },
    localStorage: { getItem() { return null; }, setItem() {} },
    OcarinaAudio: Audio, SONGS, NOTES, PLAYBACK_NOTE,
    HOLES, getFingering, getMidiForHoles, TouchFingering, bodySvg: () => '',
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  });
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
  const dispatch = (name, event) => listeners.get(name)?.forEach(callback => callback(event));
  const target = dataset => {
    const element = Object.assign(makeElement(), { dataset });
    return { closest: () => element };
  };
  return {
    audio,
    state: window.ocarinaState,
    flush,
    async tick(milliseconds) {
      const until = now + milliseconds;
      for (;;) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
        await flush();
      }
      now = until;
      await flush();
    },
    press(pointerId, hole) {
      dispatch('pointerdown', { button: 0, pointerId, preventDefault() {}, target: target({ hole: String(hole) }) });
    },
    release(pointerId) { dispatch('pointerup', { pointerId }); },
    cancel(pointerId) { dispatch('pointercancel', { pointerId }); },
    lostCapture(pointerId) { dispatch('lostpointercapture', { pointerId }); },
    move(pointerId) { dispatch('pointermove', { pointerId, clientX: 0, clientY: 0 }); },
    mode(inputMode) { dispatch('click', { detail: 1, target: target({ inputMode }) }); },
    accessibleHole(hole) { dispatch('click', { detail: 0, target: target({ hole: String(hole) }) }); },
  };
}

test('held contacts sound D5, change to F5, and silence immediately on release', async () => {
  const app = fixture();
  for (const hole of [1, 2, 3, 7, 8, 9, 10, 11, 12]) app.press(hole, hole);
  await app.tick(34);
  assert.equal(app.audio.activeVoice, null);
  await app.tick(1);
  assert.equal(app.state().fingerMidi, 74);
  assert.equal(app.state().directContacts, 9);
  app.release(2);
  app.release(3);
  await app.tick(35);
  assert.equal(app.state().fingerMidi, 77);
  for (const hole of [1, 7, 8, 9, 10, 11, 12]) app.release(hole);
  assert.equal(app.audio.activeVoice, null);
  await app.tick(100);
  assert.deepEqual(app.audio.notes, [74, 77]);
  assert.equal(app.state().directContacts, 0);
});

test('cancellation clears all contacts and stale moves cannot restart audio', async () => {
  const app = fixture();
  app.press(1, 10);
  app.press(2, 12);
  await app.tick(35);
  assert.equal(app.state().fingerMidi, 86);
  app.cancel(1);
  assert.equal(app.audio.activeVoice, null);
  app.move(2);
  app.lostCapture(1);
  app.release(2);
  await app.tick(100);
  assert.equal(app.state().directContacts, 0);
  assert.deepEqual(app.audio.notes, [86]);
});

test('release while audio is unlocking prevents delayed sound', async () => {
  let resolve;
  const app = fixture({ unlock: new Promise(done => { resolve = done; }) });
  app.press(1, 10);
  app.press(2, 12);
  await app.tick(35);
  app.release(1);
  app.release(2);
  resolve();
  await app.flush();
  await app.tick(100);
  assert.equal(app.audio.activeVoice, null);
  assert.deepEqual(app.audio.notes, []);
});

test('changing input mode cancels a pending chord before it can sound', async () => {
  const app = fixture();
  app.press(1, 10);
  app.press(2, 12);
  app.mode('tap');
  await app.tick(100);
  assert.equal(app.state().inputMode, 'tap');
  assert.equal(app.state().directContacts, 0);
  assert.deepEqual(app.audio.notes, []);
});

test('low-touch devices default to tap mode and a short tap sounds without a blow button', async () => {
  const app = fixture({ maxTouches: 5 });
  assert.equal(app.state().inputMode, 'tap');
  // Zelda's Lullaby starts on B5: opening hole 7 produces C6.
  app.press(1, 7);
  await app.tick(1);
  assert.equal(app.state().fingerMidi, 84);
  assert.notEqual(app.audio.activeVoice, null);
  app.release(1);
  assert.equal(app.audio.activeVoice, null);
  assert.deepEqual([...app.state().closed], [10, 11, 12]);
  app.press(2, 7);
  await app.tick(1);
  assert.equal(app.state().fingerMidi, 83);
  app.release(2);
  assert.equal(app.audio.activeVoice, null);
});

test('two tap contacts on one hole toggle once and sustain until both leave', async () => {
  const app = fixture({ maxTouches: 5 });
  app.press(1, 7);
  await app.tick(1);
  const voice = app.audio.activeVoice;
  app.press(2, 7);
  await app.tick(1);
  assert.equal(app.audio.activeVoice, voice);
  assert.equal(app.state().fingerMidi, 84);
  app.release(1);
  assert.equal(app.audio.activeVoice, voice);
  app.lostCapture(1);
  assert.equal(app.audio.activeVoice, voice);
  app.release(2);
  assert.equal(app.audio.activeVoice, null);
  assert.deepEqual(app.audio.notes, [84]);
});

test('an earlier accessible activation cannot release a later contact', async () => {
  const app = fixture();
  app.accessibleHole(10);
  await app.tick(120);
  app.accessibleHole(12);
  await app.tick(110);
  assert.equal(app.state().directContacts, 1);
  assert.deepEqual([...app.state().closed], [12]);
  await app.tick(120);
  assert.equal(app.state().directContacts, 0);
  assert.equal(app.audio.activeVoice, null);
});
