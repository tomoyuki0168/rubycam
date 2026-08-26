import test from 'node:test';
import assert from 'node:assert/strict';

import { toKatakana } from '../src/kana.js';
import { getLanguage, detectLanguage, tokenize } from '../src/lang/index.js';
import { pinyinToKatakana } from '../src/lang/zh.js';
import { decompose, applySandhi } from '../src/lang/ko.js';
import { EN_DICT } from '../src/lang/en-dict.js';

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

test('ベトナム語 — 声調記号を外して読む', () => {
  const vi = getLanguage('vi');
  assert.equal(vi.read('Việt').kana, 'ビエット');
  assert.equal(vi.read('phở').kana, 'フォ');
  assert.equal(vi.read('Nẵng').kana, 'ナン');
  assert.equal(vi.read('bánh').kana, 'バイン');
  assert.equal(vi.read('nước').kana, 'ヌオック');
  assert.equal(vi.read('cà').tone, 'huyền');
  assert.equal(vi.read('hai').tone, 'ngang');
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
