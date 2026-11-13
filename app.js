import { OcarinaAudio } from './audio.js';
import { SONGS, NOTES, PLAYBACK_NOTE } from './songs.js';
import { HOLES, getFingering, getMidiForHoles } from './fingering.js';
import { bodySvg } from './instrument-art.js';
import { TouchFingering } from './touch-fingering.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const audio = new OcarinaAudio();
const media = $('#official-audio');
const noteEntries = Object.entries(NOTES);
const holds = new Map();
const fingers = new TouchFingering();
const tapContacts = new Map();
const maxTouches = Number(navigator.maxTouchPoints) || 0;
let inputMode = maxTouches >= 9 ? 'direct' : 'tap';
let fingerVoice = null, fingerMidi = null, fingerTimer, fingerGeneration = 0, fingerReady = null;
const symbols = ['♧', '◷', '☼', 'ϟ', '♞', '❧', '❧', '♨', '♧', '◇', '☾', '✦'];
let mode = 'merch', filter = 'all', selected = null, playing = null, officialPlaying = false;
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
  mode = saved.mode === 'simple' ? 'simple' : 'merch';
  const notes = JSON.parse(localStorage.getItem('hyrule-scarecrow') || '[]');
  if (Array.isArray(notes)) custom = notes.filter(n => Object.hasOwn(NOTES, n)).slice(0, 8);
  selectedId = localStorage.getItem('hyrule-selected-song') || selectedId;
} catch {}
audio.setVolume(volume);

