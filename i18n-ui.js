const strings = {
  ko: {
    playKey: (pitch, key) => `${pitch} 연주, 키보드 ${key}`,
    hole: (id, back) => `${back ? '뒷면 ' : ''}${id}번 구멍`,
    shift: '반음 조절', basePitch: '기본 음높이',
    shiftBy: offset => `${Math.abs(offset)}반음 ${offset > 0 ? '높게' : '낮게'}`,
    touches: count => `브라우저 보고 ${count}점 · 두 손가락 모드는 최대 2점 사용`,
    keyboardAvailable: '마우스·키보드 사용 가능',
    inputHints: {
      touch: '한 손가락으로 기본음, 다른 손가락으로 −3…+3 반음 조절. 기본음에서 떼면 정지.',
      simple: 'L·R·A·Y·X 기본음 · 손을 떼면 정지',
      direct: '실제 운지 조합 · 기본 5음에 최대 9점 터치 필요',
      tap: '구멍을 탭해 상태 유지 · 누르는 동안 발음',
    },
    selectSong: title => `${title} 선택`, playSong: title => `${title} 재생`, stopSong: title => `${title} 정지`,
    playSelected: '선택한 곡 재생', stopSelected: '선택한 곡 정지', freePlay: '자유 연주',
    complete: '연주 완료', checkFingering: '운지를 확인하세요',
    scoreAlt: title => `${title} 공식 전체 악보와 운지표`, scoreError: '악보를 불러오지 못했습니다',
    addPitch: pitch => `${pitch} 추가`, eightEntered: '8음 입력 완료', muted: '음량이 0%입니다.',
    closedHoles: holes => `닫는 구멍 ${holes || '없음'}`, audition: pitch => `${pitch} 들어보기`,
    audioUnsupported: '이 브라우저는 오디오 재생을 지원하지 않습니다.',
    audioRetry: '소리를 시작하지 못했습니다. 연주 버튼을 다시 눌러 주세요.',
  },
  en: {
    playKey: (pitch, key) => `Play ${pitch}, keyboard ${key}`,
    hole: (id, back) => `${back ? 'Back hole' : 'Hole'} ${id}`,
    shift: 'Pitch adjustment', basePitch: 'Base pitch',
    shiftBy: offset => `${Math.abs(offset)} semitone${Math.abs(offset) === 1 ? '' : 's'} ${offset > 0 ? 'up' : 'down'}`,
    touches: count => `Browser supports ${count} touch points. Two-finger mode uses up to 2.`,
    keyboardAvailable: 'Mouse and keyboard supported',
    inputHints: {
      touch: 'Hold a base note and use a second finger to shift it by up to 3 semitones. Release the base note to stop.',
      simple: 'Hold L, R, A, Y or X to play. Release to stop.',
      direct: 'Use the physical fingerings. The five base notes need up to 9 simultaneous touches.',
      tap: 'Tap holes to keep them covered. Hold to play.',
    },
    selectSong: title => `Select ${title}`, playSong: title => `Play ${title}`, stopSong: title => `Stop ${title}`,
    playSelected: 'Play selected song', stopSelected: 'Stop selected song', freePlay: 'Free play',
    complete: 'Song complete', checkFingering: 'Check your fingering',
    scoreAlt: title => `Official score and fingering chart for ${title}`, scoreError: 'Couldn’t load the score',
    addPitch: pitch => `Add ${pitch}`, eightEntered: 'All 8 notes entered', muted: 'Volume is set to 0%.',
    closedHoles: holes => `Covered holes: ${holes || 'none'}`, audition: pitch => `Listen to ${pitch}`,
    audioUnsupported: 'This browser doesn’t support audio playback.',
    audioRetry: 'Audio couldn’t start. Tap a note or the play button again.',
  },
  ja: {
    playKey: (pitch, key) => `${pitch}を演奏（キーボードの${key}）`,
    hole: (id, back) => `${back ? '裏側の' : ''}${id}番の穴`,
    shift: '半音調整', basePitch: '基本の音の高さ',
    shiftBy: offset => `${Math.abs(offset)}半音${offset > 0 ? '上げる' : '下げる'}`,
    touches: count => `同時タッチは最大${count}点。2本指モードでは最大2点を使います。`,
    keyboardAvailable: 'マウス・キーボード対応',
    inputHints: {
      touch: '片方の指で基本音を押し、もう片方で上下3半音まで調整します。基本音から指を離すと止まります。',
      simple: 'L・R・A・Y・Xを押して演奏。指を離すと止まります。',
      direct: '実物と同じ運指です。基本の5音には最大9点の同時タッチが必要です。',
      tap: '穴をタップするたびに開閉を切り替えます。指を置いている間だけ音が鳴ります。',
    },
    selectSong: title => `${title}を選ぶ`, playSong: title => `${title}を再生`, stopSong: title => `${title}を停止`,
    playSelected: '選んだ曲を再生', stopSelected: '選んだ曲を停止', freePlay: '自由演奏',
    complete: '演奏完了', checkFingering: '運指を確認してください',
    scoreAlt: title => `${title}の公式楽譜と運指表`, scoreError: '楽譜を読み込めませんでした',
    addPitch: pitch => `${pitch}を追加`, eightEntered: '8音の入力が完了しました', muted: '音量が0%です。',
    closedHoles: holes => holes ? `ふさぐ穴：${holes}` : 'ふさぐ穴なし', audition: pitch => `${pitch}を試聴`,
    audioUnsupported: 'このブラウザーは音声再生に対応していません。',
    audioRetry: '音声を開始できませんでした。音符か再生ボタンをもう一度押してください。',
  },
};

export function uiStrings(language) {
  return Object.hasOwn(strings, language) ? strings[language] : strings.ko;
}

export function initialLanguage(storedSettings, preferredLanguages = []) {
  if (Object.hasOwn(strings, storedSettings?.language)) return storedSettings.language;
  if (storedSettings) return 'ko'; // A returning player with settings predating language choice.
  for (const locale of preferredLanguages) {
    const base = String(locale).toLowerCase().split('-')[0];
    if (Object.hasOwn(strings, base)) return base;
  }
  return 'ko';
}

export function audioErrorText(error, language) {
  const copy = uiStrings(language);
  return error?.code === 'audio-unsupported' || error?.message === strings.ko.audioUnsupported
    ? copy.audioUnsupported : copy.audioRetry;
}
