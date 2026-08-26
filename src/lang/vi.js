/**
 * ベトナム語
 *
 * ベトナム語の音節は「頭子音 + 韻（母音+末子音）」に必ず分かれ、
 * 取りうる韻の種類は限られている。そこで韻の一覧表を1つ持ち、
 *   - 読みの生成（韻 → 音素）
 *   - 綴りが正しいかの判定（OCR の読み違いを見つける）
 * の両方に使っている。
 *
 * 声調記号は母音の質を表す記号（ă â ê ô ơ ư）と同じ位置に付くため、
 * 先に声調だけを外してから音節を分解する。声調は読みに添えて別に返す。
 *
 * 発音は北部（ハノイ）を既定とし、南部（ホーチミン）も選べる。
 * d / gi / r / s / v は南北で最も大きく違うため、ここを切り替える。
 */
import { toKatakana } from '../kana.js';

/* ---------------- 声調 ---------------- */

const TONE_MARKS = { '̀': 'huyền', '́': 'sắc', '̃': 'ngã', '̉': 'hỏi', '̣': 'nặng' };
const TONE_RE = /[̣̀́̃̉]/g;

// 声調を1文字で添えるための記号
export const TONE_SIGN = {
  ngang: '', huyền: 'ˋ', sắc: 'ˊ', hỏi: 'ˇ', ngã: '˜', nặng: 'ˎ',
};

export const TONE_LEGEND = [
  ['ˊ', '上がる'],
  ['ˋ', '低く下がる'],
  ['ˇ', '下がって上がる'],
  ['˜', 'ゆれて上がる'],
  ['ˎ', '短く落とす'],
];

/** 声調記号だけを外す（母音の質を表す記号は残す） */
export function stripTone(word) {
  return word.normalize('NFD').replace(TONE_RE, '').normalize('NFC');
}

export function toneOf(word) {
  for (const ch of word.normalize('NFD')) {
    if (TONE_MARKS[ch]) return TONE_MARKS[ch];
  }
  return 'ngang';
}

/* ---------------- 頭子音 ---------------- */

// 長いものから試す
const ONSETS = ['ngh', 'ng', 'nh', 'ch', 'tr', 'th', 'ph', 'kh', 'gh', 'gi', 'qu',
  'b', 'c', 'd', 'đ', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'x'];

// 北部 / 南部 で読みが変わるものは2つ持つ
const ONSET_PHONEME = {
  '': ['', ''],
  b: ['b', 'b'], c: ['k', 'k'], k: ['k', 'k'], qu: ['ku', 'wu'],
  ch: ['tS', 'tS'], tr: ['tS', 'tS'], th: ['t', 't'], t: ['t', 't'],
  d: ['z', 'y'], gi: ['z', 'y'], đ: ['d', 'd'],
  g: ['g', 'g'], gh: ['g', 'g'], h: ['h', 'h'], kh: ['k', 'k'],
  l: ['l', 'l'], m: ['m', 'm'], n: ['n', 'n'], ng: ['N', 'N'], ngh: ['N', 'N'],
  nh: ['J', 'J'], p: ['p', 'p'], ph: ['f', 'f'],
  r: ['z', 'r'], s: ['s', 'S'], v: ['v', 'y'], x: ['s', 's'],
};

/* ---------------- 韻 ---------------- */

/**
 * 韻 → 音素。この表に無い綴りは、ベトナム語として成り立たない音節とみなす。
 * ơ と ư は長母音なので、末子音が無いときは長音にする（phở → フォー）。
 */
