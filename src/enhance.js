/**
 * 写真を文字認識にかけやすい形に整える
 *
 * 計算の中身は imaging.js にあり、ここは canvas との受け渡しと段取りを持つ。
 * 手当ては2段階に分かれている。
 *
 *   deskewCanvas … 紙の傾きを直す。写真そのものを回すので、
 *                  写真に重ねるルビの位置もそのまま合う
 *   enhance      … 白黒に整え、罫線を消す。大きさは変えない
 *
 * 傾きを先に直すのが要点。傾いたままだと罫線が斜めに走り、
 * 「その行の文字画素が多い」という手がかりで見つけられない。
 */
import {
  toGray, downscaleGray, adaptiveThreshold, removeRuledLines,
  estimateSkew, dilate, isInverted,
} from './imaging.js';

// 読み取る文字の種類ごとの設定
export const PROFILES = {
  print: { bias: 0.12, radiusDiv: 40, thicken: false, psm: '3' },
  // 手書きは線が細く薄く、途切れやすい。しきい値を緩め、窓を小さく取り、
  // 途切れをつないでから認識にかける
  hand: { bias: 0.05, radiusDiv: 22, thicken: true, psm: '6' },
};

const grayOf = (canvas) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return toGray(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
};

/** 紙の傾きを直した canvas を返す。まっすぐなら元のまま返す */
export function deskewCanvas(source) {
  const gray = grayOf(source);
  // 角度を測るだけなので、小さくしてから調べる
  const small = downscaleGray(gray, source.width, source.height, 600);
  const ink = adaptiveThreshold(small.gray, small.w, small.h, {
    radius: Math.max(5, Math.round(Math.min(small.w, small.h) / 40)),
    bias: 0.1,
  });

  const angle = estimateSkew(ink, small.w, small.h);
  if (Math.abs(angle) < 0.5) return source;

  const rad = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = Math.ceil(source.width * cos + source.height * sin);
  const h = Math.ceil(source.width * sin + source.height * cos);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff'; // 回すと四隅がはみ出す。余白は地の色で埋める
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

/**
 * 白黒に整えた新しい canvas を返す（大きさは変えない）
 * @param {HTMLCanvasElement} source 傾きを直したあとの写真
 * @param {{mode?: 'print'|'hand'}} options
 */
export function enhance(source, { mode = 'print' } = {}) {
  const profile = PROFILES[mode] ?? PROFILES.print;
  const w = source.width;
  const h = source.height;
  const gray = grayOf(source);

  const radius = Math.max(7, Math.round(Math.min(w, h) / profile.radiusDiv));
  let ink = adaptiveThreshold(gray, w, h, { radius, bias: profile.bias });

  removeRuledLines(ink, w, h);
  if (profile.thicken) ink = dilate(ink, w, h);

  // 白抜き文字の看板などは反転している。認識は「明るい地に暗い字」が前提
  const inverted = isInverted(ink);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  const image = ctx.createImageData(w, h);
  const px = image.data;
  for (let i = 0, p = 0; i < ink.length; i += 1, p += 4) {
    const v = (inverted ? !ink[i] : Boolean(ink[i])) ? 0 : 255;
    px[p] = v;
    px[p + 1] = v;
    px[p + 2] = v;
    px[p + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return out;
}
