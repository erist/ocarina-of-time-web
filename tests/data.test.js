import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTES, SONGS, SCARECROW } from '../app/songs.js';
import { SONG_PERFORMANCES, noteIndexAt } from '../app/song-performance.js';
import { HOLES, FINGERINGS, getFingering, getMidiForHoles } from '../app/fingering.js';

// Regression fixtures for the short learned game inputs, not full arrangements.
const gameCommands = {
  zelda: [83, 86, 81, 83, 86, 81],
  time: [81, 74, 77, 81, 74, 77],
  sun: [81, 77, 86, 81, 77, 86],
  storm: [74, 77, 86, 74, 77, 86],
  epona: [86, 83, 81, 86, 83, 81],
  saria: [77, 81, 83, 77, 81, 83],
  minuet: [74, 86, 83, 81, 83, 81],
  bolero: [77, 74, 77, 74, 81, 77, 81, 77],
  serenade: [74, 77, 81, 81, 83],
  requiem: [74, 77, 74, 81, 77, 74],
  nocturne: [83, 81, 81, 74, 83, 81, 77],
  prelude: [86, 81, 86, 81, 83, 86],
};

test('all twelve learned songs are present exactly once, with six warp destinations', () => {
  assert.equal(SONGS.length, 12);
  assert.deepEqual(SONGS.map(song => song.id).sort(), Object.keys(gameCommands).sort());
  const warps = SONGS.filter(song => song.category === 'warp');
  assert.equal(warps.length, 6);
  assert.ok(warps.every(song => song.destination?.length));
});

test('the five game controls retain D5, F5, A5, B5, and D6 pitches', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(NOTES).map(([id, note]) => [id, note.midi])), {
    D: 74, F: 77, A: 81, B: 83, d: 86,
  });
});

test('each song plays the canonical short game command in the correct order', () => {
  for (const song of SONGS) {
    assert.deepEqual(song.notes.map(note => NOTES[note]?.midi), gameCommands[song.id], song.id);
    const performance = SONG_PERFORMANCES[song.id];
    assert.equal(performance.starts.length, song.notes.length, song.id);
    assert.equal(performance.ends.length, song.notes.length, song.id);
    performance.starts.forEach((start, index) => {
      assert.ok(start >= 0 && performance.ends[index] > start);
      assert.ok(performance.ends[index] <= (performance.starts[index + 1] ?? performance.duration));
      assert.equal(noteIndexAt(song.id, start), index);
      assert.equal(noteIndexAt(song.id, performance.ends[index]), -1);
    });
    assert.equal(noteIndexAt(song.id, performance.duration), -1);
  }
});

test('each list entry has an effect and its own official score and recording', () => {
  for (const song of SONGS) {
    assert.ok(song.title && song.en && song.effect, song.id);
    const score = new URL(song.officialScore);
    const audio = new URL(song.officialAudio);
    assert.equal(score.origin, 'https://www.nintendo.com');
    assert.equal(audio.origin, 'https://www.nintendo.com');
    assert.ok(score.pathname.endsWith(`/score_${song.id}.webp`), song.id);
    assert.ok(audio.pathname.endsWith(`/melody_${song.id}.mp3`), song.id);
  }
});

test('the custom scarecrow song requires eight notes instead of a fabricated fixed score', () => {
  assert.equal(SCARECROW.length, 8);
  assert.equal(SCARECROW.notes, undefined);
  assert.ok(SCARECROW.help.includes('정해진 악보가 없어요'));
});

test('all 25 merchandise fingerings round-trip even when hole order is reversed', () => {
  assert.equal(FINGERINGS.length, 25);
  assert.deepEqual(FINGERINGS.map(fingering => fingering.midi), Array.from({ length: 25 }, (_, i) => i + 69));
  for (const fingering of FINGERINGS) {
    assert.deepEqual(getFingering(fingering.midi).closed, fingering.closed);
    assert.equal(getMidiForHoles([...fingering.closed].reverse()), fingering.midi, fingering.label);
    assert.equal(getMidiForHoles(new Set(fingering.closed)), fingering.midi, fingering.label);
  }
});

test('all game pitches have a valid 12-hole fingering and front/rear placement', () => {
  assert.equal(HOLES.length, 12);
  assert.deepEqual(HOLES.map(hole => hole.id).sort((a, b) => a - b), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.equal(HOLES.filter(hole => hole.back).length, 2);
  for (const note of Object.values(NOTES)) {
    const fingering = getFingering(note.midi);
    assert.ok(fingering, note.pitch);
    assert.equal(getMidiForHoles(fingering.closed), note.midi);
  }
});

test('unrecognized or invalid holes stay silent instead of producing a nearby note', () => {
  for (const invalid of [[1], [1, 12], [0], [13], [-1], [1.5], ['1'], [NaN], null, undefined, 12, {}]) {
    assert.equal(getMidiForHoles(invalid), null, String(invalid));
  }
  assert.equal(getFingering(68), null);
  assert.equal(getFingering(94), null);
});

test('official alternate D-sharp fingerings keep the same sounding pitches', () => {
  assert.equal(getMidiForHoles([1, 2, 4, 7, 8, 9, 10, 11, 12]), 75);
  assert.equal(getMidiForHoles([3, 12]), 87);
  assert.equal(getMidiForHoles([12]), 87);
});
