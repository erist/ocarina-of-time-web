import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePlayLayout } from '../app/play-layout.js';

test('a portrait-locked phone gets a landscape canvas in either holding direction', () => {
  assert.deepEqual(resolvePlayLayout(390, 844, 'right'), {
    width: 844, height: 390, rotation: 90, landscape: true,
  });
  assert.deepEqual(resolvePlayLayout(390, 844, 'left'), {
    width: 844, height: 390, rotation: -90, landscape: true,
  });
});

test('native landscape never receives a second quarter turn', () => {
  for (const mode of ['auto', 'left', 'right']) {
    assert.deepEqual(resolvePlayLayout(844, 390, mode), {
      width: 844, height: 390, rotation: 0, landscape: true,
    });
  }
});

test('automatic mode preserves portrait and resizing recomputes usable canvas dimensions', () => {
  assert.deepEqual(resolvePlayLayout(390, 844), {
    width: 390, height: 844, rotation: 0, landscape: false,
  });
  assert.deepEqual(resolvePlayLayout(390, 720, 'right'), {
    width: 720, height: 390, rotation: 90, landscape: true,
  });
});

test('invalid viewport or mode data cannot create an unusable transformed canvas', () => {
  for (const dimensions of [[0, 390], [390, -1], [NaN, 390], [390, Infinity]]) {
    assert.throws(() => resolvePlayLayout(...dimensions), RangeError);
  }
  assert.throws(() => resolvePlayLayout(390, 844, 'upside-down'), RangeError);
});
