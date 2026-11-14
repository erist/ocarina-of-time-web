import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, SCARECROW } from '../app/songs.js';
import { GAME_SCALE } from '../app/control-mapping.js';
import { FINGERINGS } from '../app/fingering.js';
import { localizedSong, localizedPitch, localizedControllerParts } from '../app/i18n-songs.js';

test('switching languages localizes every song without changing the playable sequence or artwork', () => {
  for (const song of [...SONGS, SCARECROW]) {
    const english = localizedSong(song, 'en');
    const japanese = localizedSong(english, 'ja');
    assert.equal(english.title, song.en);
    for (const entry of [english, japanese]) {
      assert.equal(entry.notes, song.notes);
      assert.equal(entry.id, song.id);
      assert.equal(entry.officialScore, song.officialScore);
      for (const key of ['title', 'effect', 'destination', 'help'].filter(key => song[key])) {
        assert.ok(entry[key]);
        assert.doesNotMatch(entry[key], /\p{Script=Hangul}/u);
      }
    }
    assert.deepEqual(localizedSong(japanese, 'ko'), song);
  }
  assert.equal(localizedSong(SONGS.find(song => song.id === 'prelude'), 'ja').title, '光のプレリュード');
});

test('custom songs retain saved notes and custom ID in each locale', () => {
  const saved = { id: 'custom', notes: ['D', 'A', 'F', 'd', 'F', 'D', 'A', 'B'] };
  for (const lang of ['ko', 'en', 'ja']) {
    const display = localizedSong(saved, lang);
    assert.equal(display.title, localizedSong(SCARECROW, lang).title);
    assert.equal(display.id, 'custom');
    assert.equal(display.notes, saved.notes);
    assert.ok(display.help);
  }
});

test('all scale labels preserve pitch and the directions of the controller movements', () => {
  for (const { midi, label } of FINGERINGS) {
    const pitch = label.split(' · ')[1];
    assert.equal(localizedPitch(midi, 'ko'), label);
    assert.equal(localizedPitch(midi, 'en'), pitch);
    assert.ok(localizedPitch(midi, 'ja').endsWith(` · ${pitch}`));
  }
  for (const gameNote of GAME_SCALE) {
    for (const lang of ['ko', 'en', 'ja']) {
      const parts = localizedControllerParts(gameNote, lang);
      assert.equal(parts[0], gameNote.base);
      assert.deepEqual(parts.slice(1).map(p => p.at(-1)), gameNote.controllerParts.slice(1).map(p => p.at(-1)));
      if (lang !== 'ko') assert.doesNotMatch(parts.join(' + '), /\p{Script=Hangul}/u);
    }
  }
});
