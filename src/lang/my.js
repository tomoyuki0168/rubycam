/**
 * ビルマ語（ミャンマー文字）
 *
 * ミャンマー文字は「子音字 + 介子音 + 母音記号 + 末子音」で1音節を作る。
 * 綴りの並びと発音の対応は規則的だが、次の2点が読み取りを難しくする。
 *
 *   1. 末子音は「子音字 + ် （消音記号）」で表され、直前の母音と組んで
 *      1つの韻になる（ိ + တ် で「エイッ」など、字面からは足し算にならない）
 *   2. ္（積み重ね）は、上の子音が前の音節の末子音、下の子音が次の音節の
 *      頭子音になる。見た目は1文字でも、音節としては2つにまたがる
 *
 * そこで、音節に切ってから「韻の一覧表」で引く形にしている。
 * ベトナム語と同じ考え方で、表が読みの生成と綴りの妥当性判定を兼ねる。
 */
import { toKatakana } from '../kana.js';

const VIRAMA = '္';   // ္ 積み重ね
const ASAT = '်';     // ် 消音（末子音にする）
const CREAKY = '့';   // ့
const HIGH = 'း';     // း

// 子音字 → 音素
const ONSET = {
  'က': 'k', 'ခ': 'k', 'ဂ': 'g', 'ဃ': 'g', 'င': 'N',
  'စ': 's', 'ဆ': 's', 'ဇ': 'z', 'ဈ': 'z',
  'ဉ': 'J', 'ည': 'J',
  'ဋ': 't', 'ဌ': 't', 'ဍ': 'd', 'ဎ': 'd', 'ဏ': 'n',
  'တ': 't', 'ထ': 't', 'ဒ': 'd', 'ဓ': 'd', 'န': 'n',
  'ပ': 'p', 'ဖ': 'p', 'ဗ': 'b', 'ဘ': 'b', 'မ': 'm',
  'ယ': 'y', 'ရ': 'y', 'လ': 'l', 'ဝ': 'w',
  'သ': 'T', 'ဟ': 'h', 'ဠ': 'l', 'အ': '',
};

const ROMAN_ONSET = {
  'က': 'k', 'ခ': 'kh', 'ဂ': 'g', 'ဃ': 'gh', 'င': 'ng',
  'စ': 's', 'ဆ': 'hs', 'ဇ': 'z', 'ဈ': 'zh',
  'ဉ': 'ny', 'ည': 'ny',
  'ဋ': 't', 'ဌ': 'ht', 'ဍ': 'd', 'ဎ': 'dh', 'ဏ': 'n',
  'တ': 't', 'ထ': 'ht', 'ဒ': 'd', 'ဓ': 'dh', 'န': 'n',
  'ပ': 'p', 'ဖ': 'hp', 'ဗ': 'b', 'ဘ': 'bh', 'မ': 'm',
  'ယ': 'y', 'ရ': 'y', 'လ': 'l', 'ဝ': 'w',
  'သ': 'th', 'ဟ': 'h', 'ဠ': 'l', 'အ': 'a',
};

const MEDIALS = { 'ျ': 'y', 'ြ': 'y', 'ွ': 'w', 'ှ': 'h' };

/**
 * 韻（母音記号 + 末子音）→ 音素
 *
 * 「ို + က်」で「アイッ」のように、字面の足し算にならないものが多い。
 * ここに並べたものが、ビルマ語で実際に使われる韻のほぼすべて。
 */
