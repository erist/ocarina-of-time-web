/**
 * Live instrument synthesis. No game recordings are bundled.
 * Harmonic magnitudes were measured from the public short-phrase recordings;
 * their quiet, pitch-dependent overtones replace the former generic waveform.
 * A synthesized live note is an approximation, not the original recording.
 */
const TONE_PROFILES = [
  { midi: 74, harmonics: [1, .0045, .0022, .0024, .0004, .0002, .0001], vibratoHz: 2.35, vibratoCents: 2.3 },
  { midi: 77, harmonics: [1, .0012, .0041, .0006, .0002, .0001, .0002], vibratoHz: 2.3, vibratoCents: 2.8 },
  { midi: 81, harmonics: [1, .0025, .008, .0004, .0008, .0001, .0002], vibratoHz: 3.2, vibratoCents: 2.2 },
  { midi: 83, harmonics: [1, .0021, .0201, .0005, .0013, .0001, .0002], vibratoHz: 8.9, vibratoCents: 1.7 },
  { midi: 86, harmonics: [1, .0167, .0125, .0041, .0022, .0007, .0005], vibratoHz: 7.7, vibratoCents: 8.0 },
];

export class OcarinaAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.volume = 0.65;
    this.lastMidi = null;
    this.activeVoice = null;
    this._voices = new Map();
    this._nextVoice = 0;
    this._generation = 0;
    this._timers = new Set();
    this._settlePlayback = null;
  }

  _initialize() {
    if (this.context && this.context.state !== 'closed') return;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) throw new Error('이 브라우저는 오디오 재생을 지원하지 않습니다.');
    this.context = new AudioContextClass({ latencyHint: 'interactive' });
    this.master = this.context.createGain();
    this.master.gain.value = this.volume * 0.42;
    this.master.connect(this.context.destination);
    this._waves = new Map(TONE_PROFILES.map(profile => [profile.midi, this.context.createPeriodicWave(
      new Float32Array(profile.harmonics.length + 1),
      new Float32Array([0, ...profile.harmonics]),
    )]));
  }

  /** Call directly from a tap/keyboard gesture, before awaiting other work. */
  async unlock() {
    this._initialize();
    if (this.context.state !== 'running') await this.context.resume();
    if (this.context.state !== 'running') {
      throw new Error('소리를 시작하려면 화면의 연주 버튼을 다시 눌러 주세요.');
    }
    return this.context;
  }

  setVolume(value) {
    if (!Number.isFinite(Number(value))) return;
    this.volume = Math.min(1, Math.max(0, Number(value)));
    if (this.master) {
      this.master.gain.setTargetAtTime(this.volume * 0.42, this.context.currentTime, 0.018);
    }
  }

  _createVoice(midi, at, duration = null) {
    const context = this.context;
    const id = ++this._nextVoice;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const vibrato = context.createOscillator();
    const vibratoDepth = context.createGain();
    const profile = TONE_PROFILES.reduce((nearest, candidate) =>
      Math.abs(candidate.midi - midi) < Math.abs(nearest.midi - midi) ? candidate : nearest);
    oscillator.setPeriodicWave(this._waves.get(profile.midi));
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    vibrato.frequency.value = profile.vibratoHz;
    vibratoDepth.gain.setValueAtTime(0, at);
    vibratoDepth.gain.linearRampToValueAtTime(profile.vibratoCents, at + 0.2);
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(oscillator.detune);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(0.9, at + 0.012);
    envelope.gain.linearRampToValueAtTime(0.78, at + 0.055);
    const voice = { id, midi, oscillator, envelope, vibrato, vibratoDepth, at, released: false };
    this._voices.set(id, voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      vibrato.disconnect();
      vibratoDepth.disconnect();
      this._voices.delete(id);
      if (this.activeVoice === id) this.activeVoice = null;
    };
    oscillator.start(at);
    vibrato.start(at);
    if (duration !== null) {
      const releaseAt = at + Math.max(0.06, duration);
      envelope.gain.setValueAtTime(0.78, releaseAt);
      envelope.gain.linearRampToValueAtTime(0, releaseAt + 0.025);
      oscillator.stop(releaseAt + 0.03);
      vibrato.stop(releaseAt + 0.03);
    }
    return id;
  }

  /** Returns an opaque voice ID. A new note takes over the monophonic instrument. */
  noteOn(midi) {
    if (!Number.isFinite(midi) || midi < 0 || midi > 127) throw new RangeError('Invalid MIDI note');
    this._initialize();
    this.stopPlayback();
    for (const id of this._voices.keys()) this.noteOff(id);
    this.lastMidi = midi;
    this.activeVoice = this._createVoice(midi, this.context.currentTime);
    return this.activeVoice;
  }

  /** Releasing an old pointer's voice never stops a newer note. */
  noteOff(id) {
    const voice = this._voices.get(id);
    if (!voice || voice.released) return;
    voice.released = true;
    const now = this.context.currentTime;
    const gain = voice.envelope.gain;
    if (typeof gain.cancelAndHoldAtTime === 'function' && voice.at <= now) {
      gain.cancelAndHoldAtTime(now);
    } else {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(voice.at > now ? 0 : Math.max(0, gain.value), now);
    }
    gain.linearRampToValueAtTime(0, now + 0.018);
    voice.oscillator.stop(now + 0.022);
    voice.vibrato.stop(now + 0.022);
    if (this.activeVoice === id) this.activeVoice = null;
  }

  _later(callback, delay) {
    const timer = setTimeout(() => {
      this._timers.delete(timer);
      callback();
    }, Math.max(0, delay));
    this._timers.add(timer);
  }

  /**
   * Schedule against the audio clock (not timer jitter). Resolves true on completion,
   * false on cancellation. midi:null is a rest. onNote receives index or -1 at end.
   */
  async play(sequence, { bpm = 100, onNote = () => {}, onEnd = () => {} } = {}) {
    this.stopAll();
    const generation = this._generation;
    if (!Array.isArray(sequence) || sequence.length > 512) throw new TypeError('Invalid sequence');
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) throw new RangeError('Invalid tempo');
    const notes = sequence.map(({ midi, beats = 1 }) => {
      if (midi !== null && (!Number.isFinite(midi) || midi < 0 || midi > 127)) {
        throw new RangeError('Invalid MIDI note');
      }
      if (!Number.isFinite(beats) || beats <= 0 || beats > 64) throw new RangeError('Invalid duration');
      return { midi, beats };
    });
    await this.unlock();
    if (generation !== this._generation) return false;
    const start = this.context.currentTime + 0.035;
    const beat = 60 / bpm;
    let elapsed = 0;
    return new Promise(resolve => {
      this._settlePlayback = resolve;
      notes.forEach(({ midi, beats }, index) => {
        const seconds = beats * beat;
        if (midi !== null) this._createVoice(midi, start + elapsed, Math.max(0.06, seconds - 0.045));
        this._later(() => {
          if (generation !== this._generation) return;
          this.lastMidi = midi;
          onNote(index);
        }, (0.035 + elapsed) * 1000);
        elapsed += seconds;
      });
      this._later(() => {
        if (generation !== this._generation) return;
        this._settlePlayback = null;
        // Settle first so a UI callback cannot strand the playback promise.
        resolve(true);
        onNote(-1);
        onEnd();
      }, (0.035 + elapsed + 0.04) * 1000);
    });
  }

  stopPlayback() {
    this._generation += 1;
    for (const timer of this._timers) clearTimeout(timer);
    this._timers.clear();
    for (const id of this._voices.keys()) this.noteOff(id);
    if (this._settlePlayback) {
      this._settlePlayback(false);
      this._settlePlayback = null;
    }
  }

  stopAll() {
    this.stopPlayback();
    this.activeVoice = null;
  }
}
