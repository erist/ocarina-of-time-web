// Alfred Music publishes these licensed digital piano arrangements. The Doremi
// print collection lists the twelve ocarina pieces as entries 36 through 47.
const alfred = 'https://www.alfred.com/products/the-legend-of-zeldatm-ocarina-of-timetm-';

export const scoreBook = {
  title: { ko: '젤다의 전설 베스트 컬렉션', en: 'The Legend of Zelda Best Collection', ja: 'ゼルダの伝説／ベスト・コレクション' },
  publisher: 'Doremi',
  url: 'https://sheetmusic.jp.yamaha.com/products/4514142084492',
  contents: { zelda: 36, epona: 37, sun: 38, saria: 39, time: 40, storm: 41,
    minuet: 42, bolero: 43, serenade: 44, nocturne: 45, prelude: 46, requiem: 47 },
};

export const ostScores = [
  { title: { ko: '타이틀 테마', en: 'Title Theme', ja: 'タイトルテーマ' }, slug: 'title-theme-00-ps-0015395' },
  { title: { ko: '젤다 공주의 테마', en: "Princess Zelda's Theme", ja: 'ゼルダ姫のテーマ' }, songId: 'zelda', slug: 'princess-zeldas-theme-00-ps-0015396' },
  { title: { ko: '하이랄 평원', en: 'Hyrule Field', ja: 'ハイラル平原' }, slug: 'hyrule-field-00-ps-0015397' },
  { title: { ko: '미로숲', en: 'Lost Woods', ja: '迷いの森' }, songId: 'saria', slug: 'lost-woods-00-ps-0015299' },
  { title: { ko: '겔드 협곡', en: 'Gerudo Valley', ja: 'ゲルドの谷' }, slug: 'gerudo-valley-00-ps-0015301' },
  { title: { ko: '폭풍의 노래', en: 'Song of Storms', ja: '嵐の歌' }, songId: 'storm', slug: 'song-of-storms-00-ps-0015399' },
].map(({ slug, ...score }) => ({ ...score, publisher: 'Alfred Music', url: alfred + slug }));
