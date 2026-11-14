import { OcarinaAudio } from './audio.js?v=20261114-audio-recovery';
import { SONGS, NOTES } from './songs.js?v=20261114-button-audio';
import { HOLES, getFingering, getMidiForHoles } from './fingering.js';
import { bodySvg } from './instrument-art.js?v=20261113-ceramic';
import { TouchFingering } from './touch-fingering.js';
import { TwoTouchInstrument } from './two-touch.js';
import { resolvePlayLayout } from './play-layout.js';
import { GAME_SCALE, SCALE_GUIDE, controlForNote, gameNoteForMidi } from './control-mapping.js';
import { uiStrings, initialLanguage, audioErrorText } from './i18n-ui.js?v=20261114-i18n';
import { applyStaticLanguage } from './i18n-dom.js?v=20261114-i18n';
import { localizedSong, localizedPitch, localizedControllerParts } from './i18n-songs.js?v=20261114-i18n';
import { songPlaybackSequence } from './song-performance.js?v=20261114-lullaby';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const audio = new OcarinaAudio();
const noteEntries = Object.entries(NOTES);
const holds = new Map();
const fingers = new TouchFingering();
const twoTouch = new TwoTouchInstrument();
const tapContacts = new Map();
const maxTouches = Number(navigator.maxTouchPoints) || 0;
let inputMode = maxTouches >= 9 ? 'direct' : 'tap';
let fingerVoice = null, fingerMidi = null, fingerTimer, fingerGeneration = 0, fingerReady = null;
const symbols = ['♧', '◷', '☼', 'ϟ', '♞', '❧', '❧', '♨', '♧', '◇', '☾', '✦'];
let mode = 'touch', rotationMode = 'right', filter = 'all', selected = null, playing = null;
let closed = new Set(getFingering(74).closed), progress = 0;
let volume = 0.7, bpm = 100, octave = 0, haptics = true, custom = [];
let toastTimer, practiceTimer, previewTimer, playGeneration = 0;
const preferredLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
let language = initialLanguage(null, preferredLanguages);
let selectedId = SONGS[0].id;
try {
  const storedSettings = JSON.parse(localStorage.getItem('hyrule-settings') || 'null');
  language = initialLanguage(storedSettings, preferredLanguages);
  const saved = storedSettings || {};
  volume = Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : volume;
  bpm = Number.isFinite(saved.bpm) && saved.bpm >= 50 && saved.bpm <= 160 ? saved.bpm : bpm;
  octave = [-12, 0, 12].includes(saved.octave) ? saved.octave : 0;
  haptics = saved.haptics !== false;
  if (['direct', 'tap'].includes(saved.inputMode)) inputMode = saved.inputMode;
  mode = saved.version === 2 && ['touch', 'merch', 'simple'].includes(saved.mode) ? saved.mode : 'touch';
  rotationMode = ['auto', 'left', 'right'].includes(saved.rotationMode) ? saved.rotationMode : 'right';
  const notes = JSON.parse(localStorage.getItem('hyrule-scarecrow') || '[]');
  if (Array.isArray(notes)) custom = notes.filter(n => Object.hasOwn(NOTES, n)).slice(0, 8);
  selectedId = localStorage.getItem('hyrule-selected-song') || selectedId;
} catch {}
audio.setVolume(volume);

