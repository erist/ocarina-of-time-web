export const PLAY_LAYOUT_MODES = Object.freeze(['auto', 'left', 'right']);

/**
 * Resolve a landscape playing canvas inside a portrait-locked browser.
 * This changes page geometry, not the device/OS orientation lock. A viewport
 * already in landscape needs no extra rotation, even with a saved direction.
 */
export function resolvePlayLayout(width, height, mode = 'auto') {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Viewport dimensions must be positive finite numbers.');
  }
  if (!PLAY_LAYOUT_MODES.includes(mode)) {
    throw new RangeError('Unknown playing layout.');
  }
  const rotation = height > width && mode !== 'auto' ? (mode === 'right' ? 90 : -90) : 0;
  const canvasWidth = rotation ? height : width;
  const canvasHeight = rotation ? width : height;
  return Object.freeze({
    width: canvasWidth,
    height: canvasHeight,
    rotation,
    landscape: canvasWidth >= canvasHeight,
  });
}
