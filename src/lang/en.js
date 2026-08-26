/**
 * 英語
 *
 * 綴りと発音の対応が不規則なので、二段構えにしている。
 *   1. 頻出語辞書（en-dict.js）に当てる。屈折語尾は落として再検索する。
 *   2. 外れた語は綴り→音素の規則で推定する。
 * 推定に回った語は confident: false を返すので、UI 側で控えめに表示できる。
 */
import { compile, transcribe, collapseDoubles, geminate } from './rules.js';
import { toKatakana } from '../kana.js';
import { EN_DICT } from './en-dict.js';

// u の読み。s, l, r などのあとは「ウー」、それ以外は「ユー」になる
const longU = (before) => (/[slrjtdnzSZ]$/.test(before) ? 'u:' : 'yu:');

const rules = compile([
  // 接尾辞（位置が語末に来たときだけ当たる）
  [/ation$/, 'e:Son'],
  [/tion$/, 'Son'],
  [/sion$/, 'Zon'],
  [/[ct]ious$/, 'Sas'],
  [/ious$/, 'ias'],
  [/ous$/, 'as'],
  [/erence$/, 'arans'],
  [/[ae]nce$/, 'ans'],
  [/ture$/, 'tSa:'],
  [/eipt$/, 'i:t'],
  [/ough$/, 'o:'],
  [/ight$/, 'ait'],
  [/ing$/, 'iN'],
  [/ed$/, (t, c) => {
    if (/[td]$/.test(c.before)) return 'eQd';
    return /[ptkfsx]$|sh$|ch$/.test(c.before) ? 't' : 'd';
  }],
  [/dge$/, 'dZ'],
  [/able$/, 'abol'],
  [/tle$/, 'tol'],
  [/([bcdfgklmnprstvz])le$/, (t) => t[0].replace('c', 'k') + 'ol'],
  [/ce$/, 's'],
  [/ge$/, 'dZ'],
  [/ly$/, 'li:'],
  [/y$/, 'i:'],
  [/e$/, ''],

  // 二重字
  ['tch', 'tS'],
  ['sch', 'sk'],
  ['sh', 'S'],
  ['ch', 'tS'],
  ['ph', 'f'],
  ['th', 'T'],
  ['wh', 'w'],
  ['ck', 'k'],
  ['ng', 'N'],
  ['qu', 'kw'],
  [/^kn/, 'n'],
  [/^wr/, 'r'],
  [/^ps/, 's'],
  ['gh', ''],
  ['alk', 'o:k'],
  [/(?<=c)ei/, 'i:'],

  // r 音つき母音
  ['ear', 'ia'],
  ['air', 'ea'],
  ['are', 'ea'],
  ['ore', 'o:'],
  ['ar', 'a:'],
  ['er', 'a:'],
  ['ir', 'a:'],
  ['ur', 'a:'],
  ['or', 'o:'],

  // 母音字の組み合わせ
  ['eau', 'ou'],
  ['ee', 'i:'],
  ['ea', 'i:'],
  ['oo', 'u:'],
  ['ou', 'au'],
  ['ow', 'au'],
  ['oa', 'ou'],
  ['ai', 'ei'],
  ['ay', 'ei'],
  ['ey', 'ei'],
  ['oi', 'oi'],
  ['oy', 'oi'],
  ['au', 'o:'],
  ['aw', 'o:'],
  ['ew', (t, c) => longU(c.before)],
  ['ie', 'i:'],
  ['ui', 'u:'],

  // 語末が「子音 + e」なら直前の母音は長い（magic e）
  [/a(?=[^aeiou]e$)/, 'ei'],
  [/e(?=[^aeiou]e$)/, 'i:'],
  [/i(?=[^aeiou]e$)/, 'ai'],
  [/o(?=[^aeiou]e$)/, 'ou'],
  [/u(?=[^aeiou]e$)/, (t, c) => longU(c.before)],
  [/u(?=[^aeiou][aeiouy])/, (t, c) => longU(c.before)],

  [/cc(?=[eiy])/, 'ks'],
  ['gg', 'gg'],
  ['cc', 'kk'],
  [/wa(?=[tsn])/, 'wo'],
  [/c(?=[eiy])/, 's'],
  ['c', 'k'],
  [/g(?=[eiy])/, 'dZ'],
  ['g', 'g'],
  ['j', 'dZ'],
  ['x', 'ks'],
  [/y(?=[aeiou])/, 'y'],
  ['y', 'i'],

  ['a', 'a'], ['e', 'e'], ['i', 'i'], ['o', 'o'], ['u', 'a'],
  ['b', 'b'], ['d', 'd'], ['f', 'f'], ['h', 'h'], ['k', 'k'], ['l', 'l'],
  ['m', 'm'], ['n', 'n'], ['p', 'p'], ['r', 'r'], ['s', 's'], ['t', 't'],
  ['v', 'b'], ['w', 'w'], ['z', 'z'],
]);