function copy() { return uiStrings(language); }
function songInfo(song) { return localizedSong(song, language); }
function pitchLabel(midi) {
  return localizedPitch(midi, language, gameNoteForMidi(midi)?.label || getFingering(midi)?.label || '');
}
function saveSettings() {
  try { localStorage.setItem('hyrule-settings', JSON.stringify({ version: 2, language, volume, bpm, octave, haptics, mode, inputMode, rotationMode })); } catch {}
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2200);
}
function noteLabel(id) { return controlForNote(id); }
function miniNote(id) {
  return `<span class="mini-note ${id === 'd' ? 'high' : ''}" title="${NOTES[id].pitch}">${noteLabel(id)}</span>`;
}
function keysHtml() {
  return `<div class="quick-notes">${noteEntries.map(([id, n]) => `<button class="note-key" data-note="${id}" aria-label="${copy().playKey(pitchLabel(n.midi), n.key)}" title="${n.pitch} · ${n.key}"><strong>${noteLabel(id)}</strong></button>`).join('')}</div>`;
}
function holeHtml(h) {
  return `<button class="hole ${h.small ? 'small' : ''} ${closed.has(h.id) ? 'closed' : ''}" data-hole="${h.id}" ${h.back ? '' : `style="left:${h.x}%;top:${h.y}%"`} aria-label="${copy().hole(h.id, h.back)}" aria-pressed="${closed.has(h.id)}"></button>`;
}
function twoTouchHtml() {
  const positions = [[45, 52], [49, 79], [64, 73], [77, 64], [89, 74]];
  return `<div class="ocarina-scene two-touch-scene">${bodySvg('touch')}${noteEntries.map(([id, n], i) => `<button class="hole controller-hole" data-base="${n.control}" data-note="${id}" style="left:${positions[i][0]}%;top:${positions[i][1]}%" aria-label="${n.control} ${pitchLabel(n.midi)}" title="${pitchLabel(n.midi)}">${n.control}</button>`).join('')}</div><div class="shift-rail" aria-label="${copy().shift}">${[-3,-2,-1,0,1,2,3].map(offset => `<button data-shift="${offset}" aria-label="${offset === 0 ? copy().basePitch : copy().shiftBy(offset)}" aria-pressed="false">${offset > 0 ? '+' : ''}${offset || '·'}</button>`).join('')}</div><div class="instrument-dock touch-dock"><output id="live-pitch" aria-live="off"></output></div>`;
}
function renderInstrument() {
  $('#main-instrument').innerHTML = mode === 'touch' ? twoTouchHtml() : mode === 'simple'
    ? `<div class="simple-scene">${bodySvg('simple', true)}${keysHtml()}</div>`
    : `<div class="ocarina-scene">${bodySvg('merch')}${HOLES.filter(h => !h.back).map(holeHtml).join('')}</div><div class="instrument-dock"><div class="thumb-row">${HOLES.filter(h => h.back).map(holeHtml).join('')}</div>${keysHtml()}</div>`;
  document.body.dataset.input = inputMode;
  document.body.dataset.mode = mode;
  $('#instrument-mode').value = mode;
  $('#input-mode').value = inputMode;
  $('#advanced-input').hidden = mode !== 'merch';
  syncHoles();
  $$('[data-input-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.inputMode === inputMode);
    button.setAttribute('aria-pressed', String(button.dataset.inputMode === inputMode));
  });
  $('#touch-capability').textContent = maxTouches ? copy().touches(maxTouches) : copy().keyboardAvailable;
  $('#input-hint').textContent = copy().inputHints[mode === 'merch' ? inputMode : mode];
  $$('[data-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
}
function syncHoles() {
  const touch = twoTouch.snapshot;
  $$('[data-base]').forEach(button => {
    button.classList.toggle('closed', button.dataset.base === touch.control);
    button.setAttribute('aria-pressed', String(button.dataset.base === touch.control));
  });
  $$('[data-shift]').forEach(button => {
    const active = Number(button.dataset.shift) === touch.offset;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  $$('[data-hole]').forEach(button => {
    const isClosed = closed.has(Number(button.dataset.hole));
    button.classList.toggle('closed', isClosed);
    button.setAttribute('aria-pressed', String(isClosed));
    button.classList.toggle('held', fingers.snapshot.closed.includes(Number(button.dataset.hole)) || [...tapContacts.values()].includes(Number(button.dataset.hole)));
  });
}
function setFingering(midi) {
  const fingering = getFingering(midi);
  if (fingering) { closed = new Set(fingering.closed); syncHoles(); }
}
function highlight(midi) {
  $$('[data-note]').forEach(button => button.classList.toggle('sounding', NOTES[button.dataset.note].midi === midi));
  $('.instrument-stage').classList.toggle('sounding', midi !== null);
  const output = $('#live-pitch');
  if (output) output.textContent = midi === null ? '' : pitchLabel(midi);
}
function renderSongs() {
  const query = $('#song-search').value.trim().normalize('NFKC').toLowerCase();
  const found = SONGS.filter(song => {
    if (filter !== 'all' && song.category !== filter) return false;
    if (!query) return true;
    const aliases = ['ko', 'en', 'ja'].map(lang => localizedSong(song, lang).title);
    return [...aliases, song.effect, songInfo(song).effect].join(' ').normalize('NFKC').toLowerCase().includes(query);
  });
  $('#song-list').innerHTML = found.map(song => `<article class="song-card ${selected?.id === song.id ? 'is-selected' : ''}" data-song="${song.id}" style="--song-color:${song.color}"><button class="song-open" data-open="${song.id}" aria-label="${copy().selectSong(songInfo(song).title)}" aria-pressed="${selected?.id === song.id}"><span class="song-emblem" aria-hidden="true">${symbols[SONGS.indexOf(song)]}</span><span class="song-info"><span class="song-heading"><span class="song-name">${songInfo(song).title}</span></span><span class="song-effect">${songInfo(song).effect}</span><span class="mini-notes" aria-label="${song.notes.map(noteLabel).join(' ')}">${song.notes.map(miniNote).join('')}</span></span></button><button class="song-play" data-play="${song.id}" aria-label="${copy().playSong(songInfo(song).title)}">▶</button></article>`).join('');
  $('#empty-results').hidden = found.length > 0;
  updatePlaybackButtons();
}
function updatePlaybackButtons() {
  $$('.song-card').forEach(card => {
    const active = card.dataset.song === playing;
    card.classList.toggle('is-playing', active);
    const button = card.querySelector('.song-play');
    button.textContent = active ? '■' : '▶';
    const title = songInfo(SONGS.find(song => song.id === card.dataset.song)).title;
    button.title = active ? copy().stopSong(title) : copy().playSong(title);
    button.setAttribute('aria-label', button.title);
  });
  const active = selected && playing === selected.id;
  $('#practice-play').textContent = active ? '■' : '▶';
  $('#practice-play').title = active ? copy().stopSelected : copy().playSelected;
  $('#practice-play').setAttribute('aria-label', $('#practice-play').title);
  $('#custom-play').textContent = playing === 'custom' ? '■' : '▶';
  const customTitle = songInfo(customSong()).title;
  $('#custom-play').title = playing === 'custom' ? copy().stopSong(customTitle) : copy().playSong(customTitle);
  $('#custom-play').setAttribute('aria-label', $('#custom-play').title);
}
function stop() {
  playGeneration++;
  clearTimeout(previewTimer);
  clearFingerInput();
  audio.stopAll();
  playing = null;
  holds.clear();
  highlight(null);
  $$('.mini-note.current').forEach(el => el.classList.remove('current'));
  updatePlaybackButtons();
  updatePracticeProgress();
}
function resetSound() {
  stop();
  audio.reset();
}
function resetProgress() {
  clearTimeout(practiceTimer);
  progress = 0;
  updatePracticeProgress();
  $('#practice-progress-label').textContent = '';
}
function updatePracticeProgress() {
  $$('#practice-sequence .practice-step').forEach((el, i) => {
    el.classList.toggle('done', !playing && i < progress);
    el.classList.toggle('current', !playing && i === progress);
  });
}
function recordNote(midi) {
  const id = noteEntries.find(([, note]) => note.midi === midi)?.[0];
  if (haptics && navigator.vibrate) navigator.vibrate(12);
  if (!selected || !id) return;
  clearTimeout(practiceTimer);
  if (progress === selected.notes.length) progress = 0;
  progress = selected.notes[progress] === id ? progress + 1 : (id === selected.notes[0] ? 1 : 0);
  $('#practice-progress-label').textContent = progress === selected.notes.length ? copy().complete : `${progress} / ${selected.notes.length}`;
  updatePracticeProgress();
  if (progress === selected.notes.length) practiceTimer = setTimeout(resetProgress, 1800);
}
async function startHold(el, key, { record = true } = {}) {
  const baseMidi = el.hasAttribute('data-blow') ? getMidiForHoles(closed) : NOTES[el.dataset.note]?.midi;
  const midi = baseMidi == null ? null : mode === 'touch' ? Math.max(71, Math.min(89, baseMidi + twoTouch.snapshot.offset)) : baseMidi;
  if (midi == null) { toast(copy().checkFingering); return; }
  const unlocking = audio.unlock();
  if (playing) stop();
  clearFingerInput();
  const token = { el, midi, voice: null, ready: false, record };
  holds.set(key, token);
  setFingering(midi);
  try {
    await unlocking;
    if (holds.get(key) !== token) return;
    token.ready = true;
    if (token.midi === null) return;
    token.voice = audio.noteOn(token.midi + octave);
    highlight(token.midi);
    if (token.record) recordNote(token.midi);
  } catch (error) {
    if (holds.get(key) === token) {
      holds.delete(key);
      toast(audioErrorText(error, language));
    }
  }
}
function endHold(key) {
  const token = holds.get(key);
  if (!token) return;
  holds.delete(key);
  audio.noteOff(token.voice);
  if (audio.activeVoice === null) {
    highlight(null);
    if (inputMode === 'direct' && !fingers.pointers.size) { closed.clear(); syncHoles(); }
  }
}
function tapNote(el, key, duration = 220) {
  if (key === 'preview') clearTimeout(previewTimer);
  startHold(el, key, { record: key !== 'preview' });
  const token = holds.get(key);
  const timer = setTimeout(() => { if (holds.get(key) === token) endHold(key); }, duration);
  if (key === 'preview') previewTimer = timer;
}
function stopFingerVoice() {
  if (fingerVoice !== null) audio.noteOff(fingerVoice);
  fingerVoice = null;
  fingerMidi = null;
  highlight(null);
}
function clearFingerInput() {
  fingerGeneration++;
  fingerReady = null;
  clearTimeout(fingerTimer);
  stopFingerVoice();
  fingers.clear();
  twoTouch.clear();
  tapContacts.clear();
  if (mode === 'touch' || inputMode === 'direct') closed.clear();
  syncHoles();
}
function prepareFingerAudio() {
  const pending = audio.unlock().catch(error => {
    if (fingerReady === pending) toast(audioErrorText(error, language));
    return null;
  });
  fingerReady = pending;
}
function refreshFingerSound() {
  const generation = ++fingerGeneration;
  clearTimeout(fingerTimer);
  const snapshot = mode === 'touch' ? twoTouch.snapshot : fingers.snapshot;
  if (mode === 'touch') closed = new Set(getFingering(snapshot.midi)?.closed || []);
  else if (inputMode === 'direct') closed = new Set(snapshot.closed);
  syncHoles();
  const contacts = mode === 'touch' || inputMode === 'direct' ? snapshot.contactCount : tapContacts.size;
  const midi = mode === 'touch' || inputMode === 'direct' ? snapshot.midi : getMidiForHoles(closed);
  if (!contacts || midi === null) { stopFingerVoice(); return; }
  if (fingerMidi === midi && audio.activeVoice === fingerVoice) return;
  stopFingerVoice();
  const sound = async () => {
    const ready = await fingerReady;
    if (!ready || generation !== fingerGeneration) return;
    fingerVoice = audio.noteOn(midi + octave);
    fingerMidi = midi;
    highlight(midi);
    recordNote(midi);
  };
  // Let a held chord settle; a latched tap can sound immediately.
  if (mode !== 'touch' && inputMode === 'direct') fingerTimer = setTimeout(sound, 35);
  else sound();
}
function beginFinger(pointerId, hole) {
  if (playing || holds.size) stop();
  prepareFingerAudio();
  if (inputMode === 'direct') fingers.press(pointerId, hole);
  else {
    // A second finger on the same hole must not toggle it back open.
    if (![...tapContacts.values()].includes(hole)) closed.has(hole) ? closed.delete(hole) : closed.add(hole);
    tapContacts.set(pointerId, hole);
  }
  refreshFingerSound();
}
function releaseFinger(pointerId) {
  if (!twoTouch.pointers.has(pointerId) && !fingers.pointers.has(pointerId) && !tapContacts.has(pointerId)) return;
  twoTouch.release(pointerId);
  fingers.release(pointerId);
  tapContacts.delete(pointerId);
  refreshFingerSound();
}
function accessibleHole(hole) {
  if (inputMode === 'direct') {
    // Keyboard/screen-reader activation can audition one held contact.
    const pointerId = Symbol('accessible-hole');
    beginFinger(pointerId, hole);
    setTimeout(() => releaseFinger(pointerId), 230);
  } else {
    closed.has(hole) ? closed.delete(hole) : closed.add(hole);
    syncHoles();
    tapNote({ hasAttribute: () => true }, 'preview');
  }
}
function showPlaybackNote(song, index) {
  $$('.mini-note.current').forEach(el => el.classList.remove('current'));
  if (index < 0) { highlight(null); return; }
  const midi = NOTES[song.notes[index]].midi;
  setFingering(midi);
  highlight(midi);
  document.querySelector(`[data-song="${song.id}"]`)?.querySelectorAll('.mini-note')[index]?.classList.add('current');
  if (selected?.id === song.id) $('#practice-sequence').children[index]?.querySelector('.mini-note').classList.add('current');
}
async function playSong(song) {
  if (!song) return;
  if (playing === song.id) { stop(); return; }
  stop();
  const generation = playGeneration;
  playing = song.id;
  clearTimeout(practiceTimer);
  updatePracticeProgress();
  updatePlaybackButtons();
  try {
    const sequence = songPlaybackSequence(song, octave);
    const finished = await audio.play(sequence, {
      bpm,
      onNote(index) {
        if (generation === playGeneration) showPlaybackNote(song, sequence[index]?.noteIndex ?? -1);
      },
      onEnd() { if (generation === playGeneration) stop(); },
    });
    if (!finished && generation === playGeneration) stop();
  } catch (error) { if (generation === playGeneration) { stop(); toast(audioErrorText(error, language)); } }
}
function customSong() {
  return { id: 'custom', notes: [...custom] };
}
function selectSong(id, persist = true) {
  stop();
  selected = id === 'custom' && custom.length === 8 ? customSong() : SONGS.find(song => song.id === id) || null;
  selectedId = selected?.id || 'free';
  resetProgress();
  renderSelection();
  if (persist) try { localStorage.setItem('hyrule-selected-song', selectedId); } catch {}
}
function renderSelection() {
  $('#practice-title').textContent = selected ? songInfo(selected).title : copy().freePlay;
  $('.performance').dataset.free = String(!selected);
  $('.selected-actions').hidden = !selected;
  $('#clear-selection').hidden = !selected;
  $('#practice-sequence').hidden = !selected;
  $('#practice-sequence').innerHTML = selected ? selected.notes.map((note, i) => `<span class="practice-step">${miniNote(note)}<small>${i + 1}</small></span>`).join('') : '';
  $('#score-viewer').replaceChildren();
  $('#score-link').hidden = !selected?.officialScore;
  if (selected?.officialScore) {
    const img = document.createElement('img');
    img.width = 1912;
    img.height = 874;
    img.src = selected.officialScore;
    img.alt = copy().scoreAlt(songInfo(selected).title);
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      if (!img.isConnected) return;
      img.hidden = true;
      const message = document.createElement('span');
      message.className = 'score-error';
      message.textContent = copy().scoreError;
      $('#score-viewer').append(message);
    };
    $('#score-viewer').append(img);
  }
  if (selected && inputMode !== 'direct') setFingering(NOTES[selected.notes[0]].midi);
  updatePracticeProgress();
  renderSongs();
}
function setMenuPage(page) {
  $('#menu-dialog').scrollTop = 0;
  $$('[data-menu-page]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.menuPage === page)));
  $$('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== page; });
}
function closeDialog(dialog) {
  stop();
  dialog.close();
}
function closeMenu() { if ($('#menu-dialog').open) closeDialog($('#menu-dialog')); }
function openMenu() {
  stop();
  setMenuPage('songs');
  $('#menu-button').setAttribute('aria-expanded', 'true');
  $('#menu-dialog').showModal();
  $('#menu-dialog').scrollTop = 0;
}
function renderCustom() {
  $('#custom-keys').innerHTML = noteEntries.map(([id, note]) => `<button data-custom="${id}" aria-label="${copy().addPitch(pitchLabel(note.midi))}">${noteLabel(id)}</button>`).join('');
  $('#custom-sequence').innerHTML = Array.from({ length: 8 }, (_, i) => `<span class="practice-step"><span class="mini-note ${custom[i] === 'd' ? 'high' : ''}">${custom[i] ? noteLabel(custom[i]) : '·'}</span><small>${i + 1}</small></span>`).join('');
  $('#custom-play').disabled = custom.length !== 8;
  $('#custom-select').disabled = custom.length !== 8;
}

// A mobile browser can grant audio activation only when the touch ends.
// This retries the output without replaying a finger that has already lifted.
const audioControls = '[data-hole], [data-note], [data-shift], [data-audition], [data-play], [data-custom], #practice-play, #custom-play';
function activateOnGesture(event) {
  if (!event.isTrusted || document.hidden || audio.context?.state === 'running') return;
  if (!event.target?.closest?.(audioControls)) return;
  const generation = playGeneration;
  audio.activate().catch(error => {
    if (generation === playGeneration && !document.hidden) toast(audioErrorText(error, language));
  });
}

// Every finger has independent ownership; all cancel paths release sound.
document.addEventListener('pointerdown', event => {
  const el = event.target.closest('[data-hole], [data-note], [data-shift]');
  if (!el || event.button !== 0) return;
  event.preventDefault();
  el.setPointerCapture?.(event.pointerId);
  if (el.dataset.base || el.dataset.shift !== undefined) {
    if (playing || holds.size) stop();
    prepareFingerAudio();
    if (el.dataset.base) twoTouch.pressBase(event.pointerId, el.dataset.base);
    else twoTouch.pressModifier(event.pointerId, Number(el.dataset.shift));
    refreshFingerSound();
  } else if (el.dataset.hole) beginFinger(event.pointerId, Number(el.dataset.hole));
  else startHold(el, event.pointerId);
});
document.addEventListener('pointermove', event => {
  if (twoTouch.pointers.has(event.pointerId)) {
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-base], [data-shift]');
    const point = target?.dataset.base ? { control: target.dataset.base } : target?.dataset.shift !== undefined ? { offset: Number(target.dataset.shift) } : null;
    twoTouch.move(event.pointerId, point);
    refreshFingerSound();
    return;
  }
  if (inputMode !== 'direct' || !fingers.pointers.has(event.pointerId)) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('#main-instrument [data-hole]');
  const hole = target ? Number(target.dataset.hole) : null;
  if (fingers.pointers.get(event.pointerId).hole === hole) return;
  fingers.move(event.pointerId, hole);
  refreshFingerSound();
});
document.addEventListener('pointerup', event => {
  releaseFinger(event.pointerId);
  endHold(event.pointerId);
  if (event.pointerType !== 'mouse') activateOnGesture(event);
});
document.addEventListener('touchend', activateOnGesture, { passive: true });
document.addEventListener('pointercancel', event => {
  if (twoTouch.pointers.has(event.pointerId) || fingers.pointers.has(event.pointerId) || tapContacts.has(event.pointerId)) clearFingerInput();
  endHold(event.pointerId);
});
document.addEventListener('lostpointercapture', event => { releaseFinger(event.pointerId); endHold(event.pointerId); });
document.addEventListener('click', event => {
  activateOnGesture(event);
  const el = event.target.closest('button');
  if (!el) return;
  if (el.dataset.audition) { auditionScale(Number(el.dataset.audition)); return; }
  if (event.detail === 0 && el.dataset.shift !== undefined) {
    if (playing || holds.size) stop();
    prepareFingerAudio();
    twoTouch.pressModifier('accessible-shift', Number(el.dataset.shift));
    refreshFingerSound();
    return;
  }
  if (event.detail === 0 && (el.dataset.note || el.hasAttribute('data-blow'))) { tapNote(el, 'accessible'); return; }
  if (el.dataset.hole) { if (event.detail === 0) accessibleHole(Number(el.dataset.hole)); return; }
  if (el.dataset.inputMode) {
    stop();
    inputMode = el.dataset.inputMode;
    if (inputMode === 'direct') closed.clear();
    else closed = new Set(getFingering(selected ? NOTES[selected.notes[0]].midi : 74).closed);
    renderInstrument();
    saveSettings();
    return;
  }
  if (el.dataset.mode) { stop(); mode = el.dataset.mode; renderInstrument(); saveSettings(); return; }
  if (el.dataset.open) { closeMenu(); selectSong(el.dataset.open); return; }
  if (el.dataset.play) { playSong(SONGS.find(song => song.id === el.dataset.play)); return; }
  if (el.dataset.menuPage) { stop(); setMenuPage(el.dataset.menuPage); return; }
  if (el.dataset.filter) {
    filter = el.dataset.filter;
    $$('[data-filter]').forEach(button => { button.classList.toggle('active', button === el); button.setAttribute('aria-pressed', String(button === el)); });
    renderSongs();
    return;
  }
  if (el.classList.contains('close-dialog')) closeDialog(el.closest('dialog'));
});
for (const dialog of $$('dialog')) {
  dialog.addEventListener('cancel', stop);
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    if (dialog.id === 'menu-dialog') $('#menu-button').setAttribute('aria-expanded', 'false');
    if (!$$('dialog[open]').length) $(dialog.id === 'score-dialog' ? '#score-link' : '#menu-button').focus({ preventScroll: true });
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
  });
}
$('#menu-button').onclick = openMenu;
$('#song-search').oninput = renderSongs;
$('#clear-selection').onclick = () => selectSong('free');
$('#free-play').onclick = () => { closeMenu(); selectSong('free'); };
$('#practice-play').onclick = () => playSong(selected);
$('#practice-reset').onclick = () => { stop(); resetProgress(); };
$('#score-link').onclick = () => {
  if (!selected?.officialScore) return;
  stop();
  $('#expanded-title').textContent = songInfo(selected).title;
  $('#expanded-score-image').src = selected.officialScore;
  $('#expanded-score-image').alt = copy().scoreAlt(songInfo(selected).title);
  $('#original-score-link').href = selected.officialScore;
  $('#score-dialog').showModal();
};
$('#volume').value = volume * 100;
$('#volume-value').textContent = `${Math.round(volume * 100)}%`;
$('#volume').oninput = event => {
  volume = Number(event.target.value) / 100;
  audio.setVolume(volume);
  $('#volume-value').textContent = `${Math.round(volume * 100)}%`;
  saveSettings();
};
$('#audio-reconnect').onclick = () => {
  resetSound();
  if (volume === 0) toast(copy().muted);
  return playPreview(NOTES.D.midi, 0.4);
};
$('#tempo').value = bpm;
$('#tempo-value').textContent = `${bpm}%`;
$('#tempo').oninput = event => { bpm = Number(event.target.value); $('#tempo-value').textContent = `${bpm}%`; saveSettings(); };
$('#octave').value = octave;
$('#octave').onchange = event => { stop(); octave = Number(event.target.value); saveSettings(); };
$('#haptics').checked = haptics;
$('#haptics').onchange = event => { haptics = event.target.checked; saveSettings(); };

