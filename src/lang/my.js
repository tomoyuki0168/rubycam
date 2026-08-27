/**
 * ビルマ語（ミャンマー文字）
 *
 * ミャンマー文字は「子音字 + 介子音 + 母音記号 + 末子音」で1音節を作る。
 * 読み取りを難しくするのは次の3点で、それぞれに手当てをしている。
 *
 *   1. 末子音は「子音字 + ်（消音記号）」で表され、直前の母音と組んで1つの韻になる。
 *      ိ + တ် は「イ」+「ト」ではなく「エイッ」。字面の足し算にならないので、
 *      韻の一覧表（RHYMES）で引く。
 *   2. ္（積み重ね）は音節をまたぐ。上の子音が前の音節の末子音、下が次の頭子音。
 *      先に「C1 ် C2」へほどいてから音節に切る（unstack）。
 *   3. 記号の並び順が揺れる。ော は ေ + ာ だが、文字認識は ာ + ေ の順で
 *      返すことがある。表を引く前に決まった順へ並べ直す（normalize）。
 */
import { toKatakana } from '../kana.js';

const VIRAMA = '္';  // ္ 積み重ね
const ASAT = '်';    // ် 消音（末子音にする）
const CREAKY = '့';  // ့
const HIGH = 'း';    // း

/* ---------------- 声調 ---------------- */

export const TONE_SIGN = { level: '', creaky: 'ˎ', high: 'ˊ' };

export const TONE_LEGEND = [
  ['ˊ', '高く長く'],
  ['ˎ', '短く詰める'],
];

/* ---------------- 字母 ---------------- */

const ONSET = {
  'က': 'k', 'ခ': 'k', 'ဂ': 'g', 'ဃ': 'g', 'င': 'N',
  'စ': 's', 'ဆ': 's', 'ဇ': 'z', 'ဈ': 'z',
  'ဉ': 'J', 'ည': 'J',
  'ဋ': 't', 'ဌ': 't', 'ဍ': 'd', 'ဎ': 'd', 'ဏ': 'n',
  'တ': 't', 'ထ': 't', 'ဒ': 'd', 'ဓ': 'd', 'န': 'n',
  'ပ': 'p', 'ဖ': 'p', 'ဗ': 'b', 'ဘ': 'b', 'မ': 'm',
  'ယ': 'y', 'ရ': 'y', 'လ': 'l', 'ဝ': 'w',
  'သ': 'T', 'ဿ': 'T', 'ဟ': 'h', 'ဠ': 'l', 'အ': '',
};

const ROMAN_ONSET = {
  'က': 'k', 'ခ': 'kh', 'ဂ': 'g', 'ဃ': 'gh', 'င': 'ng',
  'စ': 's', 'ဆ': 'hs', 'ဇ': 'z', 'ဈ': 'zh',
  'ဉ': 'ny', 'ည': 'ny',
  'ဋ': 't', 'ဌ': 'ht', 'ဍ': 'd', 'ဎ': 'dh', 'ဏ': 'n',
  'တ': 't', 'ထ': 'ht', 'ဒ': 'd', 'ဓ': 'dh', 'န': 'n',
  'ပ': 'p', 'ဖ': 'hp', 'ဗ': 'b', 'ဘ': 'bh', 'မ': 'm',
  'ယ': 'y', 'ရ': 'y', 'လ': 'l', 'ဝ': 'w',
  'သ': 'th', 'ဿ': 'th', 'ဟ': 'h', 'ဠ': 'l', 'အ': 'a',
};

// 単独で音節になる母音字
const INDEPENDENT = {
  'ဣ': ['i', 'i'], 'ဤ': ['i:', 'i'], 'ဥ': ['u', 'u'], 'ဦ': ['u:', 'u'],
  'ဧ': ['e:', 'e'], 'ဩ': ['o:', 'aw'], 'ဪ': ['o:', 'aw'],
};

const MEDIALS = { 'ျ': 'y', 'ြ': 'y', 'ွ': 'w', 'ှ': 'h' };

/**
 * 韻（母音記号 + 末子音）→ 音素
 *
 * ビルマ語で使われる韻はほぼここに尽きる。表に無い綴りは
 * 文字認識の読み違いか、外来語の変則的な綴りである。
 */
