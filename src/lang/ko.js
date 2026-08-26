/**
 * 韓国語（ハングル）
 *
 * ハングルは字母に分解できるので、規則だけで読みが出せる。
 * 手順は 3 段階:
 *   1. 音節を 初声 / 中声 / 終声 に分解する
 *   2. 終声と次の初声のあいだで起きる発音変化を適用する（連音化・鼻音化など）
 *   3. 日本語の慣用に合わせてカタカナに当てる（語中の平音は濁る、など）
 */
import { toKatakana } from '../kana.js';

const BASE = 0xac00;
const LAST = 0xd7a3;

// 初声19
const ONSET = ['g', 'gg', 'n', 'd', 'dd', 'r', 'm', 'b', 'bb', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
// 中声21
const NUCLEUS = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
// 終声28（先頭は終声なし）
const CODA = ['', 'g', 'gg', 'gs', 'n', 'nj', 'nh', 'd', 'l', 'lg', 'lm', 'lb', 'ls', 'lt', 'lp', 'lh', 'm', 'b', 'bs', 's', 'ss', 'ng', 'j', 'ch', 'k', 't', 'p', 'h'];

// 終声が単独で発音されるときの代表音（終声規則）
const CODA_REPRESENTATIVE = {
  '': '', g: 'g', gg: 'g', gs: 'g', n: 'n', nj: 'n', nh: 'n', d: 'd',
  l: 'l', lg: 'g', lm: 'm', lb: 'l', ls: 'l', lt: 'l', lp: 'p', lh: 'l',
  m: 'm', b: 'b', bs: 'b', s: 'd', ss: 'd', ng: 'ng', j: 'd', ch: 'd',
  k: 'g', t: 'd', p: 'b', h: 'd',
};
// 二重終声のうち、次の音節へ渡る側（連音化で移る子音）
const CODA_SPLIT = {
  gs: ['g', 's'], nj: ['n', 'j'], lg: ['l', 'g'], lm: ['l', 'm'], lb: ['l', 'b'],
  ls: ['l', 's'], lt: ['l', 't'], lp: ['l', 'p'], bs: ['b', 's'],
};
// 激音化: 終声 h + 平音 / 平音 + h
const ASPIRATE = { g: 'k', d: 't', b: 'p', j: 'ch' };

export function decompose(text) {
  const out = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code >= BASE && code <= LAST) {
      const n = code - BASE;
      out.push({
        onset: ONSET[Math.floor(n / 588)],
        nucleus: NUCLEUS[Math.floor((n % 588) / 28)],
        coda: CODA[n % 28],
        char: ch,
      });
    } else {
      out.push({ literal: ch });
    }
  }
  return out;
}

/** 音節間の発音変化を適用する */
export function applySandhi(syllables) {
  const s = syllables.map((x) => ({ ...x }));
  for (let i = 0; i < s.length; i += 1) {
    const cur = s[i];
    const next = s[i + 1];
    if (cur.literal || !cur.coda) continue;
    if (!next || next.literal) {
      cur.coda = CODA_REPRESENTATIVE[cur.coda];
      continue;
    }

    // 連音化: 終声 + 初声「ㅇ」→ 終声が次の初声になる
    if (next.onset === '') {
      const split = CODA_SPLIT[cur.coda];
      if (split) {
        [cur.coda, next.onset] = split;
      } else if (cur.coda === 'ng') {
        // ㅇ は移動しない
      } else if (cur.coda === 'h') {
        cur.coda = '';
      } else {
        next.onset = cur.coda;
        cur.coda = '';
      }
      continue;
    }

    // 激音化: ㅎ + 平音、平音 + ㅎ
    if (cur.coda === 'h' && ASPIRATE[next.onset]) {
      next.onset = ASPIRATE[next.onset];
      cur.coda = '';
      continue;
    }
    if (cur.coda === 'lh' && ASPIRATE[next.onset]) {
      next.onset = ASPIRATE[next.onset];
      cur.coda = 'l';
      continue;
    }
    const rep0 = CODA_REPRESENTATIVE[cur.coda];
    if (next.onset === 'h' && ASPIRATE[rep0]) {
      next.onset = ASPIRATE[rep0];
      cur.coda = '';
      continue;
    }

    let rep = rep0;

    // 鼻音化: 閉鎖音 + 鼻音 → 鼻音
    if (['n', 'm'].includes(next.onset)) {
      if (rep === 'g') rep = 'ng';
      else if (rep === 'd') rep = 'n';
      else if (rep === 'b') rep = 'm';
    }
    // 流音の鼻音化: ㄹ の前後
    if (next.onset === 'r') {
      if (rep === 'l') next.onset = 'l';
      else if (['n'].includes(rep)) { rep = 'l'; next.onset = 'l'; }
      else if (['g', 'ng'].includes(rep)) { rep = 'ng'; next.onset = 'n'; }
      else if (['d', 'b', 'm'].includes(rep)) next.onset = 'n';
    }
    // 流音化: ㄹ + ㄴ → ㄹ + ㄹ
    if (rep === 'l' && next.onset === 'n') next.onset = 'l';
    if (rep === 'n' && next.onset === 'l') rep = 'l';

    // 濃音化: 閉鎖音のあとの平音は濃音になる
    if (['g', 'd', 'b'].includes(rep)) {
      const TENSE = { g: 'gg', d: 'dd', b: 'bb', s: 'ss', j: 'jj' };
      if (TENSE[next.onset]) next.onset = TENSE[next.onset];
    }

    cur.coda = rep;
  }
  return s;
}

