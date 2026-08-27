import test from 'node:test';
import assert from 'node:assert/strict';

import { toKatakana } from '../src/kana.js';
import { getLanguage, detectLanguage, tokenize } from '../src/lang/index.js';
import { pinyinToKatakana } from '../src/lang/zh.js';
import { decompose, applySandhi } from '../src/lang/ko.js';
import { EN_DICT } from '../src/lang/en-dict.js';
import { correctSyllable, isSyllable } from '../src/lang/vi.js';
import { unstack, correctSyllable as correctMyanmar } from '../src/lang/my.js';

const reads = (code, cases) => {
  const lang = getLanguage(code);
  for (const [word, expected] of Object.entries(cases)) {
    assert.equal(lang.read(word).kana, expected, `${code}: ${word}`);
  }
};

test('音素からカタカナへの変換', () => {
  assert.equal(toKatakana('kompyu:ta'), 'コンピュータ');
  assert.equal(toKatakana('SikaQgo'), 'シカッゴ');
  assert.equal(toKatakana('siN'), 'シング');
  assert.equal(toKatakana('iNgurando'), 'イングランド');
});

test('英語辞書 — 見出しは小文字の英字、読みはカタカナ', () => {
  for (const [word, kana] of Object.entries(EN_DICT)) {
    assert.match(word, /^[a-z']+$/, `見出しが不正: ${word}`);
    assert.match(kana, /^[ァ-ヴー]+$/, `読みが不正: ${word} → ${kana}`);
  }
});

test('英語 — 辞書にある語', () => {
  reads('en', {
    please: 'プリーズ', information: 'インフォメーション', entrance: 'エントランス',
    tickets: 'チケッツ', walked: 'ウォークト', printed: 'プリンテッド', apples: 'アップルズ',
  });
});

test('英語 — 辞書に無い語は推定に回る', () => {
  const en = getLanguage('en');
  const r = en.read('bottle');
  assert.equal(r.kana, 'ボトル');
  assert.equal(r.confident, false);
  assert.equal(en.read('future').kana, 'フューチャー');
  assert.equal(en.read('summer').kana, 'サマー');
  assert.equal(en.read('stopped').kana, 'ストップト');
  assert.equal(en.read('bigger').kana, 'ビッガー');
});

test('スペイン語 / イタリア語 / ポルトガル語', () => {
  reads('es', { gracias: 'グラシアス', señor: 'セニョル', cerveza: 'セルベサ', queso: 'ケソ' });
  reads('it', { pizza: 'ピッツァ', gnocchi: 'ニョッキ', ciao: 'チャオ', famiglia: 'ファミリア' });
  reads('pt', { obrigado: 'オブリガド', senhor: 'セニョル' });
});

test('ドイツ語 — 長音・語末無声化・ch', () => {
  reads('de', {
    Tag: 'ターク', ich: 'イヒ', München: 'ミュンヘン', Deutschland: 'ドイチュラント',
    Straße: 'シュトラーセ', Nacht: 'ナハト', Wasser: 'ヴァッサー', Achtung: 'アハトゥング',
  });
});

test('フランス語 — 鼻母音と語末の黙字', () => {
  reads('fr', {
    bonjour: 'ボンジュール', croissant: 'クロワサン', château: 'シャトー',
    vous: 'ヴー', roi: 'ロワ', fromage: 'フロマージュ', musée: 'ミュゼー',
  });
});

test('ロシア語 — 翻字とカタカナ', () => {
  const ru = getLanguage('ru');
  assert.equal(ru.read('Москва').kana, 'モスクヴァ');
  assert.equal(ru.read('Россия').kana, 'ロシア');
  assert.equal(ru.read('Анна').kana, 'アンナ');
  assert.equal(ru.read('борщ').kana, 'ボルシチ');
  assert.equal(ru.read('спасибо').roman, 'spasibo');
});

test('ギリシャ語', () => {
  const el = getLanguage('el');
  assert.equal(el.read('Ελλάδα').kana, 'エラダ');
  assert.equal(el.read('θάλασσα').kana, 'サラサ');
  assert.equal(el.read('Αθήνα').roman, 'athina');
});

test('韓国語 — 音節の分解', () => {
  const [s] = decompose('한');
  assert.deepEqual({ onset: s.onset, nucleus: s.nucleus, coda: s.coda }, { onset: 'h', nucleus: 'a', coda: 'n' });
});

test('韓国語 — 連音化・鼻音化・流音化', () => {
  const kana = (w) => getLanguage('ko').read(w).kana;
  assert.equal(kana('한국'), 'ハングク');
  assert.equal(kana('한국어'), 'ハングゴ');   // 連音化
  assert.equal(kana('국물'), 'クンムル');     // 鼻音化
  assert.equal(kana('신라'), 'シルラ');       // 流音化
  assert.equal(kana('학교'), 'ハッキョ');     // 濃音
  assert.equal(kana('좋아요'), 'チョアヨ');   // ㅎ の脱落
  assert.equal(kana('감사합니다'), 'カムサハムニダ');
  assert.equal(getLanguage('ko').read('서울').roman, 'seoul');
});

test('韓国語 — 終声は次の初声に渡る', () => {
  const [a, b] = applySandhi(decompose('한국어')).slice(1);
  assert.equal(a.coda, '');
  assert.equal(b.onset, 'g');
});

test('ベトナム語 — 音節を分解して読む', () => {
  const vi = getLanguage('vi');
  const kana = (w) => vi.read(w).kana;
  assert.equal(kana('Việt'), 'ヴィエット');
  assert.equal(kana('phở'), 'フォー');        // ơ は長母音
  assert.equal(kana('giữ'), 'ズー');
  assert.equal(kana('Nẵng'), 'ナン');
  assert.equal(kana('bánh'), 'バイン');       // anh は母音がずれる
  assert.equal(kana('khách'), 'カック');      // ach は詰まる
  assert.equal(kana('lịch'), 'リック');
  assert.equal(kana('nước'), 'ヌオック');
  assert.equal(kana('Nguyễn'), 'ングエン');
  assert.equal(kana('người'), 'ングオイ');
  assert.equal(kana('không'), 'コン');
  assert.equal(kana('quán'), 'クアン');
  assert.equal(kana('những'), 'ニュン');
});

test('ベトナム語 — 声調を読みに添える', () => {
  const vi = getLanguage('vi');
  assert.deepEqual(
    ['cà', 'cá', 'cả', 'cã', 'cạ', 'ca'].map((w) => vi.read(w).tone),
    ['huyền', 'sắc', 'hỏi', 'ngã', 'nặng', 'ngang'],
  );
  assert.equal(vi.read('phở').sign, 'ˇ');
  assert.equal(vi.read('ba').sign, '');
});

test('ベトナム語 — 北部と南部で読みが変わる', () => {
  const vi = getLanguage('vi');
  const north = (w) => vi.read(w, { dialect: 'north' }).kana;
  const south = (w) => vi.read(w, { dialect: 'south' }).kana;
  assert.equal(north('dài'), 'ザイ');
  assert.equal(south('dài'), 'ヤイ');
  assert.equal(north('rất'), 'ザット');
  assert.equal(south('rất'), 'ラット');
  assert.equal(north('và'), 'ヴァ');
  assert.equal(south('và'), 'ヤ');
  assert.equal(north('sinh'), 'シン');
  assert.equal(south('sinh'), 'シン');
});

test('ベトナム語 — 音節として成り立つかを判定する', () => {
  for (const w of ['xin', 'chào', 'nước', 'khách', 'Nguyễn', 'quyền', 'pho']) {
    assert.equal(isSyllable(w), true, w);
  }
  for (const w of ['nưoc', 'ơng', 'bànn', 'qq']) {
    assert.equal(isSyllable(w), false, w);
  }
});

test('ベトナム語 — 文字認識の綴りの誤りを直す', () => {
  // 記号が一部読めているときだけ、足りない記号を補う
  assert.equal(correctSyllable('nưoc').text, 'nươc');
  assert.equal(correctSyllable('nuơc').text, 'nươc');
  assert.equal(correctSyllable('Viẹt').text, 'Việt');
  assert.equal(correctSyllable('ngưòi').text, 'người');
  assert.equal(correctSyllable('Đuờng').text, 'Đường');

  // 記号が1つも無い語は、元からそうなのか読み落としか区別できないので触らない
  assert.equal(correctSyllable('nuoc').changed, false);
  assert.equal(correctSyllable('duong').changed, false);

  // 正しい綴りはそのまま
  assert.equal(correctSyllable('chào').changed, false);
  assert.equal(correctSyllable('tiếng').changed, false);

  // 直しようがない語も、勝手に変えない
  assert.equal(correctSyllable('bànn').changed, false);
});

test('ベトナム語 — 読めない綴りでも当て読みを返す', () => {
  const r = getLanguage('vi').read('bànn');
  assert.equal(r.confident, false);
  assert.ok(r.kana.length > 0);
});

test('ビルマ語 — 音節に切って読む', () => {
  const my = getLanguage('my');
  const kana = (w) => my.read(w).kana;
  assert.equal(kana('မြန်မာ'), 'ミャンマー');
  assert.equal(kana('ရေ'), 'イェー');            // ေ は子音のあとに置かれる
  assert.equal(kana('ကျောင်း'), 'チャウン');      // ကျ は破擦音になる
  assert.equal(kana('စာအုပ်'), 'サーオウッ');
  assert.equal(kana('ဆေးရုံ'), 'セーˊヨウン');
  assert.equal(kana('ဘဏ်'), 'バン');             // ဏ် も -an
  assert.equal(kana('လေဆိပ်'), 'レーセイッ');
  assert.equal(my.read('ရဲစခန်း').roman, 'yesakhan');
  assert.equal(my.read('မြန်မာ').roman, 'myanma');
  // 1音節のときは声調記号を別に返す（色を分けて添えるため）
  assert.equal(my.read('ကျောင်း').sign, 'ˊ');
});

test('ビルマ語 — 積み重ねをほどく', () => {
  // 「C1 ္ C2」は C1 が前の音節の末子音になる
  assert.equal(unstack('မန္တလေး'), 'မန်တလေး');
  assert.equal(getLanguage('my').read('မန္တလေး').kana, 'マンダレーˊ');
  // キンズィ（င်္）も同じ
  assert.equal(getLanguage('my').read('မင်္ဂလာပါ').kana, 'ミンガラーパー');
});

test('ビルマ語 — 記号の並び順が違っても同じ読みになる', () => {
  const my = getLanguage('my');
  // ော は ေ + ာ。文字認識が ာ + ေ の順で返しても同じに読めなければならない
  assert.equal(my.read('ကော').kana, my.read('ကာေ').kana);
  // ုံ と ံု も同じ
  assert.equal(my.read('ရုံ').kana, my.read('ရံု').kana);
});

test('ビルマ語 — 独立母音と句読点', () => {
  const my = getLanguage('my');
  assert.equal(my.read('ဣ').kana, 'イ');
  assert.equal(my.read('ဦး').kana, 'ウー');
  assert.equal(my.read('ဩဂုတ်').kana, 'オーゴウッ');
  // 句読点は読みを壊さずそのまま残る
  assert.equal(my.read('မြန်မာ။').kana, 'ミャンマー။');
  assert.equal(my.read('၁၂၃').kana, '123');
});

test('ビルマ語 — 鼻音のあとの無声音は濁る', () => {
  const my = getLanguage('my');
  assert.equal(my.read('ရန်ကုန်').kana, 'ヤンゴウン');
  assert.equal(my.read('ဝင်ပေါက်').kana, 'ウィンバウッ');
  // 1音節ずつ読むときは、直前の音節を渡せば濁りが効く
  assert.equal(my.read('ပေါက်').kana, 'パウッ');
  assert.equal(my.read('ပေါက်', { after: 'ဝင်' }).kana, 'バウッ');
});

test('ビルマ語 — 声調を読みに添える', () => {
  const my = getLanguage('my');
  assert.equal(my.read('ကား').sign, 'ˊ');   // း 高く長く
  assert.equal(my.read('က').sign, '');       // 記号なし
});

test('ビルマ語 — 介子音 ွ の当て方は母音で変わる', () => {
  const my = getLanguage('my');
  assert.equal(my.read('သွား').kana, 'スワー');      // ア段の前は「ウ+ワ行」
  assert.equal(my.read('ထွက်').kana, 'トウェッ');    // エ段の前はそのまま
});

test('ビルマ語 — そっくりな字の取り違えを直す', () => {
  // ၀（ゼロ）と ဝ、၇ と ရ は字形が同じ
  assert.equal(correctMyanmar('၀င်').text, 'ဝင်');
  assert.equal(correctMyanmar('၇န်').text, 'ရန်');
  // もともと正しい綴りは触らない
  assert.equal(correctMyanmar('ဝင်').changed, false);
  assert.equal(correctMyanmar('မြန်').changed, false);
});

test('ビルマ語 — ルビは音節ごとに振る', () => {
  const my = getLanguage('my');
  assert.deepEqual(my.split('မြန်မာနိုင်ငံ'), ['မြန်', 'မာ', 'နိုင်', 'ငံ']);
  assert.equal(my.joinWith, '');
});

test('中国語 — ピンインからカタカナ', () => {
  assert.equal(pinyinToKatakana('běi'), 'ベイ');
  assert.equal(pinyinToKatakana('jīng'), 'ジン');
  assert.equal(pinyinToKatakana('zhōng'), 'ジョン');
  assert.equal(pinyinToKatakana('shuǐ'), 'シュイ');
  assert.equal(pinyinToKatakana('yuán'), 'ユエン');
  assert.equal(pinyinToKatakana('xiè'), 'シエ');
});

test('中国語 — 辞書を読み込めないときは理由を返す', () => {
  const zh = getLanguage('zh');
  assert.equal(zh.read('中国').unavailable, true);
});

test('言語の推定', () => {
  const cases = {
    en: 'Please keep this receipt for your records.',
    de: 'Bitte bewahren Sie diese Quittung für Ihre Unterlagen auf.',
    fr: 'Veuillez conserver ce reçu pour vos dossiers.',
    es: 'Por favor conserve este recibo para sus registros.',
    it: 'Si prega di conservare questa ricevuta per i propri archivi.',
    pt: 'Por favor guarde este recibo para os seus registos.',
    vi: 'Vui lòng giữ lại hóa đơn này để đối chiếu.',
    ru: 'Пожалуйста, сохраните этот чек.',
    ko: '이 영수증을 보관해 주세요.',
    zh: '请保留此收据以备查询。',
    el: 'Παρακαλώ φυλάξτε την απόδειξη.',
    my: 'ဤဘောက်ချာကို သိမ်းထားပါ။',
  };
  for (const [code, text] of Object.entries(cases)) {
    assert.equal(detectLanguage(text), code, text);
  }
});

test('ルビを振る単位への切り分け', () => {
  assert.deepEqual(
    tokenize('Hello, world', 'en').filter((t) => t.isWord).map((t) => t.text),
    ['Hello', 'world'],
  );
  assert.deepEqual(
    tokenize('中国語', 'zh').map((t) => t.text),
    ['中', '国', '語'],
  );
});