export const RHYMES = {
  '': 'a',
  'ာ': 'a:',
  'ိ': 'i', 'ီ': 'i:',
  'ု': 'u', 'ူ': 'u:',
  'ေ': 'e:', 'ဲ': 'e:',
  'ော': 'o:', [`ော${ASAT}`]: 'o:', [`ာ${ASAT}`]: 'o:',
  'ို': 'o:',
  'ံ': 'an',

  // 末子音つき（母音と組んで別の音になるもの）
  [`က${ASAT}`]: 'eQ', [`ဂ${ASAT}`]: 'eQ', [`ခ${ASAT}`]: 'eQ',
  [`င${ASAT}`]: 'in',
  [`စ${ASAT}`]: 'iQ', [`ဆ${ASAT}`]: 'iQ', [`ဇ${ASAT}`]: 'iQ',
  [`ဉ${ASAT}`]: 'in', [`ည${ASAT}`]: 'i:',
  [`တ${ASAT}`]: 'aQ', [`ပ${ASAT}`]: 'aQ', [`ထ${ASAT}`]: 'aQ',
  [`ဒ${ASAT}`]: 'aQ', [`ဓ${ASAT}`]: 'aQ', [`ဗ${ASAT}`]: 'aQ',
  [`ဘ${ASAT}`]: 'aQ', [`ဖ${ASAT}`]: 'aQ', [`သ${ASAT}`]: 'aQ',
  [`ဋ${ASAT}`]: 'aQ', [`ဌ${ASAT}`]: 'aQ', [`ဍ${ASAT}`]: 'aQ', [`ဎ${ASAT}`]: 'aQ',
  [`န${ASAT}`]: 'an', [`မ${ASAT}`]: 'an', [`ဏ${ASAT}`]: 'an', [`ဠ${ASAT}`]: 'an',
  [`ယ${ASAT}`]: 'e:', [`ရ${ASAT}`]: 'e:',
  [`လ${ASAT}`]: 'al', [`ဝ${ASAT}`]: 'au',

  [`ိုက${ASAT}`]: 'aiQ', [`ိုင${ASAT}`]: 'ain',
  [`ိတ${ASAT}`]: 'eiQ', [`ိပ${ASAT}`]: 'eiQ',
  [`ိန${ASAT}`]: 'ein', [`ိမ${ASAT}`]: 'ein', 'ိံ': 'ein',
  [`ိစ${ASAT}`]: 'eiQ',
  [`ုက${ASAT}`]: 'ouQ', [`ုတ${ASAT}`]: 'ouQ', [`ုပ${ASAT}`]: 'ouQ',
  [`ုန${ASAT}`]: 'oun', [`ုမ${ASAT}`]: 'oun', 'ုံ': 'oun',
  [`ုင${ASAT}`]: 'oun',
  [`ောက${ASAT}`]: 'auQ', [`ောင${ASAT}`]: 'aun',
  [`ေါက${ASAT}`]: 'auQ', [`ေါင${ASAT}`]: 'aun',
};

const ROMAN_RHYME = {
  '': 'a', 'ာ': 'a', 'ိ': 'i', 'ီ': 'i', 'ု': 'u', 'ူ': 'u',
  'ေ': 'e', 'ဲ': 'e', 'ော': 'aw', [`ော${ASAT}`]: 'aw', 'ို': 'o', 'ံ': 'an',
  [`က${ASAT}`]: 'et', [`င${ASAT}`]: 'in', [`စ${ASAT}`]: 'it',
  [`တ${ASAT}`]: 'at', [`ပ${ASAT}`]: 'at', [`ည${ASAT}`]: 'i',
  [`န${ASAT}`]: 'an', [`မ${ASAT}`]: 'an', [`ဏ${ASAT}`]: 'an', [`ယ${ASAT}`]: 'e',
  [`ိုက${ASAT}`]: 'aik', [`ိုင${ASAT}`]: 'aing',
  [`ိတ${ASAT}`]: 'eik', [`ိန${ASAT}`]: 'ein', 'ိံ': 'ein',
  [`ိပ${ASAT}`]: 'eik', [`ိမ${ASAT}`]: 'ein', [`ိစ${ASAT}`]: 'eik',
  [`ပ${ASAT}`]: 'at', [`ဆ${ASAT}`]: 'it', [`ဘ${ASAT}`]: 'at',
  [`ဏ${ASAT}`]: 'an', [`ရ${ASAT}`]: 'e', [`လ${ASAT}`]: 'al', [`ဝ${ASAT}`]: 'aw',
  [`ုက${ASAT}`]: 'ok', [`ုတ${ASAT}`]: 'ok', [`ုပ${ASAT}`]: 'ok',
  [`ုမ${ASAT}`]: 'on', [`ောင${ASAT}`]: 'aung',
  [`ုန${ASAT}`]: 'on', 'ုံ': 'on',
  [`ောက${ASAT}`]: 'auk', [`ောင${ASAT}`]: 'aung',
};

