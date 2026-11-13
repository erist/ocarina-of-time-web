import test from 'node:test';
import assert from 'node:assert/strict';
import { TwoTouchInstrument, BASE_CONTROLS, MIN_MIDI, MAX_MIDI } from '../app/two-touch.js';

test('each base plays alone and a second contact adjusts pitch until released', () => {
  const instrument = new TwoTouchInstrument();
  for (const [control, midi] of Object.entries(BASE_CONTROLS)) {
    assert.equal(instrument.pressBase('base', control).midi, midi);
    assert.equal(instrument.pressModifier('modifier', -2).midi, midi - 2);
    assert.equal(instrument.move('modifier', { offset: 3 }).midi, midi + 3);
    assert.equal(instrument.release('modifier').midi, midi);
    assert.equal(instrument.release('base').midi, null);
  }
});

test('two contacts reach every semitone in the full B4 through F6 game range', () => {
  const instrument = new TwoTouchInstrument();
  const reachable = new Set();
  for (const control of Object.keys(BASE_CONTROLS)) {
    instrument.pressBase(1, control);
    for (let offset = -3; offset <= 3; offset++) {
      const state = instrument.pressModifier(2, offset);
      assert.equal(state.contactCount, 2);
      assert.ok(state.midi >= MIN_MIDI && state.midi <= MAX_MIDI);
      reachable.add(state.midi);
    }
  }
  assert.deepEqual([...reachable].sort((a, b) => a - b), Array.from({ length: 19 }, (_, index) => 71 + index));
});

test('a held modifier never sounds without a base and removing the base silences it', () => {
  const instrument = new TwoTouchInstrument();
  assert.deepEqual(instrument.pressModifier(2, -3), { midi: null, control: null, offset: -3, contactCount: 1 });
  assert.equal(instrument.pressBase(1, 'L').midi, 71);
  assert.equal(instrument.release(1).midi, null);
  assert.equal(instrument.move(2, { offset: 3 }).midi, null);
});

test('older base releases cannot stop a newer base, and releasing the newest restores an older held one', () => {
  const instrument = new TwoTouchInstrument();
  instrument.pressBase(1, 'L');
  instrument.pressBase(2, 'X');
  assert.equal(instrument.release(1).midi, 86);
  instrument.pressBase(3, 'A');
  assert.equal(instrument.release(3).midi, 86);
  assert.equal(instrument.release(2).midi, null);
});

test('modifier contacts have independent newest-pressed ownership', () => {
  const instrument = new TwoTouchInstrument();
  instrument.pressBase(1, 'A');
  instrument.pressModifier(2, -3);
  instrument.pressModifier(3, 2);
  assert.equal(instrument.release(2).midi, 83);
  instrument.pressModifier(4, -1);
  assert.equal(instrument.release(4).midi, 83);
  assert.equal(instrument.release(3).midi, 81);
});

test('sliding outside deactivates a contact, reentry retains its role, and released contacts stay gone', () => {
  const instrument = new TwoTouchInstrument();
  instrument.pressBase(1, 'L');
  instrument.pressModifier(2, 2);
  assert.equal(instrument.move(1, null).midi, null);
  assert.equal(instrument.move(1, { control: 'R' }).midi, 79);
  assert.equal(instrument.move(2, null).midi, 77);
  assert.equal(instrument.move(2, { offset: -1 }).midi, 76);
  assert.equal(instrument.move(1, { offset: 3 }).midi, null);
  assert.equal(instrument.move(1, { control: 'Y' }).midi, 82);
  instrument.clear();
  instrument.move(1, { control: 'X' });
  instrument.move(2, { offset: -3 });
  assert.deepEqual(instrument.snapshot, { midi: null, control: null, offset: 0, contactCount: 0 });
});

test('invalid controls and offsets cannot corrupt an active note', () => {
  const instrument = new TwoTouchInstrument();
  instrument.pressBase(1, 'A');
  for (const control of ['B', '', '__proto__', undefined]) assert.throws(() => instrument.pressBase(1, control), RangeError);
  for (const offset of [-4, 4, 0.5, NaN, '1', undefined]) assert.throws(() => instrument.pressModifier(2, offset), RangeError);
  assert.throws(() => instrument.move(1, { control: 'L', offset: 1 }), TypeError);
  assert.throws(() => instrument.move(1, {}), TypeError);
  assert.equal(instrument.snapshot.midi, 81);
  assert.equal(instrument.snapshot.contactCount, 1);
});

test('snapshots are immutable values, independent of subsequent contact changes', () => {
  const instrument = new TwoTouchInstrument();
  const first = instrument.pressBase(1, 'R');
  assert.ok(Object.isFrozen(first));
  assert.throws(() => { first.midi = 0; }, TypeError);
  instrument.pressModifier(2, 3);
  assert.equal(first.midi, 77);
  assert.equal(instrument.snapshot.midi, 80);
});
