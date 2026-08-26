/** スペイン語 / イタリア語 / ポルトガル語 — 綴りと発音の対応が規則的な言語群 */
import { compile, transcribe, geminate } from './rules.js';
import { toKatakana } from '../kana.js';

const V = '[aeiouáéíóúàèìòùâêîôûäëïöüãõ]';

/* ---------------- スペイン語 ---------------- */
const esRules = compile([
  ['ch', 'tS'],
  ['ll', 'y'],
  ['rr', 'r'],
  [new RegExp(`qu(?=[ei])`), 'k'],
  [new RegExp(`gu(?=[eiéí])`), 'g'],
  [/gü/, 'gw'],
  [/c(?=[eiéí])/, 's'],
  ['c', 'k'],
  [/g(?=[eiéí])/, 'x'],
  ['g', 'g'],
  ['j', 'x'],
  ['h', ''],
  ['ñ', 'J'],
  ['v', 'b'],
  ['z', 's'],
  ['x', 'ks'],
  ['y', (t, c) => (c.atEnd || !/^[aeiouáéíóú]/.test(c.after) ? 'i' : 'y')],
  ['ü', 'u'],
  [/[aá]/, 'a'], [/[eé]/, 'e'], [/[ií]/, 'i'], [/[oó]/, 'o'], [/[uú]/, 'u'],
  ['b', 'b'], ['d', 'd'], ['f', 'f'], ['k', 'k'], ['l', 'l'], ['m', 'm'],
  ['n', 'n'], ['p', 'p'], ['q', 'k'], ['r', 'r'], ['s', 's'], ['t', 't'], ['w', 'w'],
]);

/* ---------------- イタリア語 ---------------- */
const itRules = compile([
  ['gli', 'li'],
  ['gn', 'J'],
  [/sch(?=[eiéè])/, 'sk'],
  [/sc(?=[eiéè])/, 'S'],
  [/sci(?=[aou])/, 'S'],
  [/ci(?=[aouAOU])/, 'tS'],
  [/gi(?=[aou])/, 'dZ'],
  [/ch/, 'k'],
  [/gh/, 'g'],
  [/c(?=[eiéèíì])/, 'tS'],
  ['c', 'k'],
  [/g(?=[eiéèíì])/, 'dZ'],
  ['g', 'g'],
  ['h', ''],
  ['z', 'ts'],
  ['qu', 'kw'],
  ['q', 'k'],
  [/[aà]/, 'a'], [/[eèé]/, 'e'], [/[iì]/, 'i'], [/[oòó]/, 'o'], [/[uù]/, 'u'],
  ['b', 'b'], ['d', 'd'], ['f', 'f'], ['j', 'y'], ['k', 'k'], ['l', 'l'],
  ['m', 'm'], ['n', 'n'], ['p', 'p'], ['r', 'r'], ['s', 's'], ['t', 't'],
  ['v', 'v'], ['w', 'w'], ['x', 'ks'], ['y', 'y'],
]);

/* ---------------- ポルトガル語 ---------------- */
const ptRules = compile([
  ['ch', 'S'],
  ['lh', 'ly'],
  ['nh', 'J'],
  ['rr', 'x'],
  ['ss', 's'],
  [/qu(?=[ei])/, 'k'],
  [/gu(?=[ei])/, 'g'],
  [/ão/, 'aun'],
  [/õe/, 'oin'],
  [/ãe/, 'ain'],
  [/c(?=[eií])/, 's'],
  ['ç', 's'],
  ['c', 'k'],
  [/g(?=[eií])/, 'Z'],
  ['g', 'g'],
  ['j', 'Z'],
  ['h', ''],
  [/^r/, 'x'],
  ['r', 'r'],
  [/s(?=$)/, 's'],
  [new RegExp(`s(?=${V})`), 's'],
  ['s', 's'],
  ['x', 'S'],
  ['z', 'z'],
  [/m(?=$)/, 'n'],
  [/[aáàâ]/, 'a'], ['ã', 'an'], [/[eéê]/, 'e'], [/[ií]/, 'i'],
  [/[oóô]/, 'o'], ['õ', 'on'], [/[uú]/, 'u'],
  ['b', 'b'], ['d', 'd'], ['f', 'f'], ['k', 'k'], ['l', 'l'], ['m', 'm'],
  ['n', 'n'], ['p', 'p'], ['q', 'k'], ['t', 't'], ['v', 'v'], ['w', 'w'], ['y', 'i'],
]);

function makeLang({ code, label, ocr, speech, rules, gem = true }) {
  return {
    code,
    label,
    ocr,
    speech,
    script: 'latin',
    read(word) {
      const w = word.toLowerCase();
      let ph = transcribe(w, rules);
      if (gem) ph = geminate(ph);
      return { kana: toKatakana(ph), phonemes: ph };
    },
  };
}

export const es = makeLang({
  code: 'es', label: 'スペイン語', ocr: 'spa', speech: 'es-ES', rules: esRules, gem: false,
});
export const it = makeLang({
  code: 'it', label: 'イタリア語', ocr: 'ita', speech: 'it-IT', rules: itRules,
});
export const pt = makeLang({
  code: 'pt', label: 'ポルトガル語', ocr: 'por', speech: 'pt-BR', rules: ptRules, gem: false,
});
