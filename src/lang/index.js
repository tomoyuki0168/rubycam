/** 対応言語の一覧と、撮った文字からの言語推定 */
import en from './en.js';
import zh from './zh.js';
import ko from './ko.js';
import vi from './vi.js';
import ru from './ru.js';
import el from './el.js';
import de from './de.js';
import fr from './fr.js';
import { es, it, pt } from './romance.js';

export const LANGUAGES = [en, zh, ko, vi, es, fr, de, it, pt, ru, el];

export const byCode = Object.fromEntries(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code) {
  return byCode[code] ?? en;
}

const SCRIPT_TEST = [
  ['ko', /[가-힣]/],
  ['zh', /[一-鿿㐀-䶿]/],
  ['ru', /[Ѐ-ӿ]/],
  ['el', /[Ͱ-Ͽἀ-῿]/],
];

// ラテン文字圏は綴りの癖と機能語で見分ける
const LATIN_HINTS = [
  ['vi', /[ăâêôơưđ]|[aeiouy][̣̀́̃̉]/i, /\b(và|của|người|không|được|những|trong|với)\b/i],
  ['de', /[äöüß]/i, /\b(der|die|das|und|ist|nicht|ein|eine|mit|sich|auf|für|dass)\b/i],
  ['fr', /[çœàèùêâî]/i, /\b(le|la|les|des|une|est|et|pour|dans|avec|sur|vous|nous|que)\b/i],
  ['es', /[ñ¿¡]/i, /\b(el|los|las|una|es|para|con|por|que|del|más|pero|como)\b/i],
  ['pt', /[ãõ]|ção|ções|nh|lh/i, /\b(não|uma|são|os|as|seu|seus|sua|suas|você|muito|também|dos|das|obrigado|guarde)\b/i],
  ['it', /\b(gli|degli|della|dello)\b/i, /\b(il|lo|la|di|che|per|con|non|sono|una|del|nel)\b/i],
  ['en', /^$/, /\b(the|and|of|to|in|is|for|with|you|are|this|that|from|not)\b/i],
];

/**
 * 文字種と綴りの癖から言語を推定する。
 * ベトナム語は声調記号、ドイツ語はウムラウトのように、
 * 「その言語にしか出ない字」を強い手がかりとして扱う。
 */
export function detectLanguage(text) {
  const t = text.normalize('NFC');
  for (const [code, re] of SCRIPT_TEST) {
    if (re.test(t)) return code;
  }

  const lower = t.toLowerCase();
  const scores = new Map();
  for (const [code, charRe, wordRe] of LATIN_HINTS) {
    let score = 0;
    if (charRe.source !== '^$') score += (t.match(new RegExp(charRe.source, 'gi')) ?? []).length * 3;
    score += (lower.match(new RegExp(wordRe.source, 'gi')) ?? []).length;
    if (score > 0) scores.set(code, score);
  }
  if (scores.size === 0) return 'en';
  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** 読みを付ける単位に切り分ける。漢字は1文字ずつ、それ以外は語ごと */
export function tokenize(text, code) {
  const perChar = code === 'zh';
  const tokens = [];
  const re = perChar
    ? /([一-鿿㐀-䶿])|([^\s一-鿿㐀-䶿]+)|(\s+)/g
    : /([\p{L}\p{M}\p{N}''-]+)|([^\p{L}\p{M}\p{N}''-]+)/gu;
  for (const m of text.matchAll(re)) {
    const word = perChar ? m[1] ?? m[2] ?? null : m[1] ?? null;
    tokens.push({ text: m[0], isWord: word !== null });
  }
  return tokens;
}
