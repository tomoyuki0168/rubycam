/**
 * ベトナム語
 *
 * ラテン文字だが、声調記号と母音記号が同じ位置に付く。
 * 先に声調記号だけを外し（母音の質を表す ă â ê ô ơ ư đ は残す）、
 * そのうえで頭子音・母音・末子音を当てる。
 * 声調そのものはカタカナで表しきれないため、原語に付いた記号から番号で補助表示する。
 */
import { compile, transcribe } from './rules.js';
import { toKatakana } from '../kana.js';

const TONE_MARKS = /[̣̀́̃̉]/g;
const TONE_NAME = {
  '̀': 'huyền', '́': 'sắc', '̃': 'ngã', '̉': 'hỏi', '̣': 'nặng',
};

/** 声調記号だけを外す（母音の質を表す記号は残す） */
export function stripTone(word) {
  return word.normalize('NFD').replace(TONE_MARKS, '').normalize('NFC');
}

export function toneOf(word) {
  const d = word.normalize('NFD');
  for (const ch of d) if (TONE_NAME[ch]) return TONE_NAME[ch];
  return 'ngang';
}

const rules = compile([
  // 頭子音（長いものから）
  [/^ngh/, 'N'],
  [/^ng/, 'N'],
  [/^nh/, 'J'],
  [/^ch/, 'tS'],
  [/^tr/, 'tS'],
  [/^th/, 't'],
  [/^ph/, 'f'],
  [/^kh/, 'k'],
  [/^gh/, 'g'],
  [/^gi(?=[aăâeêioôơuưy])/, 'z'],
  [/^gi/, 'zi'],
  [/^qu/, 'ku'],
  [/^đ/, 'd'],
  [/^d/, 'z'],
  [/^r/, 'r'],
  [/^x/, 's'],
  [/^s/, 's'],
  [/^v/, 'b'],
  [/^[ck]/, 'k'],

  // 末子音を含むまとまり
  [/anh$/, 'ain'],
  [/ach$/, 'aik'],
  [/inh$/, 'in'],
  [/ênh$/, 'en'],
  [/nh$/, 'n'],
  [/ng$/, 'n'],
  [/ch$/, 'k'],
  [/c$/, 'k'],

  // 母音の連なり
  ['ươ', 'uo'], ['uô', 'uo'], ['ưa', 'ua'], ['iê', 'ie'], ['yê', 'ie'],
  ['ây', 'ai'], ['ay', 'ai'], ['ai', 'ai'], ['ao', 'ao'], ['âu', 'au'], ['au', 'au'],
  ['eo', 'eo'], ['êu', 'eu'], ['ia', 'ia'], ['iu', 'iu'],
  ['oa', 'oa'], ['oe', 'oe'], ['oi', 'oi'], ['ôi', 'oi'], ['ơi', 'oi'],
  ['ua', 'ua'], ['uê', 'ue'], ['ui', 'ui'], ['uy', 'ui'], ['ưu', 'uu'],

  // 単母音
  [/[aăâ]/, 'a'], [/[eê]/, 'e'], [/[iy]/, 'i'], [/[oôơ]/, 'o'], [/[uư]/, 'u'],

  // 残りの子音
  ['b', 'b'], ['g', 'g'], ['h', 'h'], ['k', 'k'], ['l', 'l'], ['m', 'm'],
  ['n', 'n'], ['p', 'p'], ['t', 't'], ['đ', 'd'], ['d', 'z'], ['v', 'b'],
  ['x', 's'], ['s', 's'], ['r', 'r'], ['c', 'k'],
]);

export default {
  code: 'vi',
  label: 'ベトナム語',
  ocr: 'vie',
  speech: 'vi-VN',
  script: 'latin',
  // ベトナム語は音節ごとに空白で区切って書くので、単語ではなく音節単位で読む
  read(word) {
    const syllable = stripTone(word).toLowerCase();
    let ph = transcribe(syllable, rules);
    // 末子音の p / t / k は詰まって聞こえる（một → モット）
    ph = ph.replace(/([aiueo])([ktp])$/, '$1Q$2');
    return { kana: toKatakana(ph), tone: toneOf(word), phonemes: ph };
  },
};
