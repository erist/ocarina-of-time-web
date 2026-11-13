import test from 'node:test';
import assert from 'node:assert/strict';
import { TouchFingering } from '../app/touch-fingering.js';

function pressAll(model, holes) {
  holes.forEach(hole => model.press(hole, hole));
  return model.snapshot;
}

test('the nine contacts of D5 produce the official pitch and sorted holes', () => {
  const touch = new TouchFingering();
  const state = pressAll(touch, [12, 10, 7, 3, 2, 1, 9, 8, 11]);
  assert.deepEqual(state, {
    closed: [1, 2, 3, 7, 8, 9, 10, 11, 12], contactCount: 9, midi: 74,
  });
});

test('lifting fingers changes D5 through E5 to the seven-contact F5', () => {
  const touch = new TouchFingering();
  pressAll(touch, [1, 2, 3, 7, 8, 9, 10, 11, 12]);
  assert.equal(touch.release(3).midi, 76);
  assert.deepEqual(touch.release(2), {
    closed: [1, 7, 8, 9, 10, 11, 12], contactCount: 7, midi: 77,
  });
});

test('two fingers sharing a hole keep it closed until both are released', () => {
  const touch = new TouchFingering();
  touch.press(100, 10);
  touch.press(101, 12);
  assert.equal(touch.press(102, 12).midi, 86);
  assert.equal(touch.snapshot.contactCount, 3);
  assert.deepEqual(touch.release(101).closed, [10, 12]);
  assert.equal(touch.snapshot.midi, 86);
  assert.equal(touch.release(102).midi, 88);
  assert.equal(touch.release(100).midi, null);
});

test('sliding moves one owned contact rather than adding phantom fingers', () => {
  const touch = new TouchFingering();
  touch.press(1, 10);
  touch.press(2, 11);
  assert.equal(touch.move(2, 12).midi, 86);
  assert.deepEqual(touch.snapshot.closed, [10, 12]);
  assert.equal(touch.snapshot.contactCount, 2);
  assert.equal(touch.move(2, null).midi, 88);
  assert.equal(touch.snapshot.contactCount, 2);
  assert.equal(touch.move(1, null).midi, null);
  assert.deepEqual(touch.snapshot.closed, []);
  assert.equal(touch.snapshot.contactCount, 2);
  assert.equal(touch.move(2, 10).midi, 88);
});

test('unsupported chords and an entirely released instrument are silent', () => {
  const touch = new TouchFingering();
  assert.equal(touch.snapshot.midi, null);
  assert.equal(touch.press(1, 1).midi, null);
  assert.equal(touch.press(2, 12).midi, null);
  touch.release(1);
  assert.equal(touch.release(2).midi, null);
});

test('cancellation and mode changes clear all contacts without stale moves reviving them', () => {
  const touch = new TouchFingering();
  pressAll(touch, [7, 10, 11, 12]);
  assert.equal(touch.snapshot.midi, 83);
  assert.deepEqual(touch.clear(), { closed: [], contactCount: 0, midi: null });
  assert.deepEqual(touch.move(7, 10), { closed: [], contactCount: 0, midi: null });
  assert.deepEqual(touch.release(7), { closed: [], contactCount: 0, midi: null });
});

test('invalid hole input cannot alter an existing valid fingering', () => {
  const touch = new TouchFingering();
  pressAll(touch, [10, 12]);
  for (const hole of [0, 13, 1.5, '10', undefined, NaN]) {
    assert.throws(() => touch.press(99, hole), RangeError);
    assert.throws(() => touch.move(10, hole), RangeError);
  }
  assert.throws(() => touch.press(99, null), RangeError);
  assert.deepEqual(touch.snapshot, { closed: [10, 12], contactCount: 2, midi: 86 });
});

test('returned snapshots cannot mutate live contacts and older snapshots remain stable', () => {
  const touch = new TouchFingering();
  const before = touch.press(10, 10);
  assert.throws(() => before.closed.push(12), TypeError);
  const after = touch.press(12, 12);
  assert.deepEqual(before, { closed: [10], contactCount: 1, midi: 88 });
  assert.deepEqual(after, { closed: [10, 12], contactCount: 2, midi: 86 });
});
