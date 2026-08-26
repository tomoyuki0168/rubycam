/**
 * 写真を文字認識にかけやすい形に整える
 *
 * 紙をカメラで撮ると、影や光のむらで濃さが場所ごとに変わる。
 * 画像全体で1つのしきい値を決めると、影の側の文字が潰れるか、
 * 明るい側の地色が黒く残る。そこで「その画素の周りの平均」と比べる
 * 局所しきい値にしている。積分画像を使うので、窓の大きさに関係なく
 * 1画素あたり一定の計算量で済む。
 */

/** 局所しきい値で白黒に整えた新しい canvas を返す（元の canvas は変えない） */
export function enhance(source) {
  const w = source.width;
  const h = source.height;
  const src = source.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
  const px = src.data;

  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < gray.length; i += 1, p += 4) {
    gray[i] = (px[p] * 299 + px[p + 1] * 587 + px[p + 2] * 114) / 1000;
  }

  // 積分画像。(w+1)×(h+1) の左上原点で、範囲の合計を4点の引き算で出せる
  const sum = new Int32Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < w; x += 1) {
      rowSum += gray[y * w + x];
      sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + rowSum;
    }
  }

  // 窓は文字より十分大きく、影のむらより小さいくらいが効く
  const radius = Math.max(7, Math.round(Math.min(w, h) / 40));
  const bias = 0.12; // 周りの平均よりこの割合だけ暗ければ文字とみなす

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const dst = out.getContext('2d').createImageData(w, h);
  const dp = dst.data;

  let dark = 0;
  for (let y = 0; y < h; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const total =
        sum[(y1 + 1) * (w + 1) + x1 + 1] -
        sum[y0 * (w + 1) + x1 + 1] -
        sum[(y1 + 1) * (w + 1) + x0] +
        sum[y0 * (w + 1) + x0];
      const mean = total / count;
      const v = gray[y * w + x] < mean * (1 - bias) ? 0 : 255;
      if (v === 0) dark += 1;
      const p = (y * w + x) * 4;
      dp[p] = v;
      dp[p + 1] = v;
      dp[p + 2] = v;
      dp[p + 3] = 255;
    }
  }

  // 白抜き文字の看板などは白黒が反転する。文字認識は「明るい地に暗い字」を
  // 前提にしているので、暗い画素が過半なら反転して戻す
  if (dark > w * h * 0.5) {
    for (let p = 0; p < dp.length; p += 4) {
      const v = 255 - dp[p];
      dp[p] = v;
      dp[p + 1] = v;
      dp[p + 2] = v;
    }
  }

  out.getContext('2d').putImageData(dst, 0, 0);
  return out;
}
