/**
 * Reference data checked on 2026-11-13.
 *
 * The note sequences are the short game commands, not transcriptions of the
 * complete copyrighted arrangements. The score URLs below were read from Nintendo's own score modal.
 * Automatic playback uses the same synthesizer as the manual instrument.
 *
 * Basic sounding pitches are D5/F5/A5/B5/D6. The 2026 normal controls
 * L/R/A/Y/X and B to stop were verified against Nintendo game captures.
 * Synthesis approximates the game timbre;
 * see docs/controller-mapping.md and docs/audio-analysis.md.
 */
export const SOURCES = Object.freeze({
  official: 'https://www.nintendo.com/jp/games/switch2/aa9ja/melody/index.html',
  officialScores: 'https://www.nintendo.com/jp/games/switch2/aa9ja/modal/score.html',
  korean: 'https://www.nintendo.com/kr/games/switch2/aa9ja/dungeon/index.html',
  sequences: 'https://www.zeldadungeon.net/wiki/Category:Ocarina_of_Time_Songs',
  effects: 'https://zeldacentral.com/games/ocarina-of-time/ocarina-songs/',
  pitches: 'https://note.com/dubooks/n/n99184f8fc0d4',
});

export const PLAYBACK_NOTE = '버튼과 같은 소리로 짧고 또렷하게 재생합니다.';

export const NOTES = Object.freeze({
  D: Object.freeze({ midi: 74, label: '레', pitch: 'D5', key: '1', control: 'L' }),
  F: Object.freeze({ midi: 77, label: '파', pitch: 'F5', key: '2', control: 'R' }),
  A: Object.freeze({ midi: 81, label: '라', pitch: 'A5', key: '3', control: 'A' }),
  B: Object.freeze({ midi: 83, label: '시', pitch: 'B5', key: '4', control: 'Y' }),
  d: Object.freeze({ midi: 86, label: '높은 레', pitch: 'D6', key: '5', control: 'X' }),
});

const officialRoot = 'https://www.nintendo.com/jp/games/switch2/aa9ja/assets/img';

const entries = [
  {
    id: 'zelda', title: '젤다의 자장가', en: "Zelda's Lullaby", category: 'utility',
    notes: ['B', 'd', 'A', 'B', 'd', 'A'],
    effect: '왕가의 문양 앞에서 장치를 작동시키거나 대요정을 불러요.',
    color: '#c6a7eb',
    scoreFile: 'score_zelda.webp',
  },
  {
    id: 'time', title: '시간의 노래', en: 'Song of Time', category: 'utility',
    notes: ['A', 'D', 'F', 'A', 'D', 'F'],
    effect: '시간의 문을 열고, 시간의 문양이 새겨진 블록을 움직여요.',
    color: '#7ca9e6',
    scoreFile: 'score_time.webp',
  },
  {
    id: 'sun', title: '태양의 노래', en: "Sun's Song", category: 'utility',
    notes: ['A', 'F', 'd', 'A', 'F', 'd'],
    effect: '낮과 밤을 바꾸고, 리데드와 기브도를 잠시 멈춰요.',
    color: '#e7bd61',
    scoreFile: 'score_sun.webp',
  },
  {
    id: 'storm', title: '폭풍의 노래', en: 'Song of Storms', category: 'utility',
    notes: ['D', 'F', 'd', 'D', 'F', 'd'],
    effect: '비를 부르고 숨겨진 굴을 열어요. 소년 시절 풍차 안에서는 우물의 물이 빠져요.',
    color: '#93a4d5',
    scoreFile: 'score_storm.webp',
  },
  {
    id: 'epona', title: '에포나의 노래', en: "Epona's Song", category: 'utility',
    notes: ['d', 'B', 'A', 'd', 'B', 'A'],
    effect: '에포나를 불러요. 빈 병이 있을 때 소 앞에서 연주하면 우유를 얻어요.',
    color: '#db9976',
    scoreFile: 'score_epona.webp',
  },
  {
    id: 'saria', title: '사리아의 노래', en: "Saria's Song", category: 'utility',
    notes: ['F', 'A', 'B', 'F', 'A', 'B'],
    effect: '멀리 있는 사리아와 이야기해요. 다르니아와 미도 등에게 들려줄 수도 있어요.',
    color: '#91bf8a',
    scoreFile: 'score_saria.webp',
  },
  {
    id: 'minuet', title: '숲의 미뉴에트', en: 'Minuet of Forest', category: 'warp',
    notes: ['D', 'd', 'B', 'A', 'B', 'A'],
    effect: '숲의 신전 입구 근처, 숲의 성역으로 이동해요.',
    destination: '숲의 성역', color: '#84b47b',
    scoreFile: 'score_minuet.webp',
  },
  {
    id: 'bolero', title: '화염의 볼레로', en: 'Bolero of Fire', category: 'warp',
    notes: ['F', 'D', 'F', 'D', 'A', 'F', 'A', 'F'],
    effect: '불의 신전 근처, 데스마운틴 분화구로 이동해요.',
    destination: '데스마운틴 분화구', color: '#d88a70',
    scoreFile: 'score_bolero.webp',
  },
  {
    id: 'serenade', title: '물의 세레나데', en: 'Serenade of Water', category: 'warp',
    notes: ['D', 'F', 'A', 'A', 'B'],
    effect: '물의 신전이 있는 하일리아 호수로 이동해요.',
    destination: '하일리아 호수', color: '#73add9',
    scoreFile: 'score_serenade.webp',
  },
  {
    id: 'requiem', title: '영혼의 레퀴엠', en: 'Requiem of Spirit', category: 'warp',
    notes: ['D', 'F', 'D', 'A', 'F', 'D'],
    effect: '영혼의 신전 입구가 있는 거대 사신상 앞으로 이동해요.',
    destination: '거대 사신상', color: '#d4ac6d',
    scoreFile: 'score_requiem.webp',
  },
  {
    id: 'nocturne', title: '어둠의 녹턴', en: 'Nocturne of Shadow', category: 'warp',
    notes: ['B', 'A', 'A', 'D', 'B', 'A', 'F'],
    effect: '어둠의 신전 입구가 있는 카카리코 묘지 위쪽으로 이동해요.',
    destination: '카카리코 묘지', color: '#ac91cb',
    scoreFile: 'score_nocturne.webp',
  },
  {
    id: 'prelude', title: '빛의 프렐류드', en: 'Prelude of Light', category: 'warp',
    notes: ['d', 'A', 'd', 'A', 'B', 'd'],
    effect: '마스터 소드가 있는 시간의 신전으로 돌아가요.',
    destination: '시간의 신전', color: '#d9d3a7',
    scoreFile: 'score_prelude.webp',
  },
];

export const SONGS = Object.freeze(entries.map(({ scoreFile, ...song }) => Object.freeze({
  ...song,
  notes: Object.freeze(song.notes),
  officialScore: `${officialRoot}/modal_score/${scoreFile}`,
})));

export const SCARECROW = Object.freeze({
  id: 'scarecrow', title: '허수아비의 노래', en: "Scarecrow's Song", length: 8,
  effect: '게임에서 직접 정한 8음을 연주해, 특정 장소에 후크샷을 걸 수 있는 허수아비를 불러요.',
  help: '정해진 악보가 없어요. 게임에서 등록한 8음과 같은 순서로 저장해 주세요.',
});
