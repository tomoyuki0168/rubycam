/**
 * 中国語（簡体字・繁体字）
 *
 * 漢字から読みを出すには字書が要るので、ピンイン変換は pinyin-pro を
 * 実行時に読み込んで使う（prepare()）。読み込めない環境では
 * ルビを空にして、UI 側で理由を出せるようにしてある。
 * ピンイン → カタカナの対応表は自前で持っているので、単体で試験できる。
 */
import { toKatakana } from '../kana.js';

const PINYIN_CDN = 'https://cdn.jsdelivr.net/npm/pinyin-pro@3.26.0/+esm';

let pinyinFn = null;
let loadError = null;

export async function prepare() {
  if (pinyinFn || loadError) return;
  try {
    const mod = await import(/* @vite-ignore */ PINYIN_CDN);
    pinyinFn = mod.pinyin;
  } catch (e) {
    loadError = e;
  }
}

export function isReady() {
  return Boolean(pinyinFn);
}

const TONE_LETTERS = {
  ā: 'a', á: 'a', ǎ: 'a', à: 'a', ē: 'e', é: 'e', ě: 'e', è: 'e',
  ī: 'i', í: 'i', ǐ: 'i', ì: 'i', ō: 'o', ó: 'o', ǒ: 'o', ò: 'o',
  ū: 'u', ú: 'u', ǔ: 'u', ù: 'u', ǖ: 'v', ǘ: 'v', ǚ: 'v', ǜ: 'v', ü: 'v',
};

export function stripTone(py) {
  return [...py.toLowerCase()].map((c) => TONE_LETTERS[c] ?? c).join('');
}

// 声母 → 音素
const INITIALS = [
  ['zh', 'dZ'], ['ch', 'tS'], ['sh', 'S'],
  ['b', 'b'], ['p', 'p'], ['m', 'm'], ['f', 'f'],
  ['d', 'd'], ['t', 't'], ['n', 'n'], ['l', 'l'],
  ['g', 'g'], ['k', 'k'], ['h', 'h'],
  ['j', 'dZ'], ['q', 'tS'], ['x', 'S'],
  ['r', 'r'], ['z', 'ts'], ['c', 'ts'], ['s', 's'],
  ['y', 'y'], ['w', 'w'],
];

// 韻母 → 音素
const FINALS = {
  a: 'a', o: 'o', e: 'u:', ê: 'e', er: 'a:', ai: 'ai', ei: 'ei', ao: 'ao', ou: 'ou',
  an: 'an', en: 'en', ang: 'aN', eng: 'oN', ong: 'oN',
  i: 'i:', ia: 'ia', ie: 'ie', iao: 'iao', iu: 'iu', iou: 'iou',
  ian: 'ien', in: 'in', iang: 'iaN', ing: 'iN', iong: 'ioN',
  u: 'u:', ua: 'ua', uo: 'uo', uai: 'uai', ui: 'ui', uei: 'uei',
  uan: 'uan', un: 'uen', uen: 'uen', uang: 'uaN', ueng: 'ueN',
  v: 'yu:', ve: 'yue', van: 'yuen', vn: 'yun',
};

// そり舌音・舌歯音のあとの i は特殊な母音になる
const APICAL = { zh: 'dZi:', ch: 'tSi:', sh: 'Si:', r: 'ri:', z: 'tsu:', c: 'tsu:', s: 'su:' };

/** ピンイン1音節をカタカナにする */
export function pinyinToKatakana(syllable) {
  const py = stripTone(syllable).replace(/[0-9]/g, '');
  if (!py) return '';

  const initial = INITIALS.find(([sp]) => py.startsWith(sp));
  const head = initial ? initial[0] : '';
  let rest = py.slice(head.length);

  if (rest === 'i' && APICAL[head]) return toKatakana(APICAL[head]);

  // y-, w- 始まりは韻母の表記が変わる
  if (head === 'y') {
    // yu / yue / yuan / yun は ü の系列、それ以外は i の系列
    if (rest === 'i') rest = 'i';
    else if (rest === 'e') rest = 'ie';
    else if (rest.startsWith('u')) rest = `v${rest.slice(1)}`;
    else rest = `i${rest}`;
  } else if (head === 'w') {
    rest = rest === 'u' ? 'u' : `u${rest}`;
  }

  const final = FINALS[rest];
  if (final === undefined) return toKatakana((initial?.[1] ?? '') + rest);

  const onset = initial ? initial[1] : '';
  // y / w は韻母側の i / u が担うので二重にしない
  const body = head === 'y' || head === 'w' ? final : onset + final;
  // 中国語では -n も -ng もカタカナでは「ン」で書く
  return toKatakana(body).replace(/ング$/, 'ン');
}

export default {
  code: 'zh',
  label: '中国語',
  ocr: 'chi_sim',
  speech: 'zh-CN',
  script: 'han',
  prepare,
  isReady,
  rubyStyles: ['pinyin', 'kana'],
  // 漢字は1文字ずつルビを振る
  split: (text) => [...text],
  joinWith: '',
  read(text, { style = 'pinyin' } = {}) {
    if (!pinyinFn) return { kana: '', roman: '', unavailable: true };
    const roman = pinyinFn(text, { toneType: 'symbol', type: 'string' });
    const kana = roman.split(/\s+/).filter(Boolean).map(pinyinToKatakana).join('');
    return { kana, roman, ruby: style === 'kana' ? kana : roman };
  },
};