function saveSettings() {
  try { localStorage.setItem('hyrule-settings', JSON.stringify({ volume, bpm, octave, haptics, mode, inputMode })); } catch {}
}
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2200);
}
function noteLabel(id) { return id === 'd' ? '레↑' : NOTES[id].label; }
function miniNote(id) {
  return `<span class="mini-note ${id === 'd' ? 'high' : ''}" title="${NOTES[id].pitch}">${noteLabel(id)}</span>`;
}
function keysHtml() {
  return `<div class="quick-notes">${noteEntries.map(([id, n]) => `<button class="note-key" data-note="${id}" aria-label="${n.label} ${n.pitch} 연주, 키보드 ${n.key}"><strong>${noteLabel(id)}</strong><small>${n.pitch}</small></button>`).join('')}</div>`;
}
function holeHtml(h) {
  return `<button class="hole ${h.small ? 'small' : ''} ${closed.has(h.id) ? 'closed' : ''}" data-hole="${h.id}" ${h.back ? '' : `style="left:${h.x}%;top:${h.y}%"`} aria-label="${h.back ? '뒷면 ' : ''}${h.id}번 구멍" aria-pressed="${closed.has(h.id)}">${h.id}</button>`;
}
function renderInstrument() {
  $('#main-instrument').innerHTML = mode === 'simple'
    ? `<div class="simple-scene">${bodySvg('simple', true)}${keysHtml()}</div>`
    : `<div class="ocarina-scene">${bodySvg('merch')}${HOLES.filter(h => !h.back).map(holeHtml).join('')}</div><div class="instrument-dock"><div class="thumb-row"><span>뒷면</span>${HOLES.filter(h => h.back).map(holeHtml).join('')}</div>${keysHtml()}</div>`;
  document.body.dataset.input = inputMode;
  syncHoles();
  $$('[data-input-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.inputMode === inputMode);
    button.setAttribute('aria-pressed', String(button.dataset.inputMode === inputMode));
  });
  $('#touch-capability').textContent = maxTouches ? `이 기기 ${maxTouches}점 · 공식 기본 5음 운지에는 최대 9점 필요` : '터치 미지원 기기 · 마우스는 탭 운지 사용';
  $('#input-hint').textContent = inputMode === 'direct' ? '손가락을 댄 구멍만 닫힘 · 떼면 열림' : '터치로 열고 닫기 · 누르는 동안 소리';
  $$('[data-mode]').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === mode);
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  });
}
function syncHoles() {
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
    button.setAttribute('aria-label', `${SONGS.find(song => song.id === card.dataset.song).title} ${active ? '정지' : '재생'}`);
  });
  const active = selected && playing === selected.id;
  $('#practice-play').textContent = active ? '■ 정지' : '▶ 재생';
  $('#practice-play').setAttribute('aria-label', active ? '선택한 곡 정지' : '선택한 곡 재생');
  $('#official-play').textContent = officialPlaying ? '■ 정지' : '♫ 원곡';
  $('#official-play').setAttribute('aria-label', officialPlaying ? '원곡 정지' : '공식 원곡 듣기');
  $('#custom-play').textContent = playing === 'custom' ? '■ 정지' : '▶ 재생';
}
function stop() {
  playGeneration++;
  clearTimeout(previewTimer);
  clearFingerInput();
  audio.stopAll();
  media.pause();
  officialPlaying = false;
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
  const midi = el.hasAttribute('data-blow') ? getMidiForHoles(closed) : NOTES[el.dataset.note]?.midi;
  if (midi == null) { toast('운지를 확인하세요'); return; }
  const unlocking = audio.unlock();
  if (playing || officialPlaying) stop();
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
  tapContacts.clear();
  if (inputMode === 'direct') closed.clear();
  syncHoles();
}
function refreshFingerSound() {
  const generation = ++fingerGeneration;
  clearTimeout(fingerTimer);
  const snapshot = fingers.snapshot;
  if (inputMode === 'direct') closed = new Set(snapshot.closed);
  syncHoles();
  const contacts = inputMode === 'direct' ? snapshot.contactCount : tapContacts.size;
  const midi = inputMode === 'direct' ? snapshot.midi : getMidiForHoles(closed);
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
  if (inputMode === 'direct') fingerTimer = setTimeout(sound, 35);
  else sound();
}
function beginFinger(pointerId, hole) {
  if (playing || officialPlaying || holds.size) stop();
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
  if (!fingers.pointers.has(pointerId) && !tapContacts.has(pointerId)) return;
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
    await audio.play(song.notes.map((id, i) => ({ midi: NOTES[id].midi + octave, beats: song.beats?.[i] || 1 })), {
      bpm,
      onNote(index) {
        if (generation !== playGeneration) return;
        $$('.mini-note.current').forEach(el => el.classList.remove('current'));
        if (index < 0) { highlight(null); return; }
        const midi = NOTES[song.notes[index]].midi;
        setFingering(midi);
        highlight(midi);
        document.querySelector(`[data-song="${song.id}"]`)?.querySelectorAll('.mini-note')[index]?.classList.add('current');
        if (selected?.id === song.id) $('#practice-sequence').children[index]?.querySelector('.mini-note').classList.add('current');
      },
      onEnd() {
        if (generation !== playGeneration) return;
        playing = null;
        if (inputMode === 'direct') { closed.clear(); syncHoles(); }
        updatePlaybackButtons();
        updatePracticeProgress();
      },
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
  $('#official-play').hidden = !selected?.officialAudio;
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
  const el = event.target.closest('[data-hole], [data-note]');
  if (!el || event.button !== 0) return;
  event.preventDefault();
  el.setPointerCapture?.(event.pointerId);
  if (el.dataset.hole) beginFinger(event.pointerId, Number(el.dataset.hole));
  else startHold(el, event.pointerId);
});
document.addEventListener('pointermove', event => {
  if (inputMode !== 'direct' || !fingers.pointers.has(event.pointerId)) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('#main-instrument [data-hole]');
  const hole = target ? Number(target.dataset.hole) : null;
  if (fingers.pointers.get(event.pointerId).hole === hole) return;
  fingers.move(event.pointerId, hole);
  refreshFingerSound();
});
document.addEventListener('pointerup', event => { releaseFinger(event.pointerId); endHold(event.pointerId); });
document.addEventListener('pointercancel', event => {
  if (fingers.pointers.has(event.pointerId) || tapContacts.has(event.pointerId)) clearFingerInput();
  endHold(event.pointerId);
});
document.addEventListener('lostpointercapture', event => { releaseFinger(event.pointerId); endHold(event.pointerId); });
document.addEventListener('click', event => {
  const el = event.target.closest('button');
  if (!el) return;
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
$('#official-play').onclick = async () => {
  if (officialPlaying) { stop(); return; }
  stop();
  if (!selected?.officialAudio) return;
  const generation = playGeneration;
  media.src = selected.officialAudio;
  media.volume = volume;
  officialPlaying = true;
  updatePlaybackButtons();
  try { await media.play(); if (generation !== playGeneration) media.pause(); }
  catch { if (generation === playGeneration) { officialPlaying = false; updatePlaybackButtons(); toast('원곡을 불러오지 못했습니다'); } }
};
media.onended = () => { officialPlaying = false; updatePlaybackButtons(); };
media.onerror = () => { if (officialPlaying) { officialPlaying = false; updatePlaybackButtons(); toast('원곡을 불러오지 못했습니다'); } };

$('#volume').value = volume * 100;
$('#volume-value').textContent = `${Math.round(volume * 100)}%`;
media.volume = volume;
$('#volume').oninput = event => {
  volume = Number(event.target.value) / 100;
  audio.setVolume(volume);
  media.volume = volume;
  $('#volume-value').textContent = `${Math.round(volume * 100)}%`;
  saveSettings();
};
$('#tempo').value = bpm;
$('#tempo-value').textContent = `${bpm} BPM`;
$('#tempo').oninput = event => { bpm = Number(event.target.value); $('#tempo-value').textContent = `${bpm} BPM`; saveSettings(); };
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

document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,select,textarea') || $$('dialog[open]').length) return;
  const note = noteEntries.find(([, value]) => value.key === event.key)?.[0];
  let el = note ? document.querySelector(`#main-instrument [data-note="${note}"]`) : null;
  if (!el && [' ', 'Enter'].includes(event.key) && event.target.matches('[data-note],[data-blow]')) el = event.target;
  if (el) { event.preventDefault(); startHold(el, `key${event.code}`); }
});
document.addEventListener('keyup', event => endHold(`key${event.code}`));
window.addEventListener('blur', () => { if (!officialPlaying) stop(); });
window.addEventListener('pagehide', stop);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
renderInstrument();
if (selectedId !== 'free' && selectedId !== 'custom' && !SONGS.some(song => song.id === selectedId)) selectedId = SONGS[0].id;
selectSong(selectedId, false);

window.ocarinaState = () => ({ mode, inputMode, maxTouches, directContacts: fingers.snapshot.contactCount, tapContacts: tapContacts.size, fingerMidi, playing, officialPlaying, selected: selected?.id ?? null, progress, closed: [...closed], currentMidi: getMidiForHoles(closed), activeMidi: audio.lastMidi, contextState: audio.context?.state ?? 'not-started', activeVoice: audio.activeVoice, heldPointers: holds.size, custom: [...custom], volume, octave });