// 屈折語尾: [語尾, 元に戻す関数, 付け足すカタカナ]
const INFLECTIONS = [
  ['ies', (s) => `${s.slice(0, -3)}y`, 'ズ'],
  ['es', (s) => s.slice(0, -2), 'ズ'],
  ['s', (s) => s.slice(0, -1), 'ズ'],
  ['ing', (s) => s.slice(0, -3), 'イング'],
  ['ing', (s) => `${s.slice(0, -3)}e`, 'イング'],
  ['ed', (s) => s.slice(0, -1), 'ド'],
  ['ed', (s) => s.slice(0, -2), 'ド'],
  ['ly', (s) => s.slice(0, -2), 'リー'],
  ["'s", (s) => s.slice(0, -2), 'ズ'],
];

// 無声音のあとの複数形は「ツ / クス / プス」になる（tickets → チケッツ）
const PLURAL_MERGE = { ト: 'ツ', ド: 'ズ', ク: 'クス', プ: 'プス', フ: 'フス', ッ: 'ツ' };
// -ed も直前の音で変わる（walked → ウォークト / printed → プリンテッド）
const PAST_MERGE = { ト: 'テッド', ド: 'デッド' };
const VOICELESS_TAIL = /[クプフスツチ]$|[シ][ュ]$/;

function joinSuffix(kana, tail) {
  if (tail === 'ズ') {
    const merged = PLURAL_MERGE[kana.slice(-1)];
    return merged ? kana.slice(0, -1) + merged : kana + tail;
  }
  if (tail === 'ド') {
    const merged = PAST_MERGE[kana.slice(-1)];
    if (merged) return kana.slice(0, -1) + merged;
    return VOICELESS_TAIL.test(kana) ? `${kana}ト` : kana + tail;
  }
  return kana + tail;
}

function estimate(word) {
  // 語尾の前で子音が重なる綴りは促音になる（stopped → ストップト）。
  // 語幹の中の重子音は日本語表記では重ねない（bottle → ボトル / summer → サマー）。
  const doubledBeforeSuffix = /([bcdfgkpt])\1(ed|ing|er|est|y)$/.test(word);
  const raw = transcribe(word, rules);
  let ph = doubledBeforeSuffix ? geminate(raw) : collapseDoubles(raw);
  // 短母音 + 語末の閉鎖音・破擦音 は促音を挟む（cut → カット, fish → フィッシュ）
  ph = ph.replace(/([aiueo])(p|t|k|b|d|g|tS|S)(?=[tds]?$)/, '$1Q$2');
  return toKatakana(ph);
}

export default {
  code: 'en',
  label: '英語',
  ocr: 'eng',
  speech: 'en-US',
  script: 'latin',
  read(word) {
    const w = word.toLowerCase().replace(/[^a-z']/g, '');
    if (!w) return { kana: '', confident: true };
    if (EN_DICT[w]) return { kana: EN_DICT[w], confident: true };

    for (const [suffix, stem, tail] of INFLECTIONS) {
      if (!w.endsWith(suffix) || w.length <= suffix.length + 1) continue;
      const base = stem(w);
      if (EN_DICT[base]) return { kana: joinSuffix(EN_DICT[base], tail), confident: true };
    }
    // 辞書に無い語も、語幹だけ推定して語尾を足したほうが自然になる（cats → キャッツ）
    for (const [suffix, stem, tail] of INFLECTIONS) {
      if (suffix !== 's' && suffix !== 'es') continue;
      if (!w.endsWith(suffix) || w.length < suffix.length + 3) continue;
      const base = stem(w);
      // -s, -x, -ch, -sh のあとの -es は「ィズ」
      const t = suffix === 'es' && /(s|x|z|ch|sh)$/.test(base) ? 'ィズ' : tail;
      return { kana: joinSuffix(estimate(base), t), confident: false };
    }
    return { kana: estimate(w), confident: false };
  },
};