// 初声 → 音素（語頭 / 語中で有声化が変わる）
const ONSET_PHONEME = {
  g: ['k', 'g'], gg: ['Qk', 'Qk'], n: ['n', 'n'], d: ['t', 'd'], dd: ['Qt', 'Qt'],
  r: ['r', 'r'], l: ['r', 'r'], m: ['m', 'm'], b: ['p', 'b'], bb: ['Qp', 'Qp'], s: ['s', 's'],
  ss: ['Qs', 'Qs'], '': ['', ''], j: ['tS', 'dZ'], jj: ['QtS', 'QtS'], ch: ['tS', 'tS'],
  k: ['k', 'k'], t: ['t', 't'], p: ['p', 'p'], h: ['h', 'h'],
};

const NUCLEUS_PHONEME = {
  a: 'a', ae: 'e', ya: 'ya', yae: 'ye', eo: 'o', e: 'e', yeo: 'yo', ye: 'ye',
  o: 'o', wa: 'wa', wae: 'we', oe: 'we', yo: 'yo', u: 'u', wo: 'wo', we: 'we',
  wi: 'wi', yu: 'yu', eu: 'u', ui: 'wi', i: 'i',
};

// 終声 → カタカナ（日本語の慣用表記）
const CODA_KANA = { '': '', g: 'ク', n: 'ン', d: 'ッ', l: 'ル', m: 'ム', b: 'プ', ng: 'ン', p: 'プ', s: 'ッ', t: 'ッ', k: 'ク', h: 'ッ' };

const ROMAN_ONSET = { g: 'g', gg: 'kk', n: 'n', d: 'd', dd: 'tt', r: 'r', l: 'l', m: 'm', b: 'b', bb: 'pp', s: 's', ss: 'ss', '': '', j: 'j', jj: 'jj', ch: 'ch', k: 'k', t: 't', p: 'p', h: 'h' };
const ROMAN_CODA = { '': '', g: 'k', n: 'n', d: 't', l: 'l', m: 'm', b: 'p', ng: 'ng', p: 'p', s: 't', t: 't', k: 'k', h: 't' };

export default {
  code: 'ko',
  label: '韓国語',
  ocr: 'kor',
  speech: 'ko-KR',
  script: 'hangul',
  read(word) {
    const syls = applySandhi(decompose(word));
    let kana = '';
    let roman = '';
    syls.forEach((s, i) => {
      if (s.literal) {
        kana += s.literal;
        roman += s.literal;
        return;
      }
      const initial = i === 0;
      const onset = ONSET_PHONEME[s.onset]?.[initial ? 0 : 1] ?? '';
      const nucleus = NUCLEUS_PHONEME[s.nucleus] ?? 'a';
      // 次の初声が濃音（＝促音「ッ」を伴う）なら、終声のクプは重ねない（학교 → ハッキョ）
      const nextOnset = syls[i + 1] && !syls[i + 1].literal
        ? ONSET_PHONEME[syls[i + 1].onset]?.[1] ?? ''
        : '';
      const swallowCoda = nextOnset.startsWith('Q') && ['g', 'd', 'b', 'p', 'k', 't', 's'].includes(s.coda);
      kana += toKatakana(onset + nucleus) + (swallowCoda ? '' : CODA_KANA[s.coda] ?? '');
      roman += (ROMAN_ONSET[s.onset] ?? '') + s.nucleus + (swallowCoda ? '' : ROMAN_CODA[s.coda] ?? '');
    });
    // 「ッ」が語末に来ると読みにくいので落とす
    kana = kana.replace(/ッ$/, '');
    return { kana, roman };
  },
};
