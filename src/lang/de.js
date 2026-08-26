/** ドイツ語 */
import { compile, transcribe, geminate } from './rules.js';
import { toKatakana } from '../kana.js';

const BACK = /[aouäöü]/; // ch の直前がこの母音なら「ハ行」、それ以外は「ヒ」寄り

const rules = compile([
  ['tsch', 'tS'],
  ['sch', 'S'],
  ['chs', 'ks'],
  ['ch', (t, c) => {
    const prev = c.before.slice(-1);
    if (BACK.test(prev)) return 'x';
    return /^[aeiouäöü]/.test(c.after) ? 'h' : 'hi';
  }],
  [/^sp/, 'Sp'],
  [/^st/, 'St'],
  [/^s(?=[aeiouäöü])/, 'z'],
  ['ß', 's'],
  ['ph', 'f'],
  ['th', 't'],
  ['pf', 'pf'],
  ['qu', 'kv'],
  [/ig$/, 'ihi'],
  [/er$/, 'a:'],
  ['ie', 'i:'],
  [/[ea]i/, 'ai'],
  [/[ea]y/, 'ai'],
  ['eu', 'oi'],
  ['äu', 'oi'],
  ['au', 'au'],
  ['aa', 'a:'], ['ee', 'e:'], ['oo', 'o:'],
  ['ah', 'a:'], ['eh', 'e:'], ['ih', 'i:'], ['oh', 'o:'], ['uh', 'u:'],
  ['äh', 'e:'], ['öh', 'e:'], ['üh', 'yu:'],
  ['ng', 'N'],
  ['nk', 'Nk'],
  ['v', 'f'],
  ['w', 'v'],
  ['z', 'ts'],
  ['j', 'y'],
  ['c', 'k'],
  ['ä', 'e'], ['ö', 'e'], ['ü', 'yu'], ['y', 'yu'],
  ['a', 'a'], ['e', 'e'], ['i', 'i'], ['o', 'o'], ['u', 'u'],
  ['b', 'b'], ['d', 'd'], ['f', 'f'], ['g', 'g'], ['h', 'h'], ['k', 'k'],
  ['l', 'l'], ['m', 'm'], ['n', 'n'], ['p', 'p'], ['r', 'r'], ['s', 's'],
  ['t', 't'], ['x', 'ks'],
]);

// アクセントの来ない接頭辞。ここは伸ばさない（bewahren → ベヴァーレン）
const UNSTRESSED_PREFIX = /^(be|ge|ver|zer|ent|emp|er)./;

/** 第1音節の母音が「単母音 + 子音1つ + 母音/語末」なら長音になる（Tag → ターク） */
function lengthenFirstSyllable(ph, word) {
  if (UNSTRESSED_PREFIX.test(word)) return ph;
  return ph.replace(
    /^([^aiueo]*)([aiueo])(?!:)(tS|dZ|ts|dz|kw|gw|[pbtdkgfvszSZTDmnJNlrRwy])([aiueo]|$)/,
    '$1$2:$3$4',
  );
}

/** 語末の有声閉鎖音は無声化する（Tag → ターク, -land → ラント） */
function devoiceFinal(ph) {
  return ph.replace(/b$/, 'p').replace(/d$/, 't').replace(/g$/, 'k');
}

export default {
  code: 'de',
  label: 'ドイツ語',
  ocr: 'deu',
  speech: 'de-DE',
  script: 'latin',
  read(word) {
    let ph = geminate(transcribe(word.toLowerCase(), rules));
    ph = lengthenFirstSyllable(ph, word.toLowerCase());
    ph = devoiceFinal(ph);
    // 子音前・語末の ch は「ハ」を補う（Nacht → ナハト）
    ph = ph.replace(/x(?![aiueo:])/g, 'xa');
    // 語末・子音前の tS は「チュ」（Deutschland → ドイチュラント）
    ph = ph.replace(/tS(?![aiueo:])/g, 'tSu');
    return { kana: toKatakana(ph), phonemes: ph };
  },
};
