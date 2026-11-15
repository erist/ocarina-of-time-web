import { NOTES } from './songs.js?v=20261114-button-audio';

// Seconds in Nintendo's published in-game phrases.
const attacks = {
  zelda: [.050, .903, 1.337, 2.616, 3.458, 3.889],
  time: [.052, .592, 1.680, 2.249, 2.788, 3.876],
  sun: [.051, .268, .520, 1.153, 1.382, 1.622],
  storm: [.058, .208, .421, 1.185, 1.334, 1.547],
  epona: [.049, .430, .754, 2.235, 2.616, 2.956],
  saria: [.049, .314, .593, 1.147, 1.416, 1.702],
  minuet: [.061, .391, .696, 2.019, 2.340, 2.668],
  bolero: [.060, .329, .597, .867, 1.138, 1.418, 1.691, 1.959],
  serenade: [.060, .656, 1.253, 1.859, 2.464],
  requiem: [.057, .810, 1.184, 1.551, 2.303, 3.058],
  nocturne: [.060, .674, 1.296, 1.596, 1.920, 2.207, 2.530],
  prelude: [.066, .318, 1.098, 1.351, 1.612, 1.863],
};

// End of each pitched note, including its release. The recording can continue
// with silence or reverb beyond the sixth marker.
const releases = {
  time: [.550, 1.660, 2.200, 2.745, 3.845, 5.550],
  epona: [.420, .745, 2.170, 2.605, 2.947, 5.500],
};

const referenceBeat = 60 / 100;
const shortNoteSeconds = .35;

/**
 * Each step spans either a sounding note or a rest. A rest clears the current
 * score highlight. All songs use the manual instrument's pitches.
 */
export function songPlaybackSequence(song, octave = 0) {
  const starts = attacks[song.id];
  const ends = releases[song.id];
  return song.notes.flatMap((id, noteIndex) => {
    const last = noteIndex === song.notes.length - 1;
    const spacing = starts && !last ? starts[noteIndex + 1] - starts[noteIndex] : referenceBeat;
    let duration = Math.min(shortNoteSeconds, spacing);
    if (ends) duration = ends[noteIndex] - starts[noteIndex];
    else if (song.id === 'zelda' && !last) duration = spacing;
    const note = { midi: NOTES[id].midi + octave, beats: duration / referenceBeat, noteIndex };
    // Measured phrases already have explicit rests between note releases/attacks.
    if (ends) note.sustainToEnd = true;
    return !last && spacing > duration
      ? [note, { midi: null, beats: (spacing - duration) / referenceBeat, noteIndex: -1 }]
      : [note];
  });
}
