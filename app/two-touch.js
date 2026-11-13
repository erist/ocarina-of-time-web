export const MIN_MIDI = 71;
export const MAX_MIDI = 89;
export const BASE_CONTROLS = Object.freeze({ L: 74, R: 77, A: 81, Y: 83, X: 86 });

function validateControl(control) {
  if (!Object.hasOwn(BASE_CONTROLS, control)) {
    throw new RangeError('Base control must be L, R, A, Y, or X.');
  }
}

function validateOffset(offset) {
  if (!Number.isInteger(offset) || offset < -3 || offset > 3) {
    throw new RangeError('Pitch offset must be an integer from -3 to 3.');
  }
}

/**
 * A front-screen instrument requiring only one base contact and, optionally,
 * one pitch-modifier contact. Each pointer retains its role for its gesture.
 * Extra contacts have independent ownership and use newest-pressed priority.
 */
export class TwoTouchInstrument {
  constructor() {
    this.pointers = new Map();
    this._order = 0;
  }

  pressBase(pointerId, control) {
    validateControl(control);
    this.pointers.set(pointerId, { kind: 'base', control, active: true, order: ++this._order });
    return this.snapshot;
  }

  pressModifier(pointerId, offset) {
    validateOffset(offset);
    this.pointers.set(pointerId, { kind: 'modifier', offset, active: true, order: ++this._order });
    return this.snapshot;
  }

  move(pointerId, target) {
    const pointer = this.pointers.get(pointerId);
    // A move following cancellation/release must never recreate ownership.
    if (!pointer) return this.snapshot;
    if (target === null) {
      this.pointers.set(pointerId, { ...pointer, active: false });
      return this.snapshot;
    }
    if (!target || typeof target !== 'object') throw new TypeError('A move target must be a control, an offset, or null.');
    const hasControl = Object.hasOwn(target, 'control');
    const hasOffset = Object.hasOwn(target, 'offset');
    if (hasControl === hasOffset) throw new TypeError('A move target must contain exactly one control or offset.');
    if (hasControl) validateControl(target.control);
    else validateOffset(target.offset);
    // Crossing into the other role's area acts like leaving this pointer's
    // playable area; one finger cannot silently become both base and modifier.
    if ((pointer.kind === 'base') !== hasControl) {
      this.pointers.set(pointerId, { ...pointer, active: false });
    } else {
      this.pointers.set(pointerId, { ...pointer, ...target, active: true });
    }
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
    let base = null;
    let modifier = null;
    for (const pointer of this.pointers.values()) {
      if (!pointer.active) continue;
      if (pointer.kind === 'base' && (!base || pointer.order > base.order)) base = pointer;
      if (pointer.kind === 'modifier' && (!modifier || pointer.order > modifier.order)) modifier = pointer;
    }
    const control = base?.control ?? null;
    const offset = modifier?.offset ?? 0;
    return Object.freeze({
      midi: control === null ? null : Math.min(MAX_MIDI, Math.max(MIN_MIDI, BASE_CONTROLS[control] + offset)),
      control,
      offset,
      contactCount: this.pointers.size,
    });
  }
}
