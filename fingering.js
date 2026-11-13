// Positions and finger combinations were checked against HORI NSX-261's
// 2026-11-05 manual, pages 3, 6 and 7. Coordinates are an original web drawing.
// Front: pointed end left, mouthpiece upper right. Rear holes have their own row.
export const HOLES = [
  { id: 1, x: 49, y: 41 },
  { id: 2, x: 39, y: 50 },
  { id: 3, x: 28, y: 59 },
  { id: 4, x: 17, y: 66 },
  { id: 5, x: 44, y: 61, small: true },
  { id: 6, x: 73, y: 56, small: true },
  { id: 7, x: 86, y: 62 },
  { id: 8, x: 74, y: 69 },
  { id: 9, x: 63, y: 77 },
  { id: 10, x: 52, y: 83, small: true },
  { id: 11, x: 36, y: 96, back: true },
  { id: 12, x: 64, y: 96, back: true },
];

// MIDI numbers represent sounding pitch (alto C register), not the octave-
// transposed staff notation used in the merchandise's printed fingering chart.
// Closed means touching a hole; the mouthpiece gates sound separately.
export const FINGERINGS = [
  { midi: 69, label: '낮은 라 · A4', closed: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { midi: 70, label: '낮은 라♯ · A♯4', closed: [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12] },
  { midi: 71, label: '낮은 시 · B4', closed: [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12] },
  { midi: 72, label: '도 · C5', closed: [1, 2, 3, 4, 7, 8, 9, 10, 11, 12] },
  { midi: 73, label: '도♯ · C♯5', closed: [1, 2, 3, 5, 7, 8, 9, 10, 11, 12] },
  { midi: 74, label: '레 · D5', closed: [1, 2, 3, 7, 8, 9, 10, 11, 12] },
  { midi: 75, label: '레♯ · D♯5', closed: [1, 2, 5, 7, 8, 9, 10, 11, 12] },
  { midi: 76, label: '미 · E5', closed: [1, 2, 7, 8, 9, 10, 11, 12] },
  { midi: 77, label: '파 · F5', closed: [1, 7, 8, 9, 10, 11, 12] },
  { midi: 78, label: '파♯ · F♯5', closed: [3, 7, 8, 9, 10, 11, 12] },
  { midi: 79, label: '솔 · G5', closed: [7, 8, 9, 10, 11, 12] },
  { midi: 80, label: '솔♯ · G♯5', closed: [3, 7, 8, 10, 11, 12] },
  { midi: 81, label: '라 · A5', closed: [7, 8, 10, 11, 12] },
  { midi: 82, label: '라♯ · A♯5', closed: [3, 7, 10, 11, 12] },
  { midi: 83, label: '시 · B5', closed: [7, 10, 11, 12] },
  { midi: 84, label: '높은 도 · C6', closed: [10, 11, 12] },
  { midi: 85, label: '높은 도♯ · C♯6', closed: [3, 10, 12] },
  { midi: 86, label: '높은 레 · D6', closed: [10, 12] },
  { midi: 87, label: '높은 레♯ · D♯6', closed: [3, 10] },
  { midi: 88, label: '높은 미 · E6', closed: [10] },
  { midi: 89, label: '높은 파 · F6', closed: [] },
  // The following four combinations are the electronic model's own extension.
  { midi: 90, label: '높은 파♯ · F♯6', closed: [4] },
  { midi: 91, label: '높은 솔 · G6', closed: [2, 3, 4] },
  { midi: 92, label: '높은 솔♯ · G♯6', closed: [1, 2, 3] },
  { midi: 93, label: '높은 라 · A6', closed: [2, 3] },
];

function combinationKey(closed) {
  const ids = [...new Set(closed)];
  if (ids.some(id => !Number.isInteger(id) || id < 1 || id > 12)) return null;
  return ids.sort((a, b) => a - b).join(',');
}

const pitchesByHoles = new Map(FINGERINGS.map(item => [combinationKey(item.closed), item.midi]));
// Additional official D♯ / E♭ combinations, including the firmware update's
// alternative. The preferred fingering remains the first one in FINGERINGS.
pitchesByHoles.set(combinationKey([1, 2, 4, 7, 8, 9, 10, 11, 12]), 75);
pitchesByHoles.set(combinationKey([3, 12]), 87);
pitchesByHoles.set(combinationKey([12]), 87);

export function getFingering(midi) {
  return FINGERINGS.find(item => item.midi === midi) ?? null;
}

export function getMidiForHoles(closed) {
  if (!closed || typeof closed[Symbol.iterator] !== 'function') return null;
  const key = combinationKey(closed);
  return key === null ? null : (pitchesByHoles.get(key) ?? null);
}