export const RHYMES = {
  // 末子音なし
  a: 'a', ă: 'a', â: 'a', e: 'e', ê: 'e', i: 'i', y: 'i',
  o: 'o', ô: 'o', ơ: 'o:', u: 'u', ư: 'u:',
  ia: 'ia', ya: 'ia', ua: 'ua', ưa: 'ua',
  oa: 'oa', oe: 'oe', uê: 'ue', uy: 'ui', uơ: 'uo', uya: 'uia',
  ai: 'ai', ao: 'ao', au: 'au', ay: 'ai', âu: 'au', ây: 'ai',
  eo: 'eo', êu: 'eu', iu: 'iu', oi: 'oi', ôi: 'oi', ơi: 'oi',
  ui: 'ui', ưi: 'ui', ưu: 'uu',
  iêu: 'ieu', yêu: 'ieu', uôi: 'uoi', ươi: 'uoi', ươu: 'uou',
  oai: 'oai', oay: 'oai', uây: 'uai', oao: 'oao', uao: 'uao', oeo: 'oeo',

  // -m
  am: 'am', ăm: 'am', âm: 'am', em: 'em', êm: 'em', im: 'im',
  om: 'om', ôm: 'om', ơm: 'om', um: 'um',
  iêm: 'iem', yêm: 'iem', uôm: 'uom', ươm: 'uom', oam: 'oam', oăm: 'oam',

  // -n
  an: 'an', ăn: 'an', ân: 'an', en: 'en', ên: 'en', in: 'in',
  on: 'on', ôn: 'on', ơn: 'on', un: 'un', ưn: 'un',
  iên: 'ien', yên: 'ien', uôn: 'uon', ươn: 'uon',
  oan: 'oan', oăn: 'oan', uân: 'uan', uyên: 'uen', oen: 'oen', uyn: 'uin',

  // -ng（カタカナでは「ン」）
  ang: 'an', ăng: 'an', âng: 'an', eng: 'en', ong: 'on', ông: 'on',
  ung: 'un', ưng: 'un', iêng: 'ien', yêng: 'ien', uông: 'uon', ương: 'uon',
  oang: 'oan', oăng: 'oan', uâng: 'uan', oong: 'on', uyêng: 'uen',

  // -nh（直前の母音がずれる）
  anh: 'ain', ênh: 'en', inh: 'in', oanh: 'oain', uynh: 'uin',

  // -p
  ap: 'aQp', ăp: 'aQp', âp: 'aQp', ep: 'eQp', êp: 'eQp', ip: 'iQp',
  op: 'oQp', ôp: 'oQp', ơp: 'oQp', up: 'uQp',
  iêp: 'ieQp', yêp: 'ieQp', ươp: 'uoQp', oap: 'oaQp',

  // -t
  at: 'aQt', ăt: 'aQt', ât: 'aQt', et: 'eQt', êt: 'eQt', it: 'iQt',
  ot: 'oQt', ôt: 'oQt', ơt: 'oQt', ut: 'uQt', ưt: 'uQt',
  iêt: 'ieQt', yêt: 'ieQt', uôt: 'uoQt', ươt: 'uoQt',
  oat: 'oaQt', oăt: 'oaQt', uât: 'uaQt', uyêt: 'ueQt', uyt: 'uiQt',

  // -c
  ac: 'aQk', ăc: 'aQk', âc: 'aQk', ec: 'eQk', oc: 'oQk', ôc: 'oQk',
  uc: 'uQk', ưc: 'uQk', iêc: 'ieQk', uôc: 'uoQk', ươc: 'uoQk',
  oac: 'oaQk', oăc: 'oaQk',

  // -ch（直前の母音がずれる）
  ach: 'aQk', êch: 'eQk', ich: 'iQk', oach: 'oaQk', uêch: 'ueQk',
};

/* ---------------- 音節の分解と検査 ---------------- */

/** 声調を外した音節を 頭子音 + 韻 に分ける */
export function splitSyllable(base) {
  const w = base.toLowerCase();
  const onset = ONSETS.find((o) => w.startsWith(o) && RHYMES[w.slice(o.length)] !== undefined);
  if (onset !== undefined) return { onset, rhyme: w.slice(onset.length) };

  // gi + i は綴りの上で "gi" に縮まる（gì → gi + i）
  if (w === 'gi') return { onset: 'gi', rhyme: 'i' };
  if (RHYMES[w] !== undefined) return { onset: '', rhyme: w };
  return null;
}

/** ベトナム語の音節として成り立つ綴りか */
export function isSyllable(word) {
  const letters = stripTone(word).toLowerCase().replace(/[^a-zàáâãăđèéêìíòóôõơùúưýỳỹ]/gi, '');
  if (!letters) return false;
  return splitSyllable(letters) !== null;
}

/* ---------------- OCR の読み違いを直す ---------------- */

// 母音の質を表す記号。OCR はこれを落としたり取り違えたりしやすい
const QUALITY = { '̂': 1, '̆': 1, '̛': 1 };
const QUALITY_OPTIONS = {
  a: ['', '̂', '̆'],
  e: ['', '̂'],
  o: ['', '̂', '̛'],
  u: ['', '̛'],
  d: ['d', 'đ'],
};

/** 1文字を「素の文字 + 質の記号 + 声調記号」に分ける */
function units(word) {
  const out = [];
  for (const ch of word.normalize('NFD')) {
    if (QUALITY[ch] && out.length) out[out.length - 1].quality = ch;
    else if (TONE_MARKS[ch] && out.length) out[out.length - 1].tone = ch;
    else out.push({ base: ch, quality: '', tone: '' });
  }
  return out;
}

const render = (us) => us.map((u) => u.base + u.quality + u.tone).join('').normalize('NFC');

/**
 * 音節として成り立たない綴りを、記号の付け替えだけで直せるなら直す。
 *
 * 直し方が一意に決まるときだけ手を入れる。候補が複数あるときは
 * 読み手を誤らせるので、そのまま返して「直せなかった」ことを伝える。
 */