/** ローマ字の韻。表に無いものは母音記号だけで引き直す */
function romanRhyme(rhyme) {
  if (ROMAN_RHYME[rhyme] !== undefined) return ROMAN_RHYME[rhyme];
  const vowelsOnly = rhyme.replace(new RegExp(`[က-အ]${ASAT}`, 'g'), '');
  return ROMAN_RHYME[vowelsOnly] ?? 'a';
}

const isConsonant = (ch) => ch >= 'က' && ch <= 'အ';
const isDigit = (ch) => ch >= '၀' && ch <= '၉';
const isPunct = (ch) => ch >= '၊' && ch <= '၏';
const isMyanmar = (ch) => ch >= 'က' && ch <= '႟';

/**
 * 記号の並び順。文字認識は綴りの順を取り違えることがあるので、
 * 表を引く前にこの順へ並べ直す（ာေ → ော）
 */
const ORDER = {
  'ျ': 1, 'ြ': 2, 'ွ': 3, 'ှ': 4, // 介子音 ျ ြ ွ ှ
  'ေ': 5,                                        // ေ
  'ိ': 6, 'ီ': 6, 'ု': 7, 'ူ': 7, // ိ ီ ု ူ
  'ဲ': 8,                                        // ဲ
  'ံ': 9,                                        // ံ
  'ာ': 10,                                       // ာ
};

/**
 * 積み重ねをほどき、書き分けを揃える
 *
 * 「C1 ္ C2」は C1 が前の音節の末子音、C2 が次の音節の頭子音を表す。
 * これを「C1 ် C2」に開いておけば、あとは普通の音節として扱える。
 */
export function unstack(text) {
  return text
    .replace(new RegExp(`${ASAT}${VIRAMA}`, 'g'), ASAT)
    .replace(new RegExp(`([က-အ])${VIRAMA}`, 'g'), `$1${ASAT}`)
    .replace(/ါ/g, 'ာ'); // ါ と ာ は同じ母音の書き分け
}

/** 文字列を音節に切る。子音字で始まり、直後が ် なら末子音として取り込む */
export function toSyllables(input) {
  const text = unstack(input);
  const out = [];
  let cur = '';
  let hasOnset = false;

  const flush = () => {
    if (cur) out.push(cur);
    cur = '';
    hasOnset = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (isConsonant(ch)) {
      if (hasOnset && text[i + 1] !== ASAT) flush();
      if (text[i + 1] !== ASAT) hasOnset = true;
      cur += ch;
      continue;
    }
    if (INDEPENDENT[ch]) {
      flush();
      cur = ch;
      hasOnset = true;
      continue;
    }
    // ၀ と ဝ、၇ と ရ は字形が同じ。文字に挟まれた数字は文字の可能性が高いので、
    // 数字として切り離さず、音節の頭として扱う（あとで綴りの補正にかける）
    if (isDigit(ch) && isMyanmar(text[i + 1]) && !isDigit(text[i + 1])) {
      if (hasOnset) flush();
      hasOnset = true;
      cur += ch;
      continue;
    }
    if (isDigit(ch) || isPunct(ch) || !isMyanmar(ch)) {
      flush();
      out.push(ch);
      continue;
    }
    cur += ch;
  }
  flush();
  return out;
}

