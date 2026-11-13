# 오카리나 자료와 확인 범위

확인일: 2026-11-13. 아래 공개 자료를 읽고 제품의 버튼 위치·운지라는 사실 정보를 직접 구현했다. 공식 이미지, PDF, 음악 파일은 앱 저장소나 배포 파일로 복제하지 않는다.

- [Nintendo 공식 출시 안내](https://www.nintendo.com/jp/topics/article/c6084b0b-594c-4506-90c9-89b3fbb6ed9b): 2026년 11월 5일 Switch 2 리메이크 출시, 실제 악기와 음성 인식을 통한 연주를 확인했다.
- [Nintendo 공식 악보 페이지](https://www.nintendo.com/jp/games/switch2/aa9ja/melody/index.html): 기본 6곡과 워프 6곡의 악보, 실제 오카리나 운지, 게임 음악 듣기를 제공한다. 게임에서 배운 곡만 음성으로 인식되며 본체 마이크 사용을 안내한다. 웹앱에서 사용자가 직접 확인하는 공식 자료의 원문이다.
- [HORI 공식 제품 페이지](https://hori.jp/products/nsx/nsx-261/), [공식 매뉴얼 안내](https://hori.jp/manual/nsx-261/), [2026-11-05 매뉴얼 PDF](https://hori.jp/image/2026/11/%E3%80%90jp%E3%80%91nsx-261_manual_261105.pdf): 3쪽 앞면 10개·뒷면 2개 터치 버튼과 입 부분 연주 버튼, 6쪽 자동 연주곡 배치, 7쪽 자연음·반음·전자 악기 전용 고음 운지를 확인했다. 버튼 번호는 이 매뉴얼을 따른다. 제품 앞모습에서 왼쪽 사선은 4→3→2→1, 5는 2 아래 작은 버튼이다. 오른쪽 사선은 10→9→8→7, 6은 8 위의 작은 버튼이다. 뒷면 11·12는 웹에서 별도 줄로 펼친다.
- [DU BOOKS가 공개한 Tim Summers의 음악 분석 발췌](https://note.com/dubooks/n/n99184f8fc0d4): 원작의 다섯 기본 실음 D5·F5·A5·B5·D6를 명시한다. 앱의 기본 합성 주파수는 이 음높이와 A4=440Hz의 평균율을 따른다. 공식 운지표의 오선 기보와 실음 옥타브를 혼동하지 않도록 코드에는 실음 MIDI 번호를 사용했다.

## 구현상 차이와 검증 한계

- 휴대폰에서는 12개의 구멍을 동시에 누를 수 없으므로 구멍을 탭해 닫힘 상태를 유지하고 연주 버튼을 누르는 방식을 사용한다. 물리 제품의 버튼 위치·운지 조합을 참고하지만 물리 악기의 조작감을 그대로 재현한 것은 아니다.
- 합성 음색은 오카리나 소리를 모사한다. Nintendo/HORI의 원본 녹음 샘플에 대한 복제·재배포 허가를 찾지 못했으며, 합성 음색이 게임 원본과 완전히 같다고 검증하지 않았다. 리메이크와 실제 Switch 2 기기의 음성 인식 성공 여부는 실기 검증이 필요하다.
- 공식 페이지가 공개되어 있다는 사실은 파일을 재배포할 수 있는 라이선스가 아니다. 공식 자료는 원래 호스트에서 표시하거나 원문 링크로 연결한다. 확인 당시 악보 페이지 HTTP 응답에는 `X-Frame-Options`나 CSP의 `frame-ancestors`가 없었으나, 이후 서버 정책에 따라 외부 표시가 제한될 수 있다.
- HORI의 높은 파♯부터 높은 라까지 네 가지 운지는 해당 전자 제품의 확장 운지다. 일반 도자기 오카리나의 운지라고 설명하지 않는다. 일부 레♯ 대체 운지는 공식 펌웨어 업데이트 후에 지원된다.
- 허수아비의 노래는 사용자가 게임에서 정하는 곡이므로 고정된 공식 악보가 없다. 12개의 고정 악보와 사용자 지정 곡을 구분한다.

## 2026 공식 공개 연주 음높이 측정

2026-11-13에 Nintendo 공식 악보 페이지에서 제공하는 MP3를 메모리에서만 디코딩했다. 음원 파일을 저장소·배포물에 넣지 않았다. 48kHz 모노 PCM의 약 85ms 구간을 대상으로 YIN 방식의 주기 추정과 FFT 스펙트럼을 대조했다. 아래는 음의 중심에 가까운 개별 구간 추정치이며 녹음 전체의 고정 주파수는 아니다.

| 기본 실음 | 평균율 기준 | 공개 녹음 측정 예 | 구간 중심 |
| --- | ---: | ---: | --- |
| D5 | 587.33Hz | 약 587.50Hz | [폭풍의 노래](https://www.nintendo.com/jp/games/switch2/aa9ja/assets/img/melody/melody_storm.mp3) 0.10초 |
| F5 | 698.46Hz | 약 701.57Hz | [폭풍의 노래](https://www.nintendo.com/jp/games/switch2/aa9ja/assets/img/melody/melody_storm.mp3) 0.30초 |
| A5 | 880.00Hz | 약 886.75Hz | [시간의 노래](https://www.nintendo.com/jp/games/switch2/aa9ja/assets/img/melody/melody_time.mp3) 0.30초 |
| B5 | 987.77Hz | 약 995.49Hz | [사리아의 노래](https://www.nintendo.com/jp/games/switch2/aa9ja/assets/img/melody/melody_saria.mp3) 0.60초 |
| D6 | 1174.66Hz | 약 1178.79Hz | [폭풍의 노래](https://www.nintendo.com/jp/games/switch2/aa9ja/assets/img/melody/melody_storm.mp3) 0.60초 |

이 결과는 앱 기본 음역 D5·F5·A5·B5·D6가 공식 공개 녹음에서도 쓰인다는 근거다. 녹음에는 작은 피치 변화와 배음이 있으므로 고정된 평균율 합성음과 파형이 같다는 뜻은 아니다.

공개 녹음의 옥타브도 곡마다 같지 않았다. [젤다의 자장가](https://www.nintendo.com/jp/games/switch2/aa9ja/assets/img/melody/melody_zelda.mp3)의 주요 주기·스펙트럼은 약 B6(1998Hz)·D7(2357Hz)·A6(1784Hz), [에포나의 노래](https://www.nintendo.com/jp/games/switch2/aa9ja/assets/img/melody/melody_epona.mp3)는 약 D5(595Hz)·B4(496Hz)·A4(444Hz)로 추정되었다. 따라서 이 시청용 녹음 하나를 게임의 모든 자유 연주 버튼과 동일한 음원이라고 간주하거나, 합성 전체 곡을 일괄적으로 같은 옥타브로 옮기지 않았다. 실기 버튼 음원과의 완전한 음색·튜닝 일치, Switch 2의 인식 성공률은 여전히 미검증이다.
