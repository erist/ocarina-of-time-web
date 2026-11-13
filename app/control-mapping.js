// Normal (two-hand) controls, checked against Nintendo's 2026 game captures.
// There are five basic pitches. B stops playing; it is not a sixth pitch.
import { FINGERINGS } from './fingering.js';

export const CONTROL_NOTES = Object.freeze({
  D: Object.freeze({ id: 'D', midi: 74, label: '레', pitch: 'D5', control: 'L' }),
  F: Object.freeze({ id: 'F', midi: 77, label: '파', pitch: 'F5', control: 'R' }),
  A: Object.freeze({ id: 'A', midi: 81, label: '라', pitch: 'A5', control: 'A' }),
  B: Object.freeze({ id: 'B', midi: 83, label: '시', pitch: 'B5', control: 'Y' }),
  d: Object.freeze({ id: 'd', midi: 86, label: '높은 레', pitch: 'D6', control: 'X' }),
});
export const STOP_CONTROL = 'B';
export const CONTROL_ORDER = Object.freeze(['L', 'R', 'X', 'Y', 'A', 'B']);

export function controlForNote(id) {
  return CONTROL_NOTES[id]?.control ?? '';
}

export function controlForMidi(midi) {
  return Object.values(CONTROL_NOTES).find(note => note.midi === midi)?.control ?? '';
}

// The user's supplied controller fingering chart: gray arrows are the left
// stick (two semitones), yellow triangles are D-pad input (one semitone).
const controllerScale = [
  [71, 'L', -3, ['L', 'L 스틱 ↓', '십자키 ↓']],
  [72, 'L', -2, ['L', 'L 스틱 ↓']],
  [73, 'L', -1, ['L', 'L 스틱 ↓', '십자키 ↑']],
  [74, 'L', 0, ['L']],
  [75, 'L', 1, ['L', '십자키 ↑']],
  [76, 'R', -1, ['R', '십자키 ↓']],
  [77, 'R', 0, ['R']],
  [78, 'R', 1, ['R', '십자키 ↑']],
  [79, 'A', -2, ['A', 'L 스틱 ↓']],
  [80, 'A', -1, ['A', 'L 스틱 ↓', '십자키 ↑']],
  [81, 'A', 0, ['A']],
  [82, 'A', 1, ['A', '십자키 ↑']],
  [83, 'Y', 0, ['Y']],
  [84, 'Y', 1, ['Y', '십자키 ↑']],
  [85, 'Y', 2, ['Y', 'L 스틱 ↑']],
  [86, 'X', 0, ['X']],
  [87, 'X', 1, ['X', '십자키 ↑']],
  [88, 'X', 2, ['X', 'L 스틱 ↑']],
  [89, 'X', 3, ['X', 'L 스틱 ↑', '십자키 ↑']],
];

export const GAME_SCALE = Object.freeze(controllerScale.map(([midi, base, offset, controllerParts]) => {
  const fingering = FINGERINGS.find(item => item.midi === midi);
  return Object.freeze({
    midi,
    label: fingering.label,
    pitch: fingering.label.split(' · ')[1],
    base,
    offset,
    controllerParts: Object.freeze(controllerParts),
    closed: Object.freeze([...fingering.closed]),
  });
}));

export function gameNoteForMidi(midi) {
  return GAME_SCALE.find(note => note.midi === midi) ?? null;
}

export const SCALE_GUIDE = Object.freeze(FINGERINGS.map(fingering => Object.freeze({
  midi: fingering.midi,
  label: fingering.label,
  control: controlForMidi(fingering.midi),
  game: gameNoteForMidi(fingering.midi),
  closed: Object.freeze([...fingering.closed]),
  front: Object.freeze(fingering.closed.filter(hole => hole <= 10)),
  back: Object.freeze(fingering.closed.filter(hole => hole >= 11)),
  electronicExtension: fingering.midi >= 90,
})));