/** 1音節を 頭子音 / 介子音 / 韻 に分ける。記号の順もここで揃える */
export function parseSyllable(syllable) {
  const tone = syllable.includes(HIGH) ? 'high'
    : syllable.includes(CREAKY) ? 'creaky' : 'level';
  const s = syllable.replace(new RegExp(`[${CREAKY}${HIGH}]`, 'g'), '');

  if (INDEPENDENT[s[0]]) return { independent: s[0], onset: '', medials: '', rhyme: '', tone };

  const onset = isConsonant(s[0]) ? s[0] : '';
  const rest = s.slice(onset ? 1 : 0);

  // 末子音（子音字 + ်）の位置で前後に分け、記号の部分だけを並べ替える
  const codaAt = [...rest].findIndex((ch, i) => isConsonant(ch) && rest[i + 1] === ASAT);
  const head = codaAt < 0 ? rest : rest.slice(0, codaAt);
  const coda = codaAt < 0 ? '' : rest.slice(codaAt, codaAt + 2);
  const tail = codaAt < 0 ? '' : rest.slice(codaAt + 2);

  const marks = [...head, ...tail];
  const sorted = marks
    .filter((ch) => ORDER[ch] !== undefined)
    .sort((a, b) => ORDER[a] - ORDER[b]);

  let medials = '';
  let vowels = '';
  for (const ch of sorted) {
    if (MEDIALS[ch] !== undefined) medials += ch;
    else vowels += ch;
  }

  // 置き場所の無かった文字。文字認識の読み違いを見つける手がかりになる
  const dropped = marks.length - sorted.length;
  return { onset, medials, rhyme: vowels + coda, tone, dropped };
}

/**
 * 韻を引く。表に無い綴りは崩して引き直す
 *
 * 外来語には ဘတ်စ် のように末子音が重なる綴りがあり、そのままでは表に無い。
 * 最初の末子音だけを見る、それでも駄目なら母音記号だけで引く、の順に寄せる。
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

/* ---------------- 文字認識の読み違いを直す ---------------- */

/**
 * 字形がそっくりで、文字認識が取り違えやすい組み合わせ
 * ဝ と ၀（ゼロ）、ရ と ၇（7）は字形が同じ。長短の母音も1画しか違わない。
 */
const CONFUSABLE = {
  'ု': ['ူ'], 'ူ': ['ု'],   // ု ူ
  'ိ': ['ီ'], 'ီ': ['ိ'],   // ိ ီ
  '၀': ['ဝ'], 'ဝ': ['၀'],   // ၀ ဝ
  '၇': ['ရ'], 'ရ': ['၇'],   // ၇ ရ
  '၁': ['ဂ'], 'ဂ': ['၁'],   // ၁ ဂ
  '၃': ['ဒ'], 'ဒ': ['၃'],   // ၃ ဒ
};

/**
 * 音節として筋が通っているか
 *
 * 韻が表にあるだけでは足りない。頭子音が子音字であること、
 * 置き場所の無い文字が混ざっていないことも見る。
 * ここを緩くすると、၀（ゼロ）を頭に付けたような綴りを
 * 「正しい」と判定してしまい、読み違いを見逃す。
 */
const isExact = (syllable) => {
  const { independent, onset, rhyme, dropped } = parseSyllable(syllable);
  if (independent) return true;
  return Boolean(onset) && dropped === 0 && resolveRhyme(rhyme).exact;
};

/**
 * 音節として成り立たない綴りを、そっくりな字に入れ替えて直せるなら直す。
 * 直し方が一意に決まるときだけ手を入れる（複数あるなら触らない）。
 */
export function correctSyllable(syllable) {
  if (!syllable || isExact(syllable)) return { text: syllable, changed: false };

  const hits = new Set();
  for (let i = 0; i < syllable.length; i += 1) {
    for (const alt of CONFUSABLE[syllable[i]] ?? []) {
      const trial = syllable.slice(0, i) + alt + syllable.slice(i + 1);
      if (isExact(trial)) hits.add(trial);
    }
  }
  if (hits.size === 1) return { text: [...hits][0], changed: true, from: syllable };
  return { text: syllable, changed: false, failed: true };
}

/** 語の中の音節を、それぞれ直せる範囲で直す */
function correctWord(word) {
  let changed = false;
  const fixed = toSyllables(word)
    .map((s) => {
      const r = correctSyllable(s);
      if (r.changed) changed = true;
      return r.text;
    })
    .join('');
  return changed ? { text: fixed, changed: true, from: word } : { text: word, changed: false };
}

/* ---------------- 読みの生成 ---------------- */

