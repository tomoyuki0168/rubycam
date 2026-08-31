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
  toGray, downscaleGray, adaptiveThreshold, sauvolaThreshold, removeRuledLines,
  estimateSkew, estimateTextHeight, despeckle, dilate, isInverted,
} from './imaging.js';

// 読み取る文字の種類ごとの設定
export const PROFILES = {
  print: { method: 'mean', bias: 0.12, radiusDiv: 40, thicken: false, psm: '3' },
  // 手書きは線が細く薄く、途切れやすい。ばらつきも見る Sauvola で拾い、
  // 窓を小さく取り、途切れをつないでから認識にかける
  hand: { method: 'sauvola', k: 0.16, radiusDiv: 22, thicken: true, psm: '6' },
};

/**
 * 手書きは一度で当たるとは限らない。整え方と読ませ方を変えて何度か試し、
 * いちばん確からしい結果を採る（「じっくり読む」）。
 */
export const ATTEMPTS = {
  print: [{ mode: 'print', psm: '3' }],
  hand: [
    { mode: 'hand', psm: '6' },    // ひとかたまりとして読む
    { mode: 'hand', psm: '11' },   // まばらに散った文字として読む
    { mode: 'print', psm: '6' },   // 濃くはっきり書かれた手書き向け
  ],
};

const grayOf = (canvas) => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return toGray(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
};

/** 測るために、小さくして二値化する */
function survey(canvas) {
  const gray = grayOf(canvas);
  const small = downscaleGray(gray, canvas.width, canvas.height, 600);
  const ink = adaptiveThreshold(small.gray, small.w, small.h, {
    radius: Math.max(5, Math.round(Math.min(small.w, small.h) / 40)),
    bias: 0.1,
  });
  return { ...small, ink, ratio: canvas.width / small.w };
}

/** 回転と拡大をまとめて1回で描く */
function transform(source, degrees, scale) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const w = Math.ceil((source.width * cos + source.height * sin) * scale);
  const h = Math.ceil((source.width * sin + source.height * cos) * scale);

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff'; // 回すと四隅がはみ出す。余白は地の色で埋める
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.scale(scale, scale);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return out;
}

/**
 * 傾きを直し、文字が小さすぎるときは拡大した canvas を返す
 *
 * 文字認識は、文字が小さいと急に当たらなくなる。行の高さを測り、
 * 足りなければ引き伸ばしてから読ませる。
 *
 * 順番が要点で、**傾きを直してから高さを測る**。
 * 傾いたままだと罫線が斜めに走って見つけられず、
 * まっすぐにすると今度は罫線が「いちばん文字画素の多い行」になって
 * 高さの見積もりを乱す。だから測る前に罫線を消す。
 *
 * まっすぐで十分な大きさなら、元の canvas をそのまま返す。
 */
export function prepareCanvas(source, { minTextHeight = 30, maxEdge = 3600 } = {}) {
  const first = survey(source);
  const angle = estimateSkew(first.ink, first.w, first.h);
  const straight = Math.abs(angle) < 0.5 ? source : transform(source, angle, 1);

  const second = Math.abs(angle) < 0.5 ? first : survey(straight);
  removeRuledLines(second.ink, second.w, second.h);
  const textHeight = estimateTextHeight(second.ink, second.w, second.h) * second.ratio;

  let scale = textHeight > 0 && textHeight < minTextHeight ? minTextHeight / textHeight : 1;
  scale = Math.min(scale, 3, maxEdge / Math.max(straight.width, straight.height));
  scale = Math.max(1, scale);

  return scale < 1.05 ? straight : transform(straight, 0, scale);
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
  let ink = profile.method === 'sauvola'
    ? sauvolaThreshold(gray, w, h, { radius, k: profile.k })
    : adaptiveThreshold(gray, w, h, { radius, bias: profile.bias });

  removeRuledLines(ink, w, h);
  // 紙の汚れや圧縮の粒を落とす。大きさは文字に合わせる
  despeckle(ink, w, h, { minArea: Math.max(4, Math.round(Math.min(w, h) / 260)) });
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
