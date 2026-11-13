import { OcarinaAudio } from './audio.js?v=20261113-two-touch';
import { SONGS, NOTES, PLAYBACK_NOTE } from './songs.js?v=20261114-button-audio';
import { HOLES, getFingering, getMidiForHoles } from './fingering.js';
import { bodySvg } from './instrument-art.js?v=20261113-ceramic';
import { TouchFingering } from './touch-fingering.js';
import { TwoTouchInstrument } from './two-touch.js';
import { resolvePlayLayout } from './play-layout.js';
import { GAME_SCALE, SCALE_GUIDE, controlForNote, gameNoteForMidi } from './control-mapping.js';
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
let selectedId = SONGS[0].id;
try {
  const saved = JSON.parse(localStorage.getItem('hyrule-settings') || '{}');
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

function saveSettings() {
  try { localStorage.setItem('hyrule-settings', JSON.stringify({ version: 2, volume, bpm, octave, haptics, mode, inputMode, rotationMode })); } catch {}
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
  return `<div class="quick-notes">${noteEntries.map(([id, n]) => `<button class="note-key" data-note="${id}" aria-label="${n.label} ${n.pitch} 연주, 키보드 ${n.key}" title="${n.pitch} · ${n.key}"><strong>${noteLabel(id)}</strong></button>`).join('')}</div>`;
}
function holeHtml(h) {
  return `<button class="hole ${h.small ? 'small' : ''} ${closed.has(h.id) ? 'closed' : ''}" data-hole="${h.id}" ${h.back ? '' : `style="left:${h.x}%;top:${h.y}%"`} aria-label="${h.back ? '뒷면 ' : ''}${h.id}번 구멍" aria-pressed="${closed.has(h.id)}"></button>`;
}
function twoTouchHtml() {
  const positions = [[45, 52], [49, 79], [64, 73], [77, 64], [89, 74]];
  return `<div class="ocarina-scene two-touch-scene">${bodySvg('touch')}${noteEntries.map(([id, n], i) => `<button class="hole controller-hole" data-base="${n.control}" data-note="${id}" style="left:${positions[i][0]}%;top:${positions[i][1]}%" aria-label="${n.control} ${n.label} ${n.pitch}" title="${n.label}">${n.control}</button>`).join('')}</div><div class="shift-rail" aria-label="반음 조절">${[-3,-2,-1,0,1,2,3].map(offset => `<button data-shift="${offset}" aria-label="${offset === 0 ? '기본 음높이' : `${Math.abs(offset)}반음 ${offset > 0 ? '높게' : '낮게'}`}" aria-pressed="false">${offset > 0 ? '+' : ''}${offset || '·'}</button>`).join('')}</div><div class="instrument-dock touch-dock"><output id="live-pitch" aria-live="off"></output></div>`;
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
  $('#touch-capability').textContent = maxTouches ? `브라우저 보고 ${maxTouches}점 · 두 손가락 모드는 최대 2점 사용` : '마우스·키보드 사용 가능';
  $('#input-hint').textContent = mode === 'touch' ? '한 손가락으로 기본음, 다른 손가락으로 −3…+3 반음 조절. 기본음에서 떼면 정지.' : mode === 'simple' ? 'L·R·A·Y·X 기본음 · 손을 떼면 정지' : inputMode === 'direct' ? '실제 운지 조합 · 기본 5음에 최대 9점 터치 필요' : '구멍을 탭해 상태 유지 · 누르는 동안 발음';
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
  if (output) output.textContent = midi === null ? '' : (gameNoteForMidi(midi)?.label || getFingering(midi)?.label || '');
}
function renderSongs() {
  const query = $('#song-search').value.trim().toLowerCase();
  const found = SONGS.filter(song => (filter === 'all' || song.category === filter)
    && `${song.title} ${song.en} ${song.effect}`.toLowerCase().includes(query));
  $('#song-list').innerHTML = found.map(song => `<article class="song-card ${selected?.id === song.id ? 'is-selected' : ''}" data-song="${song.id}" style="--song-color:${song.color}"><button class="song-open" data-open="${song.id}" aria-label="${song.title} 선택" aria-pressed="${selected?.id === song.id}"><span class="song-emblem" aria-hidden="true">${symbols[SONGS.indexOf(song)]}</span><span class="song-info"><span class="song-heading"><span class="song-name">${song.title}</span></span><span class="song-effect">${song.effect}</span><span class="mini-notes" aria-label="${song.notes.map(noteLabel).join(' ')}">${song.notes.map(miniNote).join('')}</span></span></button><button class="song-play" data-play="${song.id}" aria-label="${song.title} 재생">▶</button></article>`).join('');
  $('#empty-results').hidden = found.length > 0;
  updatePlaybackButtons();
}
function updatePlaybackButtons() {
  $$('.song-card').forEach(card => {
    const active = card.dataset.song === playing;
    card.classList.toggle('is-playing', active);
    const button = card.querySelector('.song-play');
    button.textContent = active ? '■' : '▶';
    button.title = `${SONGS.find(song => song.id === card.dataset.song).title} ${active ? '정지' : '재생'}`;
    button.setAttribute('aria-label', button.title);
  });
  const active = selected && playing === selected.id;
  $('#practice-play').textContent = active ? '■' : '▶';
  $('#practice-play').title = active ? '선택한 곡 정지' : '선택한 곡 재생';
  $('#practice-play').setAttribute('aria-label', $('#practice-play').title);
  $('#custom-play').textContent = playing === 'custom' ? '■' : '▶';
  $('#custom-play').title = playing === 'custom' ? '허수아비 노래 정지' : '허수아비 노래 재생';
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
  $('#practice-progress-label').textContent = progress === selected.notes.length ? '연주 완료' : `${progress} / ${selected.notes.length}`;
  updatePracticeProgress();
  if (progress === selected.notes.length) practiceTimer = setTimeout(resetProgress, 1800);
}
async function startHold(el, key, { record = true } = {}) {
  const baseMidi = el.hasAttribute('data-blow') ? getMidiForHoles(closed) : NOTES[el.dataset.note]?.midi;
  const midi = baseMidi == null ? null : mode === 'touch' ? Math.max(71, Math.min(89, baseMidi + twoTouch.snapshot.offset)) : baseMidi;
  if (midi == null) { toast('운지를 확인하세요'); return; }
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
  } catch (error) { if (holds.get(key) === token) holds.delete(key); toast(error.message); }
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
  clearTimeout(fingerTimer);
  stopFingerVoice();
  fingers.clear();
  twoTouch.clear();
  tapContacts.clear();
  if (mode === 'touch' || inputMode === 'direct') closed.clear();
  syncHoles();
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
  fingerReady = audio.unlock().catch(error => { toast(error.message); return null; });
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
    await audio.play(sequence, {
      bpm,
      onNote(index) {
        if (generation === playGeneration) showPlaybackNote(song, sequence[index]?.noteIndex ?? -1);
      },
      onEnd() { if (generation === playGeneration) stop(); },
    });
  } catch (error) { if (generation === playGeneration) { stop(); toast(error.message); } }
}
function customSong() {
  return { id: 'custom', title: '허수아비의 노래', notes: [...custom] };
}
function selectSong(id, persist = true) {
  stop();
  selected = id === 'custom' && custom.length === 8 ? customSong() : SONGS.find(song => song.id === id) || null;
  selectedId = selected?.id || 'free';
  resetProgress();
  $('#practice-title').textContent = selected?.title || '자유 연주';
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
    img.alt = `${selected.title} 공식 전체 악보와 운지표`;
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      if (!img.isConnected) return;
      img.hidden = true;
      const message = document.createElement('span');
      message.className = 'score-error';
      message.textContent = '악보를 불러오지 못했습니다';
      $('#score-viewer').append(message);
    };
    $('#score-viewer').append(img);
  }
  if (selected && inputMode !== 'direct') setFingering(NOTES[selected.notes[0]].midi);
  updatePracticeProgress();
  renderSongs();
  if (persist) try { localStorage.setItem('hyrule-selected-song', selectedId); } catch {}
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
  $('#custom-sequence').innerHTML = Array.from({ length: 8 }, (_, i) => `<span class="practice-step"><span class="mini-note ${custom[i] === 'd' ? 'high' : ''}">${custom[i] ? noteLabel(custom[i]) : '·'}</span><small>${i + 1}</small></span>`).join('');
  $('#custom-play').disabled = custom.length !== 8;
  $('#custom-select').disabled = custom.length !== 8;
}

