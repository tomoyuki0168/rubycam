/** ギリシャ語 */
import { compile, transcribe, collapseDoubles } from './rules.js';
import { toKatakana } from '../kana.js';

const strip = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC').toLowerCase();

const phonRules = compile([
  ['μπ', 'b'],
  ['ντ', 'd'],
  ['γκ', 'g'],
  ['γγ', 'Ng'],
  ['τσ', 'ts'],
  ['τζ', 'dz'],
  [/αυ(?=[θκξπστφχψ])/, 'af'],
  ['αυ', 'av'],
  [/ευ(?=[θκξπστφχψ])/, 'ef'],
  ['ευ', 'ev'],
  ['ου', 'u'],
  ['αι', 'e'],
  ['ει', 'i'],
  ['οι', 'i'],
  ['υι', 'i'],
  ['α', 'a'], ['ε', 'e'], ['η', 'i'], ['ι', 'i'], ['ο', 'o'], ['ω', 'o'], ['υ', 'i'],
  ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ζ', 'z'], ['θ', 'T'], ['κ', 'k'],
  ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'ks'], ['π', 'p'], ['ρ', 'r'],
  ['σ', 's'], ['ς', 's'], ['τ', 't'], ['φ', 'f'], ['χ', 'x'], ['ψ', 'ps'],
]);

const romanRules = compile([
  ['μπ', 'b'], ['ντ', 'd'], ['γκ', 'g'], ['ου', 'ou'], ['αι', 'ai'], ['ει', 'ei'],
  ['α', 'a'], ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'], ['ζ', 'z'], ['η', 'i'],
  ['θ', 'th'], ['ι', 'i'], ['κ', 'k'], ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'x'],
  ['ο', 'o'], ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'], ['υ', 'y'],
  ['φ', 'f'], ['χ', 'ch'], ['ψ', 'ps'], ['ω', 'o'],
]);

export default {
  code: 'el',
  label: 'ギリシャ語',
  ocr: 'ell',
  speech: 'el-GR',
  script: 'greek',
  read(word) {
    const w = strip(word);
    const ph = collapseDoubles(transcribe(w, phonRules));
    return { kana: toKatakana(ph), roman: transcribe(w, romanRules), phonemes: ph };
  },
};
