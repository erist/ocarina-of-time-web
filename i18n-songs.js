import { SONGS, SCARECROW } from './songs.js';

const free = { id: 'free', title: '자유 연주', en: 'Free play' };
const originals = new Map([...SONGS, SCARECROW, free].map(song => [song.id, song]));

const en = {
  zelda: { effect: 'Play at a royal crest to activate a mechanism or summon a Great Fairy.' },
  time: { effect: 'Opens the Door of Time and moves blocks marked with the Symbol of Time.' },
  sun: { effect: 'Switches between day and night and briefly freezes ReDeads and Gibdos.' },
  storm: { effect: 'Calls down rain and opens hidden grottos. Play in the windmill as a child to drain the well.' },
  epona: { effect: 'Calls Epona. Play for a cow with an empty bottle to get milk.' },
  saria: { effect: 'Talk to Saria from afar, or play the song for Darunia and Mido.' },
  minuet: { destination: 'Sacred Forest Meadow', effect: 'Warps to the Sacred Forest Meadow near the entrance to the Forest Temple.' },
  bolero: { destination: 'Death Mountain Crater', effect: 'Warps to Death Mountain Crater near the Fire Temple.' },
  serenade: { destination: 'Lake Hylia', effect: 'Warps to Lake Hylia, home of the Water Temple.' },
  requiem: { destination: 'Desert Colossus', effect: 'Warps to the Desert Colossus at the entrance to the Spirit Temple.' },
  nocturne: { destination: 'Graveyard', effect: 'Warps to the ledge above Kakariko Graveyard at the entrance to the Shadow Temple.' },
  prelude: { destination: 'Temple of Time', effect: 'Returns you to the Temple of Time, where the Master Sword rests.' },
  scarecrow: {
    effect: 'Play your eight-note tune in certain places to summon a scarecrow you can reach with the Hookshot.',
    help: 'Enter the same eight notes you taught the scarecrow in the game.',
  },
};

// The twelve learned song titles follow Nintendo's Japanese sheet-music page.
// https://www.nintendo.com/jp/games/switch2/aa9ja/melody/index.html
const ja = {
  zelda: { title: 'ゼルダの子守歌', effect: '王家の紋章の前で演奏すると、仕掛けが動いたり、大妖精が現れたりします。' },
  time: { title: '時の歌', effect: '時の扉を開いたり、時の紋章が刻まれたブロックを動かしたりします。' },
  sun: { title: '太陽の歌', effect: '昼と夜を入れ替えます。リーデッドやギブドの動きをしばらく止めることもできます。' },
  storm: { title: '嵐の歌', effect: '雨を降らせ、隠し穴を開きます。子供時代に風車小屋で演奏すると、井戸の水が引きます。' },
  epona: { title: 'エポナの歌', effect: 'エポナを呼びます。空きビンを持って牛に聴かせると、ミルクがもらえます。' },
  saria: { title: 'サリアの歌', effect: '遠くにいるサリアと話せます。ダルニアやミドに聴かせることもできます。' },
  minuet: { title: '森のメヌエット', destination: '森の聖域', effect: '森の神殿の入口近くにある森の聖域へワープします。' },
  bolero: { title: '炎のボレロ', destination: 'デスマウンテン火口', effect: '炎の神殿近くのデスマウンテン火口へワープします。' },
  serenade: { title: '水のセレナーデ', destination: 'ハイリア湖畔', effect: '水の神殿があるハイリア湖畔へワープします。' },
  requiem: { title: '魂のレクイエム', destination: '巨大邪神像', effect: '魂の神殿の入口にある巨大邪神像へワープします。' },
  nocturne: { title: '闇のノクターン', destination: '墓地', effect: 'カカリコ村の墓地を見下ろす高台にある闇の神殿の入口へワープします。' },
  prelude: { title: '光のプレリュード', destination: '時の神殿', effect: 'マスターソードが眠る時の神殿へ戻ります。' },
  scarecrow: {
    title: 'カカシの歌',
    effect: '決めた8音を特定の場所で演奏すると、フックショットでつかまれるカカシが現れます。',
    help: 'ゲームでカカシに教えた8音を、同じ順番で入力してください。',
  },
  free: { title: '自由演奏' },
};

/** Return display strings without changing the caller's note order, ID or score. */
export function localizedSong(song, lang) {
  if (!song) return song;
  const original = originals.get(song.id === 'custom' ? 'scarecrow' : song.id);
  if (!original) return song;
  const translated = lang === 'en' ? en[original.id] : lang === 'ja' ? ja[original.id] : undefined;
  const result = { ...song, title: translated?.title ?? (lang === 'en' ? original.en : original.title) };
  for (const key of ['effect', 'destination', 'help']) {
    if (original[key]) result[key] = translated?.[key] ?? original[key];
  }
  return result;
}

const pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const solfege = {
  ko: ['도', '도♯', '레', '레♯', '미', '파', '파♯', '솔', '솔♯', '라', '라♯', '시'],
  ja: ['ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ'],
};

export function localizedPitch(midi, lang, fallback) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) return fallback ?? '';
  const octave = Math.floor(midi / 12) - 1;
  const pitch = pitchNames[midi % 12] + octave;
  if (lang === 'en') return pitch;
  if (lang === 'ja') {
    const register = octave < 5 ? '低い' : octave > 5 ? '高い' : '';
    return `${register}${solfege.ja[midi % 12]} · ${pitch}`;
  }
  const register = octave < 5 ? '낮은 ' : octave > 5 ? '높은 ' : '';
  return fallback ?? `${register}${solfege.ko[midi % 12]} · ${pitch}`;
}

const controllerLabels = {
  en: { 'L 스틱': 'Left stick', '십자키': 'D-pad' },
  ja: { 'L 스틱': 'Lスティック', '십자키': '十字キー' },
};

export function localizedControllerParts(item, lang) {
  const parts = item?.controllerParts ?? [];
  const labels = controllerLabels[lang];
  if (!labels) return [...parts];
  return parts.map(part => part.replace(/L 스틱|십자키/g, name => labels[name]));
}