export const RHYMES = {
  '': 'a',
  'ာ': 'a:', 'ါ': 'a:',
  'ိ': 'i', 'ီ': 'i:',
  'ု': 'u', 'ူ': 'u:',
  'ေ': 'e:', 'ဲ': 'e:',
  'ော': 'o:', [`ော${ASAT}`]: 'o:',
  'ို': 'o:',
  'ံ': 'an',

  // 末子音つき
  [`က${ASAT}`]: 'eQ', [`ဂ${ASAT}`]: 'eQ',
  [`င${ASAT}`]: 'in',
  [`စ${ASAT}`]: 'iQ',
  [`ဉ${ASAT}`]: 'in', [`ည${ASAT}`]: 'i:',
  [`တ${ASAT}`]: 'aQ', [`ပ${ASAT}`]: 'aQ',
  [`န${ASAT}`]: 'an', [`မ${ASAT}`]: 'an',
  [`ယ${ASAT}`]: 'e:',
  [`ိုက${ASAT}`]: 'aiQ',
  [`ိုင${ASAT}`]: 'ain',
  [`ိတ${ASAT}`]: 'eiQ', [`ိပ${ASAT}`]: 'eiQ',
  [`ိန${ASAT}`]: 'ein', [`ိမ${ASAT}`]: 'ein',
  [`ိံ`]: 'ein',
  [`ုက${ASAT}`]: 'ouQ',
  [`ုတ${ASAT}`]: 'ouQ', [`ုပ${ASAT}`]: 'ouQ',
  [`ုန${ASAT}`]: 'oun', [`ုမ${ASAT}`]: 'oun',
  [`ုံ`]: 'oun',
  [`ောက${ASAT}`]: 'auQ',
  [`ောင${ASAT}`]: 'aun',
};

const ROMAN_RHYME = {
  '': 'a', 'ာ': 'a', 'ါ': 'a', 'ိ': 'i', 'ီ': 'i',
  'ု': 'u', 'ူ': 'u', 'ေ': 'e', 'ဲ': 'e',
  'ော': 'aw', [`ော${ASAT}`]: 'aw', 'ို': 'o',
  'ံ': 'an',
  [`က${ASAT}`]: 'et', [`င${ASAT}`]: 'in', [`စ${ASAT}`]: 'it',
  [`တ${ASAT}`]: 'at', [`ပ${ASAT}`]: 'at',
  [`န${ASAT}`]: 'an', [`မ${ASAT}`]: 'an', [`ယ${ASAT}`]: 'e',
  [`ိုက${ASAT}`]: 'aik', [`ိုင${ASAT}`]: 'aing',
  [`ိတ${ASAT}`]: 'eik', [`ိန${ASAT}`]: 'ein',
  [`ုက${ASAT}`]: 'ok', [`ုတ${ASAT}`]: 'ok',
  [`ုန${ASAT}`]: 'on', [`ုံ`]: 'on',
  [`ောက${ASAT}`]: 'auk', [`ောင${ASAT}`]: 'aung',
};

const isConsonant = (ch) => ch >= 'က' && ch <= 'အ';
const isDigit = (ch) => ch >= '၀' && ch <= '၉';

/**
 * 積み重ねをほどく
 *
 * 「C1 ္ C2」は C1 が前の音節の末子音、C2 が次の音節の頭子音を表す。
 * これを「C1 ် C2」に開いておくと、あとは通常の音節と同じに扱える。
 * ကင်္ （キンズィ）も同じ理屈で、消音記号のあとの ္ を落とせばよい。
 */
export function unstack(text) {
  return text
    .replace(new RegExp(`${ASAT}${VIRAMA}`, 'g'), ASAT)
    .replace(new RegExp(`([က-အ])${VIRAMA}`, 'g'), `$1${ASAT}`)
    // ါ と ာ は同じ母音の書き分け。表を1本にするため揃える
    .replace(/ါ/g, 'ာ');
}

/**
 * 文字列を音節に切る
 *
 * 子音字が来たら新しい音節にする。ただし直後が ်（消音記号）なら
 * それは末子音なので、今の音節の続きとみなす。
 */
