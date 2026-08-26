/**
 * 音素列 → カタカナ変換エンジン
 *
 * 各言語モジュールは「綴り」を共通の音素表記に落とし、この関数がカタカナにする。
 * カタカナの当て方を1箇所に集約することで、言語をまたいで表記が揺れないようにしている。
 *
 * 音素表記（ASCII）
 *   子音 p b t d k g f v s z S(sh) Z(zh) T(th) D(dh) x(kh) h ts dz tS(ch) dZ(j)
 *        m n J(ny) N(ng) l r R(仏独のr) w y kw gw Q(促音)
 *   母音 a i u e o / A(ae) @(曖昧母音) V(ʌ) O(ɔ) U(ʊ) I(ɪ)
 *   記号 ':' 直前の母音を長音にする
 */

// 子音 × 母音（ア イ ウ エ オ）
const SYLL = {
  '':   ['ア', 'イ', 'ウ', 'エ', 'オ'],
  p:    ['パ', 'ピ', 'プ', 'ペ', 'ポ'],
  b:    ['バ', 'ビ', 'ブ', 'ベ', 'ボ'],
  t:    ['タ', 'ティ', 'トゥ', 'テ', 'ト'],
  d:    ['ダ', 'ディ', 'ドゥ', 'デ', 'ド'],
  k:    ['カ', 'キ', 'ク', 'ケ', 'コ'],
  g:    ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'],
  f:    ['ファ', 'フィ', 'フ', 'フェ', 'フォ'],
  v:    ['ヴァ', 'ヴィ', 'ヴ', 'ヴェ', 'ヴォ'],
  s:    ['サ', 'シ', 'ス', 'セ', 'ソ'],
  z:    ['ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'],
  S:    ['シャ', 'シ', 'シュ', 'シェ', 'ショ'],
  Z:    ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ'],
  T:    ['サ', 'シ', 'ス', 'セ', 'ソ'],
  D:    ['ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'],
  x:    ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
  h:    ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
  ts:   ['ツァ', 'ツィ', 'ツ', 'ツェ', 'ツォ'],
  dz:   ['ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'],
  tS:   ['チャ', 'チ', 'チュ', 'チェ', 'チョ'],
  dZ:   ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ'],
  m:    ['マ', 'ミ', 'ム', 'メ', 'モ'],
  n:    ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
  J:    ['ニャ', 'ニ', 'ニュ', 'ニェ', 'ニョ'],
  N:    ['ンガ', 'ンギ', 'ング', 'ンゲ', 'ンゴ'],
  l:    ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  r:    ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  R:    ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  w:    ['ワ', 'ウィ', 'ウ', 'ウェ', 'ウォ'],
  y:    ['ヤ', 'イ', 'ユ', 'イェ', 'ヨ'],
  kw:   ['クァ', 'クィ', 'ク', 'クェ', 'クォ'],
  gw:   ['グァ', 'グィ', 'グ', 'グェ', 'グォ'],
};

// 子音 + 拗音のy（例: ky+a → キャ）
const YOUON = {
  k:  ['キャ', 'キ', 'キュ', 'キェ', 'キョ'],
  g:  ['ギャ', 'ギ', 'ギュ', 'ギェ', 'ギョ'],
  s:  ['シャ', 'シ', 'シュ', 'シェ', 'ショ'],
  z:  ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ'],
  t:  ['チャ', 'チ', 'チュ', 'チェ', 'チョ'],
  d:  ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ'],
  n:  ['ニャ', 'ニ', 'ニュ', 'ニェ', 'ニョ'],
  h:  ['ヒャ', 'ヒ', 'ヒュ', 'ヒェ', 'ヒョ'],
  x:  ['ヒャ', 'ヒ', 'ヒュ', 'ヒェ', 'ヒョ'],
  b:  ['ビャ', 'ビ', 'ビュ', 'ビェ', 'ビョ'],
  p:  ['ピャ', 'ピ', 'ピュ', 'ピェ', 'ピョ'],
  m:  ['ミャ', 'ミ', 'ミュ', 'ミェ', 'ミョ'],
  r:  ['リャ', 'リ', 'リュ', 'リェ', 'リョ'],
  l:  ['リャ', 'リ', 'リュ', 'リェ', 'リョ'],
  R:  ['リャ', 'リ', 'リュ', 'リェ', 'リョ'],
  f:  ['フャ', 'フィ', 'フュ', 'フェ', 'フョ'],
  v:  ['ヴャ', 'ヴィ', 'ヴュ', 'ヴェ', 'ヴョ'],
  ts: ['チャ', 'チ', 'チュ', 'チェ', 'チョ'],
  // もともと口蓋音の子音は y を吸収する（щ, ч などの転写で効く）
  S:  ['シャ', 'シ', 'シュ', 'シェ', 'ショ'],
  Z:  ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ'],
  tS: ['チャ', 'チ', 'チュ', 'チェ', 'チョ'],
  dZ: ['ジャ', 'ジ', 'ジュ', 'ジェ', 'ジョ'],
  J:  ['ニャ', 'ニ', 'ニュ', 'ニェ', 'ニョ'],
};

