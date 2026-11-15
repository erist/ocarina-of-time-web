// Single-voice listening arrangements. Each token is a concert pitch and an
// optional duration in quarter-note beats. A dash is a rest. See docs/sources.md.
const lullabyVerse = 'B4:2 D5 A4:2 G4:.5 A4:.5 B4:2 D5 A4:3 B4:2 D5 A5:2 G5';
const ranchVerse = 'D6:.5 B5:.5 A5:2 D6:.5 B5:.5 A5:2 D6:.5 B5:.5 A5 B5 A5:3 F#5 F5 F#5';
const ranchBridge = 'Bb5:.5 Bb5:.5 Bb5 Bb5 Bb5 C6 Bb5 Bb5:.5 A5:.5 A5 C6 F5:3 G5:.5 G5:.5 G5 G5 G5 A5 Bb5 A5:6';
const woodsVerse = 'F5:.5 A5:.5 B5 F5:.5 A5:.5 B5 F5:.5 A5:.5 B5:.5 E6:.5 D6 B5:.5 C6:.5';
const woodsBridge = 'D5:.5 E5:.5 F5 G5:.5 A5:.5 B5 C6:.5 B5:.5 E5:3';
const windmillVerse = 'D5:.25 F5:.25 D6 D5:.25 F5:.25 D6 E6:.75 F6:.25 E6:.25 F6:.25 E6:.25 C6:.25 A5';
const windmillAnswer = 'A5:.5 D5:.5 F5:.25 G5:.25';
const templeVerse = 'A5 D5:2 F5 A5 D5:2 F5 A5:.5 C6:.5 B5 G5 F5:.5 G5:.5 A5 D5 C5:.5 E5:.5 D5:4';
const minuetCall = 'D5:.5 D6:.5 B5:2 A5:.5 B5:.5 A5:2';
const boleroCall = 'F5:.25 D5:.25 F5:.25 D5:.25 A5:.25 F5:.25 A5:.25 F5:.25 -';
const serenadeCall = 'D5 F5 A5 A5 B5:2';
const requiemCall = 'D5 F5:.5 D5:.5 A5 F5 D5:4';
const nocturneCall = 'B5 A5 A5:.5 D5:.5 B5:.5 A5:.5 F5:4';
const preludeCall = 'D6:.5 A5:1.5 D6:.5 A5:.5 B5:.5 D6:4.5';

const arrangements = {
  zelda: { bpm: 109, phrases: [
    lullabyVerse, 'D5:2 C5:.5 B4:.5 A4:3',
    lullabyVerse, 'D6:6',
    'D6:2 C6:.5 B5:.5 C6:.5 B5:.5 G5:2 C6:2 B5:.5 A5:.5 B5:.5 A5:.5 E5:2',
    'D6:2 C6:.5 B5:.5 C6:.5 B5:.5 G5 C6 G6:6',
  ] },
  time: { bpm: 68, phrases: [
    templeVerse, templeVerse,
    'D5:.5 C5:.5 E5 C5 E5:.5 F5:.5 D5:4',
    'D5:.5 C5:.5 E5 C5 F5:.5 G5:.5 D5:4',
    'A5:.5 C6:.5 B5 C6 A5 C6 G5 A5 D5:.5 C5:.5 E5 D5:3',
    'F5:.5 G5:.5 F5 G5 E5:.5 C5:.5 F5 E5 D5:4',
  ] },
  sun: { bpm: 140, phrases: [
    'A5:.5 F5:.5 D6:.5 - A5:.5 F5:.5 D6:.5 -',
    '-:.25 A5:.25 C6:.25 D6:.25 E6:.25 F6:.25 G6:2',
  ] },
  storm: { bpm: 100, phrases: [
    windmillVerse, windmillAnswer, 'A5:1.5', windmillAnswer, 'E5:1.5',
    windmillVerse, windmillAnswer, 'A5 A5:.5 D5:3',
  ] },
  epona: { bpm: 85, phrases: [
    ranchVerse, 'C#6:.5 D6:.5 B5:2 D6:2 D6 C#6:.5 B5:.5 A5:2',
    ranchVerse, 'B5:.5 C#6:.5 D6:2 D6:2 E6 D6:3',
    ranchBridge, ranchBridge,
  ] },
  saria: { bpm: 140, phrases: [
    woodsVerse, 'B5:.5 G5:.5 E5:2.5 D5:.5 E5:.5 G5:.5 E5:3',
    woodsVerse, 'E6:.5 B5:.5 G5:2.5 B5:.5 G5:.5 D5:.5 E5:3',
    woodsBridge, 'F5:.5 G5:.5 A5 B5:.5 C6:.5 D6 E6:.5 F6:.5 G6:3',
    woodsBridge, 'F5:.5 E5:.5 A5:.5 G5:.5 B5:.5 A5:.5 C6:.5 B5:.5',
    'D6:.5 C6:.5 E6:.5 D6:.5 F6:.5 E6:.25 D6:.5 C6:.25 E6:4',
  ] },
  minuet: { bpm: 100, phrases: [minuetCall, minuetCall,
    'E5:.5 A5:.5 G5 A5 G5:1/3 A5:1/3 G5:1/3 F#5:2 E5:6',
  ] },
  bolero: { bpm: 62, phrases: [boleroCall, boleroCall,
    'G5:.25 E5:.25 G5:.25 E5:.25 Bb5:.25 G5:.25 Bb5:.25 G5:.25 -',
    'A4:.25 F4:.25 A4:.25 F4:.25 D5:.25 A4:.25 D5:.25 A4:.25 F5:.25 D5:.25 F5:.25 D5:.25',
    'A5:.25 E5:.25 A5:.25 E5:.25 G5:.25 C#5:.25 G5:.25 C#5:.25 F5:.3 A4:.3 F4:.3 E4:.3 D4:3',
  ] },
  serenade: { bpm: 90, phrases: [serenadeCall, serenadeCall,
    'A5 D5 F5 G5:.5 F5:.5 E5 G5 F#5:6',
  ] },
  requiem: { bpm: 80, phrases: [requiemCall, requiemCall,
    'D5:1.15 F5:.6 D5:.6 A5:1.25 F5:1.4 D5:6',
  ] },
  nocturne: { bpm: 90, phrases: [nocturneCall, nocturneCall,
    'G5 F5 F5:.5 C5:.5 G5:.5 F5:.5 Ab5 Gb5 Gb5:.5 Db5:.5 Ab5:.5 Gb5:.5 F5:8',
  ] },
  prelude: { bpm: 115, phrases: [preludeCall, preludeCall,
    'E5 G5 B5 D6 Eb5 G5 Bb5 D6',
    '- D3:.5 F#3:.5 A3:.5 D4:.5 F#4:.5 A4:.5 D5:.5 F#5:.5 A5:.5 C#6:.5 D6:2',
  ] },
};

const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function fullMelodySequence(songId, octave = 0) {
  const arrangement = arrangements[songId];
  if (!arrangement) return [];
  return arrangement.phrases.flatMap(phrase => phrase.split(' ').map(token => {
    const [pitch, duration = '1'] = token.split(':');
    const [count, divisor = '1'] = duration.split('/');
    const beats = Number(count) / Number(divisor) * 100 / arrangement.bpm;
    if (pitch === '-') return { midi: null, beats };
    const [, note, accidental, register] = /^([A-G])([#b]?)(\d)$/.exec(pitch);
    const alteration = { '#': 1, b: -1, '': 0 }[accidental];
    const midi = (Number(register) + 1) * 12 + semitones[note] + alteration;
    return { midi: midi + octave, beats };
  }));
}