export function toSyllables(input) {
  const text = unstack(input);
  const out = [];
  let cur = '';
  let hasOnset = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (isConsonant(ch)) {
      const isCoda = next === ASAT;
      if (hasOnset && !isCoda) {
        out.push(cur);
        cur = '';
        hasOnset = false;
      }
      if (!isCoda) hasOnset = true;
      cur += ch;
      continue;
    }

    if (isDigit(ch) || /\s/.test(ch)) {
      if (cur) out.push(cur);
      out.push(ch);
      cur = '';
      hasOnset = false;
      continue;
    }

    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** 1音節を 頭子音 / 介子音 / 韻 に分ける */
export function parseSyllable(syllable) {
  const tone = syllable.includes(HIGH) ? 'high' : syllable.includes(CREAKY) ? 'creaky' : 'level';
  let s = syllable.replace(new RegExp(`[${CREAKY}${HIGH}]`, 'g'), '');

  const onset = isConsonant(s[0]) ? s[0] : '';
  s = onset ? s.slice(1) : s;

  let medials = '';
  while (MEDIALS[s[0]] !== undefined) {
    medials += s[0];
    s = s.slice(1);
  }

  return { onset, medials, rhyme: s, tone };
}

/** 頭子音 + 介子音 → 音素。ကျ が「チ」になるような組み合わせをここで扱う */
function onsetPhonemes(onset, medials) {
  let base = ONSET[onset] ?? '';
  const hasY = medials.includes('ျ') || medials.includes('ြ');
  const hasW = medials.includes('ွ');

  // 軟口蓋音 + 介子音 y は破擦音になる（ကျ /tɕ/, ဂျ /dʑ/）
  if (hasY && (base === 'k' || base === 'g')) {
    base = base === 'k' ? 'tS' : 'dZ';
    return base + (hasW ? 'w' : '');
  }
  return base + (hasY ? 'y' : '') + (hasW ? 'w' : '');
}

// 鼻音のあとで濁る組み合わせ
const VOICED = { k: 'g', t: 'd', p: 'b', s: 'z', tS: 'dZ', ky: 'gy', py: 'by', kw: 'gw' };

/**
 * 韻を引く。表に無い綴りは、崩して引き直す
 *
 * 外来語には ဘတ်စ် のように末子音が重なる綴りがあり、
 * そのままでは表に載らない。最初の末子音だけを見る、
 * それでも駄目なら母音記号だけで引く、の順で近い読みに寄せる。
 */
export function resolveRhyme(rhyme) {
  if (RHYMES[rhyme] !== undefined) return { phonemes: RHYMES[rhyme], exact: true };

  const codas = [...rhyme.matchAll(new RegExp(`[က-အ]${ASAT}`, 'g'))];
  if (codas.length > 1) {
    const first = rhyme.slice(0, codas[0].index + 2);
    if (RHYMES[first] !== undefined) return { phonemes: RHYMES[first], exact: false };
  }

  const vowelsOnly = rhyme.replace(new RegExp(`[က-အ]${ASAT}`, 'g'), '');
  if (RHYMES[vowelsOnly] !== undefined) return { phonemes: RHYMES[vowelsOnly], exact: false };

  return { phonemes: 'a', exact: false };
}

export default {
  code: 'my',
  label: 'ビルマ語（ミャンマー）',
  ocr: 'mya',
  speech: 'my-MM',
  script: 'myanmar',
  // 密な文字なので、認識にかける画像を大きめに取る
  scanScale: 2200,

  read(word) {
    let kana = '';
    let roman = '';
    let unknown = 0;
    let prevNasal = false;

    for (const syllable of toSyllables(word)) {
      if (isDigit(syllable)) {
        const d = String(syllable.codePointAt(0) - 0x1040);
        kana += d;
        roman += d;
        continue;
      }
      if (/^\s+$/.test(syllable)) {
        kana += syllable;
        roman += syllable;
        continue;
      }

      const { onset, medials, rhyme } = parseSyllable(syllable);
      const { phonemes: rhymePhonemes, exact } = resolveRhyme(rhyme);
      if (!exact) unknown += 1;
      let head = onsetPhonemes(onset, medials);
      // 前の音節が鼻音で終わっていると、続く無声音は濁る（ရန်ကုန် → ヤンゴウン）
      if (prevNasal) head = VOICED[head] ?? head;
      prevNasal = rhymePhonemes.endsWith('n');

      kana += toKatakana(head + rhymePhonemes);
      roman += (ROMAN_ONSET[onset] ?? '')
        + (medials.includes('ွ') ? 'w' : '')
        + (ROMAN_RHYME[rhyme] ?? '');
    }

    return { kana, roman, confident: unknown === 0 };
  },
};
