import { getMidiForHoles } from './fingering.js';

function validateHole(hole, allowOutside = false) {
  if (allowOutside && hole === null) return;
  if (!Number.isInteger(hole) || hole < 1 || hole > 12) {
    throw new RangeError('A finger hole must be an integer from 1 to 12.');
  }
}

/**
 * Direct fingering state, independent of the DOM and audio lifecycle.
 * Each pointer owns its own contact, so overlapping fingers do not release
 * one another's holes. Moving outside all holes retains pointer ownership.
 */
export class TouchFingering {
  constructor() {
    this.pointers = new Map();
  }

  press(pointerId, hole) {
    validateHole(hole);
    this.pointers.set(pointerId, { hole });
    return this.snapshot;
  }

  move(pointerId, hole) {
    validateHole(hole, true);
    // An event received after cancellation must never resurrect a contact.
    if (this.pointers.has(pointerId)) this.pointers.set(pointerId, { hole });
    return this.snapshot;
  }

  release(pointerId) {
    this.pointers.delete(pointerId);
    return this.snapshot;
  }

  clear() {
    this.pointers.clear();
    return this.snapshot;
  }

  get snapshot() {
    const closed = [...new Set([...this.pointers.values()]
      .map(contact => contact.hole)
      .filter(hole => hole !== null))].sort((a, b) => a - b);
    return Object.freeze({
      closed: Object.freeze(closed),
      contactCount: this.pointers.size,
      // Empty contact sets are silence, not the instrument's all-open F6.
      midi: closed.length ? getMidiForHoles(closed) : null,
    });
  }
}