export function correctSyllable(word) {
  if (isSyllable(word)) return { text: word, changed: false };

  const us = units(word);
  // 記号が1つも読めていない語は、元から記号が無いのか OCR が全部落としたのか
  // 区別できない。当て推量になるので手を出さない
  if (!us.some((u) => u.quality || u.tone || u.base === 'đ' || u.base === 'Đ')) {
    return { text: word, changed: false, failed: true };
  }
  const spots = us
    .map((u, i) => [i, QUALITY_OPTIONS[u.base.toLowerCase()]])
    .filter(([, opts]) => opts !== undefined);
  if (spots.length === 0 || spots.length > 4) return { text: word, changed: false, failed: true };

  // 変える箇所が少ない候補から順に探す
  for (const depth of [1, 2]) {
    const hits = new Map();
    for (const combo of combinations(spots, depth)) {
      const trial = us.map((u) => ({ ...u }));
      let removed = 0;
      for (const [i, value] of combo) {
        if (trial[i].base.toLowerCase() === 'd') {
          trial[i].base = trial[i].base === trial[i].base.toUpperCase() ? value.toUpperCase() : value;
        } else {
          if (trial[i].quality && trial[i].quality !== value) removed += 1;
          trial[i].quality = value;
        }
      }
      const text = render(trial);
      if (text !== word && isSyllable(text)) {
        hits.set(text, Math.min(hits.get(text) ?? Infinity, removed));
      }
    }
    if (hits.size === 0) continue;

    // OCR は記号を「落とす」ことのほうが多い。すでに読めている記号を
    // 消さずに済む直し方を優先する
    const best = Math.min(...hits.values());
    const shortlist = [...hits].filter(([, removed]) => removed === best).map(([text]) => text);
    if (shortlist.length === 1) return { text: shortlist[0], changed: true, from: word };
    return { text: word, changed: false, failed: true, ambiguous: true };
  }
  return { text: word, changed: false, failed: true };
}

/** spots のうち depth 箇所を選んで、値の組み合わせを列挙する */
function* combinations(spots, depth, start = 0, acc = []) {
  if (acc.length === depth) {
    yield acc;
    return;
  }
  for (let i = start; i < spots.length; i += 1) {
    const [index, options] = spots[i];
    for (const value of options) {
      yield* combinations(spots, depth, i + 1, [...acc, [index, value]]);
    }
  }
}

/* ---------------- 読みの生成 ---------------- */

// 音節として読めない綴り（OCR の読み違いなど）向けの、字面だけの当て読み
const LOOSE = {
  ngh: 'N', ng: 'N', nh: 'J', ch: 'tS', tr: 'tS', th: 't', ph: 'f', kh: 'k',
  gh: 'g', gi: 'z', qu: 'ku', đ: 'd', d: 'z', c: 'k', k: 'k', x: 's', v: 'v',
  b: 'b', g: 'g', h: 'h', l: 'l', m: 'm', n: 'n', p: 'p', r: 'z', s: 's', t: 't',
  a: 'a', ă: 'a', â: 'a', e: 'e', ê: 'e', i: 'i', y: 'i',
  o: 'o', ô: 'o', ơ: 'o', u: 'u', ư: 'u',
};
const LOOSE_KEYS = Object.keys(LOOSE).sort((a, b) => b.length - a.length);

function approximate(base) {
  let ph = '';
  let i = 0;
  while (i < base.length) {
    const hit = LOOSE_KEYS.find((k) => base.startsWith(k, i));
    if (!hit) {
      i += 1;
      continue;
    }
    ph += LOOSE[hit];
    i += hit.length;
  }
  return toKatakana(ph);
}

export default {
  code: 'vi',
  label: 'ベトナム語',
  ocr: 'vie',
  speech: 'vi-VN',
  script: 'latin',
  dialects: [
    { value: 'north', label: '北部（ハノイ）' },
    { value: 'south', label: '南部（ホーチミン）' },
  ],
  correct: correctSyllable,
  toneLegend: TONE_LEGEND,

  // ベトナム語は音節ごとに分かち書きするので、単語ではなく音節単位で読む
  read(word, { dialect = 'north' } = {}) {
    const tone = toneOf(word);
    const base = stripTone(word).toLowerCase();
    const parts = splitSyllable(base);
    if (!parts) return { kana: approximate(base), tone, sign: TONE_SIGN[tone], confident: false };

    const i = dialect === 'south' ? 1 : 0;
    const onset = ONSET_PHONEME[parts.onset]?.[i] ?? '';
    const ph = onset + RHYMES[parts.rhyme];
    return { kana: toKatakana(ph), tone, sign: TONE_SIGN[tone], phonemes: ph };
  },
};
