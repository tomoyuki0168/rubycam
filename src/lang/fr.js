/** フランス語 — 語末の黙字と鼻母音を明示的に扱う */
import { compile, transcribe } from './rules.js';
import { toKatakana } from '../kana.js';

const NOT_V = '(?![aeiouyâàêéèëîïôûùü])';
const NASAL_END = `${NOT_V}(?![nm])`;

const rules = compile([
  // 語末の黙字（2文字以上の語のみ）
  [/(?:ent|es|e|s|t|d|x|z|p|g)$/, (t, c) => (c.index === 0 ? fallbackFinal(t) : '')],

  ['œu', 'u'], ['oeu', 'u'],
  [/eaux?$/, 'o:'], ['eau', 'o:'],
  [/aill?e?$/, 'ai'],
  [/age$/, 'a:Z'],
  [/(?:ée|er|ez|é)$/, 'e:'],
  [new RegExp(`(?:ain|aim|ein|eim|yn|ym)${NASAL_END}`), 'an'],
  [new RegExp(`oin${NASAL_END}`), 'wan'],
  [new RegExp(`(?:an|am|en|em)${NASAL_END}`), 'an'],
  [new RegExp(`(?:on|om)${NASAL_END}`), 'on'],
  [new RegExp(`(?:un|um)${NASAL_END}`), 'an'],
  [new RegExp(`(?:in|im)${NASAL_END}`), 'an'],
  ['eur', 'u:r'],
  [/ou[psxtz]?$/, 'u:'],
  [/au[xspt]?$/, 'o:'],
  ['ou', 'u'],
  ['oi', 'wa'],
  ['au', 'o'],
  [/[ae]i/, 'e'],
  ['eu', 'u'],
  ['gn', 'J'],
  [/(?<=[aeiou])ill/, 'y'],
  ['ill', 'il'],
  [/(?<=[aeiou])il$/, 'y'],
  ['ch', 'S'],
  ['ph', 'f'],
  ['th', 't'],
  ['qu', 'k'],
  ['ss', 's'],
  [/(?<=[aeiouéèêâôû])s(?=[aeiouéèêâôû])/, 'z'],
  [/c(?=[eiyéè])/, 's'],
  ['ç', 's'],
  ['c', 'k'],
  [/g(?=[eiyéè])/, 'Z'],
  ['g', 'g'],
  ['j', 'Z'],
  ['h', ''],
  [/[éèêë]/, 'e'],
  [/[âà]/, 'a'],
  [/[îï]/, 'i'],
  ['ô', 'o'],
  [/[ûù]/, 'yu'],
  ['u', 'yu'],
  ['y', 'i'],
  ['w', 'v'],
  ['x', 'ks'],
  ['a', 'a'], ['e', 'e'], ['i', 'i'], ['o', 'o'],
  ['b', 'b'], ['d', 'd'], ['f', 'f'], ['k', 'k'], ['l', 'l'], ['m', 'm'],
  ['n', 'n'], ['p', 'p'], ['r', 'r'], ['s', 's'], ['t', 't'], ['v', 'v'], ['z', 'z'],
]);

// 1文字語（"e" など）まで消してしまわないための保険
function fallbackFinal(t) {
  return { ent: 'an', es: 'e', e: 'e', s: 's', t: 't', d: 'd', x: 'ks', z: 'z', p: 'p', g: 'g' }[t] ?? '';
}

export default {
  code: 'fr',
  label: 'フランス語',
  ocr: 'fra',
  speech: 'fr-FR',
  script: 'latin',
  read(word) {
    let ph = transcribe(word.toLowerCase(), rules);
    // 語末の r の前は長音になりやすい（bonjour → ボンジュール）
    ph = ph.replace(/([aiueo])r$/, '$1:r');
    return { kana: toKatakana(ph), phonemes: ph };
  },
};