// Every finger has independent ownership; all cancel paths release sound.
document.addEventListener('pointerdown', event => {
  const el = event.target.closest('[data-hole], [data-note], [data-shift]');
  if (!el || event.button !== 0) return;
  event.preventDefault();
  el.setPointerCapture?.(event.pointerId);
  if (el.dataset.base || el.dataset.shift !== undefined) {
    if (playing || holds.size) stop();
    fingerReady = audio.unlock().catch(error => { toast(error.message); return null; });
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
document.addEventListener('pointerup', event => { releaseFinger(event.pointerId); endHold(event.pointerId); });
document.addEventListener('pointercancel', event => {
  if (twoTouch.pointers.has(event.pointerId) || fingers.pointers.has(event.pointerId) || tapContacts.has(event.pointerId)) clearFingerInput();
  endHold(event.pointerId);
});
document.addEventListener('lostpointercapture', event => { releaseFinger(event.pointerId); endHold(event.pointerId); });
document.addEventListener('click', event => {
  const el = event.target.closest('button');
  if (!el) return;
  if (el.dataset.audition) { auditionScale(Number(el.dataset.audition)); return; }
  if (event.detail === 0 && el.dataset.shift !== undefined) {
    if (playing || holds.size) stop();
    fingerReady = audio.unlock().catch(error => { toast(error.message); return null; });
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
$('#practice-play').title = PLAYBACK_NOTE;
$('#practice-reset').onclick = () => { stop(); resetProgress(); };
$('#score-link').onclick = () => {
  if (!selected?.officialScore) return;
  stop();
  $('#expanded-title').textContent = selected.title;
  $('#expanded-score-image').src = selected.officialScore;
  $('#expanded-score-image').alt = `${selected.title} 공식 전체 악보`;
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
$('#tempo').value = bpm;
$('#tempo-value').textContent = `${bpm}%`;
$('#tempo').oninput = event => { bpm = Number(event.target.value); $('#tempo-value').textContent = `${bpm}%`; saveSettings(); };
$('#octave').value = octave;
$('#octave').onchange = event => { stop(); octave = Number(event.target.value); saveSettings(); };
$('#haptics').checked = haptics;
$('#haptics').onchange = event => { haptics = event.target.checked; saveSettings(); };

$('#scarecrow-button').onclick = () => { stop(); closeMenu(); renderCustom(); $('#scarecrow-dialog').showModal(); };
$('#custom-keys').innerHTML = noteEntries.map(([id, note]) => `<button data-custom="${id}" aria-label="${note.label} 추가">${noteLabel(id)}</button>`).join('');
$('#custom-keys').onclick = async event => {
  const button = event.target.closest('[data-custom]');
  if (!button) return;
  if (custom.length >= 8) { toast('8음 입력 완료'); return; }
  custom.push(button.dataset.custom);
  renderCustom();
  try { localStorage.setItem('hyrule-scarecrow', JSON.stringify(custom)); } catch {}
  stop();
  try { await audio.play([{ midi: NOTES[button.dataset.custom].midi + octave, beats: 0.3 }], { bpm: 100 }); }
  catch (error) { toast(error.message); }
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
  return `<svg class="fingering-diagram" viewBox="0 0 160 94" role="img" aria-label="닫는 구멍 ${item.closed.length ? item.closed.join(', ') : '없음'}"><path d="M5 61Q80 4 151 39Q168 70 128 76Q55 84 5 61Z" fill="#203e47" stroke="#7b9b9e"/>${HOLES.map(h => `<circle cx="${h.x*1.5+3}" cy="${h.back ? 87 : h.y*.8}" r="${h.small ? 3 : 4}" fill="${item.closed.includes(h.id) ? '#d8c791' : '#0a1d23'}" stroke="#9eaa97" stroke-width=".6"/>`).join('')}</svg>`;
}
function renderGuide() {
  $('#scale-guide').innerHTML = GAME_SCALE.map(item => `<tr><th scope="row">${item.label}</th><td><b>${item.base}</b>${item.offset ? ` ${item.offset > 0 ? '+' : '−'}${Math.abs(item.offset)}` : ''}</td><td>${item.controllerParts.join(' + ')}</td><td>${fingeringDiagram(item)}</td><td><button class="icon-button" data-audition="${item.midi}" aria-label="${item.label} 들어보기">▶</button></td></tr>`).join('');
  $('#extra-scale-guide').innerHTML = SCALE_GUIDE.filter(item => !item.game).map(item => `<tr><th scope="row">${item.label}</th><td>${fingeringDiagram(item)}</td><td><button class="icon-button" data-audition="${item.midi}" aria-label="${item.label} 들어보기">▶</button></td></tr>`).join('');
}
async function auditionScale(midi) {
  stop();
  try { await audio.play([{ midi: midi + octave, beats: 1 }], { bpm: 100 }); }
  catch (error) { toast(error.message); }
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
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
applyLayout();
renderGuide();
renderInstrument();
if (selectedId !== 'free' && selectedId !== 'custom' && !SONGS.some(song => song.id === selectedId)) selectedId = SONGS[0].id;
selectSong(selectedId, false);

window.ocarinaState = () => ({ mode, inputMode, rotationMode, twoTouch: twoTouch.snapshot, maxTouches, directContacts: fingers.snapshot.contactCount, tapContacts: tapContacts.size, fingerMidi, playing, selected: selected?.id ?? null, progress, closed: [...closed], currentMidi: getMidiForHoles(closed), activeMidi: audio.lastMidi, contextState: audio.context?.state ?? 'not-started', activeVoice: audio.activeVoice, heldPointers: holds.size, custom: [...custom], volume, octave });
