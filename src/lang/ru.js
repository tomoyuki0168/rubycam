/** ロシア語（キリル文字） */
import { compile, transcribe, collapseDoubles } from './rules.js';
import { toKatakana } from '../kana.js';

// 音素（カタカナ用）とラテン翻字を同時に持つ
const MAP = [
  ['щ', 'SitS', 'shch'],
  ['ж', 'Z', 'zh'],
  ['ш', 'S', 'sh'],
  ['ч', 'tS', 'ch'],
  ['ц', 'ts', 'ts'],
  ['х', 'x', 'kh'],
  ['ю', 'yu', 'yu'],
  ['я', 'ya', 'ya'],
  ['ё', 'yo', 'yo'],
  ['э', 'e', 'e'],
  ['ы', 'i', 'y'],
  ['й', 'y', 'y'],
  ['а', 'a', 'a'],
  ['б', 'b', 'b'],
  ['в', 'v', 'v'],
  ['г', 'g', 'g'],
  ['д', 'd', 'd'],
  ['е', 'e', 'e'],
  ['з', 'z', 'z'],
  ['и', 'i', 'i'],
  ['к', 'k', 'k'],
  ['л', 'l', 'l'],
  ['м', 'm', 'm'],
  ['н', 'n', 'n'],
  ['о', 'o', 'o'],
  ['п', 'p', 'p'],
  ['р', 'r', 'r'],
  ['с', 's', 's'],
  ['т', 't', 't'],
  ['у', 'u', 'u'],
  ['ф', 'f', 'f'],
  ['ь', '', "'"],
  ['ъ', '', ''],
];

const phonRules = compile([
  ['ия', 'ia'],
  // 語頭・母音のあとの е は「イェ」
  [/е/, (t, c) => (c.atStart || /[аеёиоуыэюя]$/.test(c.before) ? 'ye' : 'e')],
  // 軟音記号は直前の子音を口蓋化させる（ль → リ）
  [/[бвгдзклмнпрстфх]ь/, (t) => phonemeOf(t[0]) + 'yi'],
  ...MAP.map(([ru, ph]) => [ru, ph]),
]);

const romanRules = compile(MAP.map(([ru, , tr]) => [ru, tr]));

function phonemeOf(ch) {
  return MAP.find(([ru]) => ru === ch)?.[1] ?? '';
}

export default {
  code: 'ru',
  label: 'ロシア語',
  ocr: 'rus',
  speech: 'ru-RU',
  script: 'cyrillic',
  read(word) {
    const w = word.toLowerCase();
    let ph = transcribe(w, phonRules);
    // 口蓋化した子音のあとに母音が続くときは重複する i を落とす（Кремль 対策）
    ph = ph.replace(/yi(?=[aiueo])/g, 'y');
    // 重子音は日本語では重ねない（Россия → ロシア）。ただし н/м は残す（Анна → アンナ）
    ph = collapseDoubles(ph, 'nm');
    ph = ph.replace(/(b|d|g|v|z|Z)$/, (m) => ({ b: 'p', d: 't', g: 'k', v: 'f', z: 's', Z: 'S' })[m]);
    return { kana: toKatakana(ph), roman: transcribe(w, romanRules), phonemes: ph };
  },
};
