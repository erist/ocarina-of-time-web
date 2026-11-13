/**
 * Display timing measured from Nintendo's public short phrase recordings.
 * Times are seconds in each original MP3, not tempo-quantized note lengths.
 * These approximately 10–30 ms attack/release markers only animate the score;
 * the original recording itself supplies the audible rhythm and timbre.
 */
const measurements = {
  zelda: { duration: 5.640, starts: [.050, .903, 1.337, 2.616, 3.458, 3.889], ends: [.875, 1.290, 2.420, 3.405, 3.850, 5.580] },
  time: { duration: 5.664, starts: [.052, .592, 1.680, 2.249, 2.788, 3.876], ends: [.550, 1.660, 2.200, 2.745, 3.845, 5.550] },
  sun: { duration: 3.624, starts: [.051, .268, .520, 1.153, 1.382, 1.622], ends: [.240, .445, .880, 1.360, 1.555, 1.980] },
  storm: { duration: 4.560, starts: [.058, .208, .421, 1.185, 1.334, 1.547], ends: [.198, .411, 1.175, 1.324, 1.537, 3.410] },
  epona: { duration: 5.640, starts: [.049, .430, .754, 2.235, 2.616, 2.956], ends: [.420, .745, 2.170, 2.605, 2.947, 5.500] },
  saria: { duration: 4.440, starts: [.049, .314, .593, 1.147, 1.416, 1.702], ends: [.190, .460, 1.010, 1.300, 1.580, 4.200] },
  minuet: { duration: 5.712, starts: [.061, .391, .696, 2.019, 2.340, 2.668], ends: [.380, .680, 1.100, 2.330, 2.560, 3.420] },
  bolero: { duration: 4.392, starts: [.060, .329, .597, .867, 1.138, 1.418, 1.691, 1.959], ends: [.319, .587, .857, 1.128, 1.408, 1.681, 1.949, 3.200] },
  serenade: { duration: 4.872, starts: [.060, .656, 1.253, 1.859, 2.464], ends: [.646, 1.080, 1.849, 2.454, 3.080] },
  requiem: { duration: 6.048, starts: [.057, .810, 1.184, 1.551, 2.303, 3.058], ends: [.790, 1.174, 1.530, 2.260, 2.980, 4.060] },
  nocturne: { duration: 4.992, starts: [.060, .674, 1.296, 1.596, 1.920, 2.207, 2.530], ends: [.440, 1.250, 1.580, 1.905, 2.195, 2.510, 3.020] },
  prelude: { duration: 4.200, starts: [.066, .318, 1.098, 1.351, 1.612, 1.863], ends: [.308, 1.030, 1.341, 1.602, 1.840, 2.500] },
};

export const SONG_PERFORMANCES = Object.freeze(Object.fromEntries(
  Object.entries(measurements).map(([id, performance]) => [id, Object.freeze({
    ...performance,
    starts: Object.freeze(performance.starts),
    ends: Object.freeze(performance.ends),
  })]),
));

/** Returns -1 in a rest, before the first attack, or after the final release. */
export function noteIndexAt(id, seconds) {
  const performance = SONG_PERFORMANCES[id];
  if (!performance || !Number.isFinite(seconds) || seconds < 0) return -1;
  return performance.starts.findIndex((start, index) => seconds >= start && seconds < performance.ends[index]);
}
