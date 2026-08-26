/**
 * 綴り → 音素 のルールエンジン
 *
 * 単語の先頭から、ルールを定義順に試して最初に当たったものを採用し、
 * 消費した文字数だけ進む。並び順が優先順位そのものなので、
 * 長い綴り・特殊な綴りを先に書く。
 *
 * ルールの形: [パターン, 出力]
 *   パターン: 文字列（前方一致）または RegExp（sticky で位置指定して評価）
 *   出力    : 音素文字列、または (match, ctx) => 音素文字列
 *   ctx     : { word, index, before, after, atStart, atEnd }
 */

export function compile(rules) {
  return rules.map(([pattern, out]) => {
    if (pattern instanceof RegExp) {
      const flags = pattern.flags.replace(/[gy]/g, '') + 'y';
      return { re: new RegExp(pattern.source, flags), out };
    }
    return { literal: pattern, out };
  });
}

export function transcribe(word, compiled, { fallback = '' } = {}) {
  const w = word;
  let i = 0;
  let out = '';

  while (i < w.length) {
    let matched = null;
    let len = 0;

    for (const rule of compiled) {
      if (rule.literal !== undefined) {
        if (w.startsWith(rule.literal, i) && rule.literal.length > 0) {
          matched = rule;
          len = rule.literal.length;
          break;
        }
      } else {
        rule.re.lastIndex = i;
        const m = rule.re.exec(w);
        if (m && m.index === i) {
          matched = rule;
          len = m[0].length || 1;
          matched._m = m;
          break;
        }
      }
    }

    if (!matched) {
      out += typeof fallback === 'function' ? fallback(w[i]) : fallback;
      i += 1;
      continue;
    }

    const text = w.slice(i, i + len);
    const ctx = {
      word: w,
      index: i,
      before: w.slice(0, i),
      after: w.slice(i + len),
      atStart: i === 0,
      atEnd: i + len >= w.length,
    };
    out += typeof matched.out === 'function' ? matched.out(text, ctx) : matched.out;
    i += len;
  }

  return out;
}

/** アクセント記号を落として素の英字にする（言語ごとの前処理で使う） */
export function stripDiacritics(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

/** 同じ子音の連続を1つにまとめる（促音にしない言語向け） */
export function collapseDoubles(phonemes, keep = '') {
  return phonemes.replace(
    /(tS|dZ|ts|dz|[pbtdkgfvszSZTDxhmnlrRJN])\1/g,
    (m, c) => (keep.includes(c) ? m : c),
  );
}

/** 同じ子音の連続を促音 Q + 単子音にまとめる */
export function geminate(phonemes) {
  return phonemes.replace(/(tS|dZ|ts|dz|[pbtdkgfvszSZTDxhlrR])\1/g, 'Q$1');
}