/** 直前の音節が鼻音で終わっているか。濁りの判定に使う */
export function endsWithNasal(syllable) {
  if (!syllable || !isMyanmar(syllable[0])) return false;
  const { independent, rhyme } = parseSyllable(syllable);
  if (independent) return false;
  return resolveRhyme(rhyme).phonemes.endsWith('n');
}

/** 頭子音 + 介子音 → 音素。ကျ が「チ」になるような組み合わせをここで扱う */
function onsetPhonemes(onset, medials) {
  let base = ONSET[onset] ?? '';
  const hasY = medials.includes('ျ') || medials.includes('ြ');
  // 軟口蓋音 + 介子音 y は破擦音になる（ကျ /tɕ/, ဂျ /dʑ/）
  if (hasY && (base === 'k' || base === 'g')) base = base === 'k' ? 'tS' : 'dZ';
  else if (hasY) base += 'y';
  return base;
}

// 鼻音のあとで濁る組み合わせ
const VOICED = { k: 'g', t: 'd', p: 'b', s: 'z', tS: 'dZ', T: 'd' };

export default {
  code: 'my',
  label: 'ビルマ語（ミャンマー）',
  ocr: 'mya',
  speech: 'my-MM',
  script: 'myanmar',
  // 密な文字なので、認識にかける画像を大きめに取り、精度の高い辞書を使う
  scanScale: 2200,
  ocrQuality: 'best',
  // ミャンマー文字を持たない端末があるので、必要なときだけ字体を取りに行く
  webfont: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Myanmar:wght@400;600&display=swap',
  toneLegend: TONE_LEGEND,
  correct: correctWord,
  // ルビは音節ごとに振る。語まるごとだと長すぎて字と対応が取れない
  split: toSyllables,
  joinWith: '',

  /**
   * @param {string} word 読む対象
   * @param {{after?: string}} opts after には直前の音節を渡す。
   *   鼻音のあとの濁りは音節をまたぐので、1音節ずつ読むときに要る
   */
  read(word, { after = '' } = {}) {
    const syllables = toSyllables(word);
    let kana = '';
    let roman = '';
    let unknown = 0;
    let prevNasal = endsWithNasal(after);
    let lastSign = '';

    for (const syllable of syllables) {
      if (isDigit(syllable)) {
        const d = String(syllable.codePointAt(0) - 0x1040);
        kana += d;
        roman += d;
        prevNasal = false;
        continue;
      }
      if (!isMyanmar(syllable[0]) || isPunct(syllable)) {
        kana += syllable;
        roman += syllable;
        prevNasal = false;
        continue;
      }

      const { independent, onset, medials, rhyme, tone, dropped } = parseSyllable(syllable);
      lastSign = TONE_SIGN[tone];

      if (independent) {
        const [ph, rom] = INDEPENDENT[independent];
        kana += toKatakana(ph) + (syllables.length > 1 ? lastSign : '');
        roman += rom;
        prevNasal = ph.endsWith('n');
        continue;
      }

      const { phonemes, exact } = resolveRhyme(rhyme);
      if (!exact || dropped > 0 || !onset) unknown += 1;

      let head = onsetPhonemes(onset, medials);
      if (prevNasal) head = VOICED[head] ?? head;
      prevNasal = phonemes.endsWith('n');

      // 介子音 ွ の当て方。ア・オ・ウ段の前は「ウ + ワ行」に開いたほうが近く
      // （သွား → スワー）、エ・イ段の前はそのまま拗音にしたほうが近い（ထွက် → トウェッ）
      const body = medials.includes('ွ')
        ? (/^[aou]/.test(phonemes) ? `${head}uw${phonemes}` : `${head}w${phonemes}`)
        : head + phonemes;

      kana += toKatakana(body) + (syllables.length > 1 ? lastSign : '');
      roman += (ROMAN_ONSET[onset] ?? '')
        + (medials.includes('ျ') || medials.includes('ြ') ? 'y' : '')
        + (medials.includes('ွ') ? 'w' : '')
        + romanRhyme(rhyme);
    }

    return {
      kana,
      roman,
      // 音節ごとに読むときは、声調記号を別に返して色を分けられるようにする
      sign: syllables.length === 1 ? lastSign : '',
      confident: unknown === 0,
    };
  },
};