// 母音を伴わない子音（音節末）
const CODA = {
  p: 'プ', b: 'ブ', t: 'ト', d: 'ド', k: 'ク', g: 'グ',
  f: 'フ', v: 'ヴ', s: 'ス', z: 'ズ', S: 'シュ', Z: 'ジュ',
  T: 'ス', D: 'ズ', x: 'フ', h: '', ts: 'ツ', dz: 'ズ',
  tS: 'チ', dZ: 'ジ', m: 'ム', n: 'ン', J: 'ニ', N: 'ング',
  l: 'ル', r: 'ル', R: 'ル', w: 'ウ', y: 'イ', kw: 'ク', gw: 'グ',
};

// 母音を五十音の列インデックスに寄せる
const VOWEL_INDEX = {
  a: 0, i: 1, u: 2, e: 3, o: 4,
  A: 0, // ae（cat の a）
  '@': 0, // 曖昧母音
  V: 0, // ʌ
  O: 4, // ɔ
  U: 2, // ʊ
  I: 1, // ɪ
};

const CONSONANTS = Object.keys(SYLL).filter((c) => c !== '');
// 長い記号から順に切り出す
const TOKENS = [...CONSONANTS, ...Object.keys(VOWEL_INDEX), 'Q', ':'].sort(
  (a, b) => b.length - a.length,
);

export function tokenize(phonemes) {
  const out = [];
  let i = 0;
  while (i < phonemes.length) {
    const hit = TOKENS.find((t) => phonemes.startsWith(t, i));
    if (hit) {
      out.push(hit);
      i += hit.length;
    } else {
      i += 1; // 未知の記号は読み飛ばす
    }
  }
  return out;
}

const isVowel = (t) => t !== undefined && Object.hasOwn(VOWEL_INDEX, t);
const isConsonant = (t) => t !== undefined && Object.hasOwn(SYLL, t) && t !== '';

/** 音素列をカタカナに変換する */
export function toKatakana(phonemes) {
  const tok = tokenize(phonemes);
  let out = '';
  let i = 0;

  const eatLong = () => {
    while (tok[i] === ':') {
      out += 'ー';
      i += 1;
    }
  };

  while (i < tok.length) {
    const t = tok[i];

    if (t === 'Q') {
      out += 'ッ';
      i += 1;
      continue;
    }
    if (t === ':') {
      out += 'ー';
      i += 1;
      continue;
    }
    if (isVowel(t)) {
      out += SYLL[''][VOWEL_INDEX[t]];
      i += 1;
      eatLong();
      continue;
    }
    if (!isConsonant(t)) {
      i += 1;
      continue;
    }

    // 子音 (+ 半母音) + 母音
    const glide = (tok[i + 1] === 'y' || tok[i + 1] === 'w') && isVowel(tok[i + 2]) ? tok[i + 1] : null;
    const vowel = glide ? tok[i + 2] : tok[i + 1];

    if (isVowel(vowel)) {
      const vi = VOWEL_INDEX[vowel];
      let kana;
      if (glide === 'y' && YOUON[t]) {
        kana = YOUON[t][vi];
      } else if (glide === 'w' && SYLL[t + 'w']) {
        kana = SYLL[t + 'w'][vi];
      } else if (glide) {
        // 拗音表を持たない子音は「子音+母音 + 半母音」に分解する
        // （w は オ段、y は イ段 が日本語の慣用に近い: roi→ロワ）
        kana = SYLL[t][glide === 'w' ? 4 : 1] + SYLL[glide][vi];
      } else {
        kana = SYLL[t][vi];
      }
      out += kana;
      i += glide ? 3 : 2;
      eatLong();
      continue;
    }

    // 母音が続かない = 音節末
    if (t === 'm' && ['p', 'b', 'm'].includes(tok[i + 1])) {
      out += 'ン';
    } else if (t === 'N') {
      // 語末は「ング」、子音の前は「ン」（sing→シング / England→イングランド）
      out += tok[i + 1] === undefined ? 'ング' : 'ン';
    } else {
      out += CODA[t] ?? '';
    }
    i += 1;
  }

  return out;
}

export const _internal = { SYLL, YOUON, CODA, VOWEL_INDEX };