$('#scarecrow-button').onclick = () => { stop(); closeMenu(); renderCustom(); $('#scarecrow-dialog').showModal(); };
$('#custom-keys').onclick = async event => {
  const button = event.target.closest('[data-custom]');
  if (!button) return;
  if (custom.length >= 8) { toast(copy().eightEntered); return; }
  custom.push(button.dataset.custom);
  renderCustom();
  try { localStorage.setItem('hyrule-scarecrow', JSON.stringify(custom)); } catch {}
  stop();
  await playPreview(NOTES[button.dataset.custom].midi, 0.3);
};
$('#custom-clear').onclick = () => {
  stop(); custom = [];
  try { localStorage.removeItem('hyrule-scarecrow'); } catch {}
  if (selected?.id === 'custom') selectSong('free');
  renderCustom();
};
$('#custom-play').onclick = () => playSong(customSong());
$('#custom-select').onclick = () => { if (custom.length === 8) { closeDialog($('#scarecrow-dialog')); selectSong('custom'); } };

function applyLayout() {
  const layout = resolvePlayLayout(window.innerWidth, window.innerHeight, rotationMode);
  const root = document.documentElement;
  root.style.setProperty('--play-width', `${layout.width}px`);
  root.style.setProperty('--play-height', `${layout.height}px`);
  root.style.setProperty('--play-angle', `${layout.rotation}deg`);
  document.body.dataset.layout = layout.landscape ? 'landscape' : 'portrait';
  document.body.dataset.rotated = String(layout.rotation !== 0);
  document.body.dataset.compact = String(layout.width <= 740);
  $('#rotation-mode').value = rotationMode;
}
$('#rotation-mode').onchange = event => { stop(); rotationMode = event.target.value; applyLayout(); saveSettings(); };
$('#instrument-mode').onchange = event => { stop(); mode = event.target.value; renderInstrument(); saveSettings(); };
$('#input-mode').onchange = event => { stop(); inputMode = event.target.value; renderInstrument(); saveSettings(); };
window.addEventListener('resize', () => { stop(); applyLayout(); });
function fingeringDiagram(item) {
  return `<svg class="fingering-diagram" viewBox="0 0 160 94" role="img" aria-label="${copy().closedHoles(item.closed.join(', '))}"><path d="M5 61Q80 4 151 39Q168 70 128 76Q55 84 5 61Z" fill="#203e47" stroke="#7b9b9e"/>${HOLES.map(h => `<circle cx="${h.x*1.5+3}" cy="${h.back ? 87 : h.y*.8}" r="${h.small ? 3 : 4}" fill="${item.closed.includes(h.id) ? '#d8c791' : '#0a1d23'}" stroke="#9eaa97" stroke-width=".6"/>`).join('')}</svg>`;
}
function renderGuide() {
  $('#scale-guide').innerHTML = GAME_SCALE.map(item => `<tr><th scope="row">${pitchLabel(item.midi)}</th><td><b>${item.base}</b>${item.offset ? ` ${item.offset > 0 ? '+' : '−'}${Math.abs(item.offset)}` : ''}</td><td>${localizedControllerParts(item, language).join(' + ')}</td><td>${fingeringDiagram(item)}</td><td><button class="icon-button" data-audition="${item.midi}" aria-label="${copy().audition(pitchLabel(item.midi))}">▶</button></td></tr>`).join('');
  $('#extra-scale-guide').innerHTML = SCALE_GUIDE.filter(item => !item.game).map(item => `<tr><th scope="row">${pitchLabel(item.midi)}</th><td>${fingeringDiagram(item)}</td><td><button class="icon-button" data-audition="${item.midi}" aria-label="${copy().audition(pitchLabel(item.midi))}">▶</button></td></tr>`).join('');
}
async function playPreview(midi, beats) {
  const generation = playGeneration;
  try { await audio.play([{ midi: midi + octave, beats }], { bpm: 100 }); }
  catch (error) { if (generation === playGeneration) toast(audioErrorText(error, language)); }
}
function auditionScale(midi) {
  stop();
  return playPreview(midi, 1);
}
document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,select,textarea') || $$('dialog[open]').length) return;
  if (event.key.toLowerCase() === 'b') { event.preventDefault(); stop(); return; }
  const note = noteEntries.find(([, value]) => value.key === event.key || value.control.toLowerCase() === event.key.toLowerCase())?.[0];
  let el = note ? document.querySelector(`#main-instrument [data-note="${note}"]`) : null;
  if (!el && [' ', 'Enter'].includes(event.key) && event.target.matches('[data-note],[data-blow]')) el = event.target;
  if (el) { event.preventDefault(); startHold(el, `key${event.code}`); }
});
document.addEventListener('keyup', event => endHold(`key${event.code}`));
window.addEventListener('blur', stop);
window.addEventListener('pagehide', resetSound);
window.addEventListener('pageshow', event => { if (event.persisted) resetSound(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) resetSound(); });
function renderLanguage() {
  applyStaticLanguage(language, document);
  $('#language').value = language;
  renderGuide();
  renderInstrument();
  renderCustom();
}
$('#language').onchange = event => {
  const nextLanguage = event.target.value;
  if (!['ko', 'en', 'ja'].includes(nextLanguage) || nextLanguage === language) return;
  stop();
  clearTimeout(toastTimer);
  $('#toast').classList.remove('visible');
  $('#toast').textContent = '';
  language = nextLanguage;
  renderLanguage();
  renderSelection();
  if (selected && progress === selected.notes.length) $('#practice-progress-label').textContent = copy().complete;
  saveSettings();
};
applyLayout();
renderLanguage();
if (selectedId !== 'free' && selectedId !== 'custom' && !SONGS.some(song => song.id === selectedId)) selectedId = SONGS[0].id;
selectSong(selectedId, false);

window.ocarinaState = () => ({ language, mode, inputMode, rotationMode, twoTouch: twoTouch.snapshot, maxTouches, directContacts: fingers.snapshot.contactCount, tapContacts: tapContacts.size, fingerMidi, playing, selected: selected?.id ?? null, progress, closed: [...closed], currentMidi: getMidiForHoles(closed), activeMidi: audio.lastMidi, contextState: audio.context?.state ?? 'not-started', activeVoice: audio.activeVoice, heldPointers: holds.size, custom: [...custom], volume, octave });
