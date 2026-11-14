// Each entry lists Korean, English, and Japanese in that order.
// Only marked text leaves and named attributes are translated, preserving controls and SVGs.
const messages = {
  pageTitle: ["시간의 오카리나 · Hyrule Melody", "Ocarina of Time · Hyrule Melody", "時のオカリナ · Hyrule Melody"],
  description: ["휴대폰으로 연주하는 시간의 오카리나. 12곡의 악보와 공식 굿즈 운지.", "Play the Ocarina of Time on your phone with 12 song scores and fingerings for the official instrument.", "スマートフォンで時のオカリナを演奏。12曲の楽譜と公式楽器の運指を収録。"],
  logo: ["젤다의 전설 시간의 오카리나", "The Legend of Zelda: Ocarina of Time", "ゼルダの伝説 時のオカリナ"],
  openMenu: ["메뉴 열기", "Open menu", "メニューを開く"],
  instrument: ["오카리나 연주", "Play the ocarina", "オカリナ演奏"],
  lullaby: ["젤다의 자장가", "Zelda's Lullaby", "ゼルダの子守歌"],
  clearSelection: ["악보 접고 자유 연주", "Close score and switch to free play", "楽譜を閉じて自由演奏"],
  playSelected: ["선택한 곡 재생", "Play selected song", "選択した曲を再生"],
  restartPractice: ["연습 다시 시작", "Restart practice", "練習をやり直す"],
  noteOrder: ["연주 순서", "Note sequence", "演奏する順番"],
  enlargeScore: ["선택한 악보 크게 보기", "Enlarge selected score", "選択した楽譜を拡大"],
  menu: ["메뉴", "Menu", "メニュー"],
  closeMenu: ["메뉴 닫기", "Close menu", "メニューを閉じる"],
  menuItems: ["메뉴 항목", "Menu sections", "メニュー項目"],
  scores: ["악보", "Scores", "楽譜"],
  settings: ["설정", "Settings", "設定"],
  fingering: ["음계와 운지", "Notes and fingerings", "音階と運指"],
  sources: ["자료", "Sources", "参考資料"],
  scoreList: ["악보 목록", "Song library", "楽譜一覧"],
  categories: ["곡 분류", "Song categories", "曲の分類"],
  allSongs: ["전체 12", "All 12 songs", "全12曲"],
  adventure: ["모험", "Adventure", "冒険"],
  warp: ["워프", "Warp", "ワープ"],
  freePlay: ["자유 연주", "Free play", "自由演奏"],
  search: ["곡 검색", "Search songs", "曲を検索"],
  noResults: ["검색 결과 없음", "No songs found", "該当する曲はありません"],
  scarecrow: ["허수아비의 노래", "Scarecrow's Song", "カカシの歌"],
  instrumentSettings: ["연주 설정", "Instrument settings", "演奏設定"],
  language: ["언어", "Language", "言語"],
  orientation: ["화면 방향", "Screen orientation", "画面の向き"],
  rotateRight: ["세로 고정 → 가로 연주 ↻", "Portrait lock → play sideways ↻", "縦向きロック → 横向きで演奏 ↻"],
  rotateLeft: ["세로 고정 → 가로 연주 ↺", "Portrait lock → play sideways ↺", "縦向きロック → 横向きで演奏 ↺"],
  rotateAuto: ["브라우저 방향 그대로", "Follow browser orientation", "ブラウザーの向きに合わせる"],
  fingeringMode: ["운지 방식", "Fingering mode", "運指モード"],
  twoFingerMode: ["두 손가락 · 게임 19음", "Two fingers · 19 game notes", "2本指 · ゲームの19音"],
  officialMode: ["공식 12구멍 · 전체 25음", "Official 12-hole instrument · 25 notes", "公式12穴オカリナ · 全25音"],
  basicMode: ["기본 버튼 · 5음", "Basic buttons · 5 notes", "基本ボタン · 5音"],
  holeInput: ["구멍 입력", "Hole controls", "穴の押し方"],
  tapInput: ["탭해서 닫힘 유지", "Tap to toggle", "タップで開閉"],
  holdInput: ["누르는 동안 닫힘", "Hold to close", "押している間だけ閉じる"],
  volume: ["음량", "Volume", "音量"],
  reconnect: ["소리 다시 연결", "Reconnect audio", "音声を再接続"],
  reconnectAction: ["소리 다시 연결하고 시험음 듣기", "Reconnect audio and play a test note", "音声を再接続して試しに音を鳴らす"],
  tempo: ["재생 속도", "Playback speed", "再生速度"],
  pitch: ["연주·재생 음높이", "Instrument and playback pitch", "演奏・再生の音の高さ"],
  defaultPitch: ["기본 · B4–F6", "Default · B4–F6", "標準 · B4–F6"],
  lowerOctave: ["한 옥타브 낮게", "One octave lower", "1オクターブ下げる"],
  higherOctave: ["한 옥타브 높게", "One octave higher", "1オクターブ上げる"],
  haptics: ["터치 진동", "Touch vibration", "タッチ時の振動"],
  gameScale: ["게임 19음", "19 game notes", "ゲームの19音"],
  guide: ["기본음 버튼을 누른 채 다른 손가락으로 −3…+3을 조절하세요. 숫자 1칸은 반음입니다. 게임 컨트롤러와 키보드의 B는 연주 종료입니다.", "Hold a base note and use another finger to shift it by −3 to +3 semitones. Each step is one semitone. Press B on the game controller or keyboard to stop.", "基本音のボタンを押したまま、もう1本の指で−3〜+3の範囲を調整します。1目盛りは半音です。ゲームのコントローラーとキーボードではBで演奏を終了します。"],
  legend: ["● 닫음 · ○ 열림 · 아래 두 구멍은 뒷면", "● Closed · ○ Open · The bottom two holes are on the back.", "● 閉じる · ○ 開ける · 下の2つは裏面の穴"],
  note: ["음", "Note", "音"],
  twoFingers: ["두 손가락", "Two fingers", "2本指"],
  controller: ["컨트롤러", "Controller", "コントローラー"],
  physical: ["실물 운지", "Instrument fingering", "楽器の運指"],
  preview: ["미리 듣기", "Preview", "試聴"],
  extraNotes: ["실물·전자 오카리나 추가 6음", "6 extra notes on the physical and electronic ocarinas", "実物・電子オカリナの追加6音"],
  extraGuide: ["게임 범위 밖의 음입니다. 높은 파♯ 이상은 HORI 전자 악기의 확장 운지입니다.", "These notes are outside the game’s range. High F♯ and above use extended fingerings on the HORI electronic ocarina.", "ゲームの音域外の音です。高いファ♯以上はHORIの電子オカリナの拡張運指です。"],
  sourcesPanel: ["자료 안내", "Sources and credits", "出典・クレジット"],
  fanProject: ["비공식 팬 프로젝트. 직접 연주음은 공개 녹음을 분석해 조정한 합성음입니다. 원본과 완전히 같은 음색은 아닙니다.", "Unofficial fan project. The instrument uses synthesized tones modeled on public recordings. The tone differs slightly from the original.", "非公式のファンプロジェクトです。演奏音は公開録音を分析して調整した合成音で、原音とは多少音色が異なります。"],
  playbackInfo: ["곡 재생은 버튼과 같은 소리를 사용하며, 길게 끄는 음과 끝 여운을 줄였습니다. 로고·전체 악보는 공식 서버에서 불러옵니다.", "Songs use the same sound as the buttons, with shorter held notes and endings. The logo and full scores are loaded from the official site.", "曲の再生にはボタンと同じ音を使い、伸ばす音や終わりの余韻を短くしています。ロゴと楽譜は公式サイトから読み込みます。"],
  logoSource: ["Nintendo 공식 로고 출처 ↗", "Nintendo · Official logo ↗", "任天堂公式ロゴの出典 ↗"],
  scoreSource: ["Nintendo 공식 악보 ↗", "Nintendo · Official scores ↗", "任天堂公式楽譜 ↗"],
  horiSource: ["HORI 공식 운지표 ↗", "HORI · Official fingering chart ↗", "HORI公式運指表 ↗"],
  closeScarecrow: ["허수아비 노래 닫기", "Close Scarecrow's Song", "カカシの歌を閉じる"],
  customSequence: ["사용자 지정 8음", "Your eight-note sequence", "自分で決めた8音"],
  resetScarecrow: ["허수아비 노래 초기화", "Clear Scarecrow's Song", "カカシの歌をリセット"],
  playScarecrow: ["허수아비의 노래 재생", "Play Scarecrow's Song", "カカシの歌を再生"],
  selectScarecrow: ["허수아비 노래 선택", "Select Scarecrow's Song", "カカシの歌を選択"],
  originalScore: ["악보 원본 열기", "Open original score", "元の楽譜を開く"],
  closeScore: ["확대 악보 닫기", "Close enlarged score", "拡大表示を閉じる"],
};

const languageIndex = new Map([['ko', 0], ['en', 1], ['ja', 2]]);

export function applyStaticLanguage(lang, root = document) {
  const locale = languageIndex.has(lang) ? lang : 'ko';
  const index = languageIndex.get(locale);
  root.documentElement.lang = locale;
  for (const node of root.querySelectorAll('[data-i18n]')) {
    const text = messages[node.dataset.i18n][index];
    if (node.dataset.i18nAttrs) {
      for (const name of node.dataset.i18nAttrs.split(' ')) node.setAttribute(name, text);
    } else {
      node.textContent = text;
    }
  }
  root.querySelector('#language').value = locale;
}
