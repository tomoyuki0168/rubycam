/**
 * 画像処理の計算部分
 *
 * canvas に触らない純粋な計算だけをここに置き、試験できるようにしている。
 * canvas との受け渡しは enhance.js が担う。
 *
 * 扱う形は次の2つ。
 *   gray … 0-255 の明るさ（Uint8Array, 長さ w*h）
 *   ink  … 1 が文字、0 が地（Uint8Array, 長さ w*h）
 */

/** RGBA から明るさを取り出す */
export function toGray(rgba, w, h) {
  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = (rgba[p] * 299 + rgba[p + 1] * 587 + rgba[p + 2] * 114) / 1000;
  }
  return gray;
}

/** 範囲の合計を4点の引き算で出せるようにする（局所しきい値に使う） */
export function integralImage(gray, w, h) {
  const sum = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let row = 0;
    for (let x = 0; x < w; x += 1) {
      row += gray[y * w + x];
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row;
    }
  }
  return sum;
}

/**
 * 局所しきい値で二値化する
 *
 * 紙をカメラで撮ると、影や光のむらで濃さが場所ごとに変わる。
 * 画像全体で1つのしきい値を決めると、影の側の文字が潰れるか、
 * 明るい側の地色が黒く残る。その画素の周りの平均と比べることで避ける。
 *
 * bias は「周りの平均よりどれだけ暗ければ文字とみなすか」。
 * 手書きは線が細く薄いので、印刷より小さい値にする。
 */
export function adaptiveThreshold(gray, w, h, { radius, bias }) {
  const sum = integralImage(gray, w, h);
  const ink = new Uint8Array(w * h);

  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const total = sum[(y1 + 1) * (w + 1) + x1 + 1]
        - sum[y0 * (w + 1) + x1 + 1]
        - sum[(y1 + 1) * (w + 1) + x0]
        + sum[y0 * (w + 1) + x0];
      ink[y * w + x] = gray[y * w + x] < (total / count) * (1 - bias) ? 1 : 0;
    }
  }
  return ink;
}

/**
 * 罫線を消す
 *
 * ノートや帳票の罫線は、文字とつながって認識を大きく崩す。
 * 二値化すると罫線は破線状に途切れるので、「連続した長い線」では見つからない。
 * そこで2つの手がかりで判定する。
 *
 *   1. その行（列）の文字画素が多い — 罫線は端から端まで通っている
 *   2. その前後の行（列）は少ない — 罫線は細く、文字は縦に広がる
 *
 * 消すのは「縦の連なりが短い画素」だけなので、罫線を横切る文字の画は残る。
 */
export function removeRuledLines(ink, w, h, { minRatio = 0.35, maxThickness = 6 } = {}) {
  let removed = 0;

  const sweep = (outer, inner, at) => {
    const counts = new Int32Array(outer);
    for (let a = 0; a < outer; a += 1) {
      let n = 0;
      for (let b = 0; b < inner; b += 1) if (ink[at(a, b)]) n += 1;
      counts[a] = n;
    }

    for (let a = 0; a < outer; a += 1) {
      if (counts[a] < inner * minRatio) continue;
      const near = Math.max(counts[Math.max(0, a - 5)], counts[Math.min(outer - 1, a + 5)]);
      if (counts[a] < near * 3) continue; // 前後も多いなら、それは文字

      for (let b = 0; b < inner; b += 1) {
        if (!ink[at(a, b)]) continue;
        // この画素が属する「縦の連なり」の長さを測る
        let up = 0;
        while (a - up - 1 >= 0 && ink[at(a - up - 1, b)]) up += 1;
        let down = 0;
        while (a + down + 1 < outer && ink[at(a + down + 1, b)]) down += 1;
        if (up + down + 1 > maxThickness) continue; // 文字の画は残す

        for (let k = a - up; k <= a + down; k += 1) {
          if (ink[at(k, b)]) {
            ink[at(k, b)] = 0;
            removed += 1;
          }
        }
      }
    }
  };

  sweep(h, w, (y, x) => y * w + x);   // 横罫線
  sweep(w, h, (x, y) => y * w + x);   // 縦罫線
  return removed;
}

/** 縮小した明るさの配列を作る（傾きの推定を軽くするため） */
export function downscaleGray(gray, w, h, targetW) {
  if (w <= targetW) return { gray, w, h };
  const scale = targetW / w;
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y += 1) {
    const sy = Math.min(h - 1, Math.floor(y / scale));
    for (let x = 0; x < nw; x += 1) {
      out[y * nw + x] = gray[sy * w + Math.min(w - 1, Math.floor(x / scale))];
    }
  }
  return { gray: out, w: nw, h: nh };
}

/** 縮小した ink を作る（傾きの推定を軽くするため） */
export function downscaleInk(ink, w, h, targetW) {
  if (w <= targetW) return { ink, w, h };
  const scale = targetW / w;
  const nw = Math.max(1, Math.round(w * scale));
  const nh = Math.max(1, Math.round(h * scale));
  const out = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y += 1) {
    const sy = Math.min(h - 1, Math.floor(y / scale));
    for (let x = 0; x < nw; x += 1) {
      const sx = Math.min(w - 1, Math.floor(x / scale));
      out[y * nw + x] = ink[sy * w + sx];
    }
  }
  return { ink: out, w: nw, h: nh };
}

/**
 * 紙の傾きを推定する（度、時計回りが正）
 *
 * 文字が水平に並んでいるとき、行ごとの文字数の分布は山と谷がはっきりする。
 * 傾いていると平らにならされる。そこで少しずつ傾けながら
 * 「行ごとの合計の二乗和」が最大になる角度を探す。
 */
export function estimateSkew(ink, w, h, { maxDeg = 8, step = 0.5 } = {}) {
  const small = downscaleInk(ink, w, h, 500);
  let best = 0;
  let bestScore = -1;

  for (let deg = -maxDeg; deg <= maxDeg + 1e-9; deg += step) {
    const slope = Math.tan((deg * Math.PI) / 180);
    const profile = new Int32Array(small.h + Math.ceil(Math.abs(slope) * small.w) + 1);
    const offset = slope < 0 ? Math.ceil(-slope * small.w) : 0;

    for (let y = 0; y < small.h; y += 1) {
      for (let x = 0; x < small.w; x += 1) {
        if (!small.ink[y * small.w + x]) continue;
        const row = Math.round(y + slope * x) + offset;
        if (row >= 0 && row < profile.length) profile[row] += 1;
      }
    }

    let score = 0;
    for (const v of profile) score += v * v;
    if (score > bestScore) {
      bestScore = score;
      best = deg;
    }
  }
  return best;
}

/** 細く途切れた線をつなぐ（手書きの薄い線向け） */
export function dilate(ink, w, h) {
  const out = new Uint8Array(ink.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      if (ink[i]) {
        out[i] = 1;
        continue;
      }
      const up = y > 0 && ink[i - w];
      const down = y < h - 1 && ink[i + w];
      const left = x > 0 && ink[i - 1];
      const right = x < w - 1 && ink[i + 1];
      // 上下または左右の両側が文字なら、その隙間は線の途切れとみなす
      out[i] = (up && down) || (left && right) ? 1 : 0;
    }
  }
  return out;
}

/** 文字が地より多くなっていたら白黒が反転している（白抜きの看板など） */
export function isInverted(ink) {
  let dark = 0;
  for (const v of ink) dark += v;
  return dark > ink.length * 0.5;
}
