import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SONGS, NOTES, PLAYBACK_NOTE } from '../app/songs.js';
import { HOLES, getFingering, getMidiForHoles } from '../app/fingering.js';
import { TouchFingering } from '../app/touch-fingering.js';
import { TwoTouchInstrument } from '../app/two-touch.js';
import { resolvePlayLayout } from '../app/play-layout.js';
import { GAME_SCALE, SCALE_GUIDE, controlForNote, gameNoteForMidi } from '../app/control-mapping.js';
import { noteIndexAt } from '../app/song-performance.js';

// Exercise the real application event handlers with only browser presentation
// and Web Audio replaced. A controlled clock makes contact races reproducible.
const source = readFileSync(new URL('../app/app.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '');

function fixture({ maxTouches = 10, unlock = null, mode = 'merch', width = 390, height = 844 } = {}) {
  let now = 0, nextTimer = 0, audio;
  const timers = new Map();
  const listeners = new Map();
  const nodes = new Map();
  const windowListeners = new Map();
  const layoutStyles = new Map();
  const hitTests = [];
  let hitTarget = null;
  const makeElement = () => ({
    value: '', dataset: {}, children: [],
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    setAttribute() {}, hasAttribute(name) {
      return name.startsWith('data-') && Object.hasOwn(this.dataset, name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase()));
    }, addEventListener() {},
    append() {}, replaceChildren() {}, focus() {}, pause() { this.paused = true; },
    async play() { this.paused = false; },
    setPointerCapture() {}, matches() { return false; },
    querySelectorAll() { return []; }, querySelector() { return null; },
  });
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, makeElement());
      return nodes.get(selector);
    },
    querySelectorAll: () => [], createElement: makeElement, body: makeElement(),
    documentElement: { style: { setProperty: (name, value) => layoutStyles.set(name, value) } },
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    elementFromPoint: (x, y) => { hitTests.push([x, y]); return hitTarget; },
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
  const window = {
    innerWidth: width, innerHeight: height,
    addEventListener(name, callback) {
      if (!windowListeners.has(name)) windowListeners.set(name, []);
      windowListeners.get(name).push(callback);
    },
  };
  vm.runInNewContext(source, {
    document, window, navigator: { maxTouchPoints: maxTouches },
    localStorage: {
      getItem(key) { return key === 'hyrule-settings' ? JSON.stringify({ version: 2, mode }) : null; },
      setItem() {}, removeItem() {},
    },
    OcarinaAudio: Audio, SONGS, NOTES, PLAYBACK_NOTE,
    HOLES, getFingering, getMidiForHoles, TouchFingering, TwoTouchInstrument, bodySvg: () => '',
    resolvePlayLayout, GAME_SCALE, SCALE_GUIDE, controlForNote, gameNoteForMidi, noteIndexAt,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
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
    layoutStyles,
    hitTests,
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
    base(pointerId, control) {
      const note = Object.entries(NOTES).find(([, value]) => value.control === control)?.[0];
      dispatch('pointerdown', { button: 0, pointerId, preventDefault() {}, target: target({ base: control, note }) });
    },
    modifier(pointerId, offset) {
      dispatch('pointerdown', { button: 0, pointerId, preventDefault() {}, target: target({ shift: String(offset) }) });
    },
    release(pointerId) { dispatch('pointerup', { pointerId }); },
    cancel(pointerId) { dispatch('pointercancel', { pointerId }); },
    lostCapture(pointerId) { dispatch('lostpointercapture', { pointerId }); },
    move(pointerId) { dispatch('pointermove', { pointerId, clientX: 0, clientY: 0 }); },
    moveTo(pointerId, dataset, clientX, clientY) {
      hitTarget = dataset === null ? null : target(dataset);
      dispatch('pointermove', { pointerId, clientX, clientY });
    },
    mode(inputMode) { dispatch('click', { detail: 1, target: target({ inputMode }) }); },
    accessibleHole(hole) { dispatch('click', { detail: 0, target: target({ hole: String(hole) }) }); },
    clickStop() { dispatch('click', { detail: 1, target: target({ stop: '' }) }); },
    keyStop() {
      dispatch('keydown', { key: 'b', code: 'KeyB', preventDefault() {}, target: { closest: () => null, matches: () => false } });
    },
    resize(nextWidth, nextHeight) {
      window.innerWidth = nextWidth;
      window.innerHeight = nextHeight;
      windowListeners.get('resize')?.forEach(callback => callback());
    },
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

test('two-contact events sound all 19 game pitches and releasing the base silences a held modifier', async () => {
  const app = fixture({ mode: 'touch', maxTouches: 2 });
  for (const note of GAME_SCALE) {
    app.base(1, note.base);
    app.modifier(2, note.offset);
    await app.flush();
    assert.equal(app.state().fingerMidi, note.midi);
    assert.equal(app.audio.lastMidi, note.midi);
    assert.equal(app.state().twoTouch.contactCount, 2);
    assert.notEqual(app.audio.activeVoice, null);
    app.release(1);
    assert.equal(app.audio.activeVoice, null);
    assert.equal(app.state().twoTouch.midi, null);
    assert.equal(app.state().twoTouch.contactCount, 1);
    app.release(2);
  }
  assert.deepEqual(app.audio.notes, GAME_SCALE.map(note => note.midi));
});

test('rotated input hit testing uses viewport coordinates and sliding changes only the owning role', async () => {
  const app = fixture({ mode: 'touch', maxTouches: 2 });
  assert.equal(app.layoutStyles.get('--play-width'), '844px');
  assert.equal(app.layoutStyles.get('--play-height'), '390px');
  assert.equal(app.layoutStyles.get('--play-angle'), '90deg');
  app.base(1, 'L');
  app.modifier(2, -3);
  await app.flush();
  assert.equal(app.state().fingerMidi, 71);

  app.moveTo(2, { shift: '3' }, 42, 602);
  await app.flush();
  assert.deepEqual(app.hitTests.at(-1), [42, 602]);
  assert.equal(app.state().fingerMidi, 77);
  app.moveTo(2, { base: 'X' }, 300, 400);
  await app.flush();
  assert.equal(app.state().twoTouch.control, 'L');
  assert.equal(app.state().fingerMidi, 74);
  app.moveTo(2, { shift: '3' }, 42, 602);
  app.moveTo(1, { base: 'X' }, 300, 400);
  await app.flush();
  assert.equal(app.state().fingerMidi, 89);
  app.release(2);
  await app.flush();
  assert.equal(app.state().fingerMidi, 86);
  app.moveTo(1, null, 2, 2);
  assert.equal(app.audio.activeVoice, null);
  app.moveTo(1, { base: 'R' }, 200, 200);
  await app.flush();
  assert.equal(app.state().fingerMidi, 77);
});

test('two-contact cancellation clears both roles and stale capture or move events cannot revive them', async () => {
  const app = fixture({ mode: 'touch', maxTouches: 2 });
  app.base(1, 'X');
  app.modifier(2, 3);
  await app.flush();
  assert.equal(app.state().fingerMidi, 89);
  app.cancel(2);
  assert.equal(app.audio.activeVoice, null);
  assert.equal(app.state().twoTouch.contactCount, 0);
  app.moveTo(1, { base: 'L' }, 140, 250);
  app.moveTo(2, { shift: '-3' }, 20, 90);
  app.lostCapture(1);
  app.release(2);
  await app.flush();
  assert.equal(app.audio.activeVoice, null);
  assert.deepEqual(app.audio.notes, [89]);
});

test('releasing an older base pointer preserves the newer two-contact voice', async () => {
  const app = fixture({ mode: 'touch', maxTouches: 2 });
  app.base(1, 'L');
  await app.flush();
  app.base(2, 'Y');
  await app.flush();
  const latestVoice = app.audio.activeVoice;
  app.release(1);
  app.lostCapture(1);
  await app.flush();
  assert.equal(app.audio.activeVoice, latestVoice);
  assert.equal(app.state().fingerMidi, 83);
  app.release(2);
  assert.equal(app.audio.activeVoice, null);
});

test('the B button and keyboard B both stop held base and modifier contacts', async () => {
  const app = fixture({ mode: 'touch', maxTouches: 2 });
  for (const stop of [app.clickStop, app.keyStop]) {
    app.base(1, 'A');
    app.modifier(2, 1);
    await app.flush();
    assert.equal(app.state().fingerMidi, 82);
    stop();
    assert.equal(app.audio.activeVoice, null);
    assert.equal(app.state().twoTouch.contactCount, 0);
    app.release(1);
    app.release(2);
    await app.flush();
    assert.equal(app.audio.activeVoice, null);
  }
});

test('stopping a two-contact gesture while audio unlocks prevents delayed playback', async () => {
  let resolve;
  const app = fixture({ mode: 'touch', maxTouches: 2, unlock: new Promise(done => { resolve = done; }) });
  app.base(1, 'L');
  app.modifier(2, -3);
  app.clickStop();
  resolve();
  await app.flush();
  await app.tick(100);
  assert.equal(app.audio.activeVoice, null);
  assert.deepEqual(app.audio.notes, []);
});

test('a viewport change clears held notes and avoids rotating native landscape twice', async () => {
  const app = fixture({ mode: 'touch', maxTouches: 2 });
  app.base(1, 'R');
  app.modifier(2, 2);
  await app.flush();
  app.resize(844, 390);
  assert.equal(app.audio.activeVoice, null);
  assert.equal(app.state().twoTouch.contactCount, 0);
  assert.equal(app.layoutStyles.get('--play-angle'), '0deg');
  assert.equal(app.layoutStyles.get('--play-width'), '844px');
  app.moveTo(1, { base: 'X' }, 720, 180);
  await app.flush();
  assert.equal(app.audio.activeVoice, null);
});
