/**
 * URL を QR コードにして描く
 *
 * その場にいる相手へ渡すときは、リンクを送るより画面を向けるほうが速い。
 * 印刷や拡大で崩れないよう、画像ではなく SVG で描いている。
 */
import qrcode from './vendor/qrcode.mjs';

/**
 * @param {string} text QRに入れる文字列（URL）
 * @param {number} margin 周囲の余白（モジュール数）。読み取りには4以上が要る
 * @returns {SVGElement}
 */
export function makeQrSvg(text, { margin = 4 } = {}) {
  // 型番0 = 収まる大きさを自動で選ぶ。誤り訂正 M は汚れや反射に程よく強い
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const size = count + margin * 2;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${text} のQRコード`);

  const bg = document.createElementNS(ns, 'rect');
  bg.setAttribute('width', String(size));
  bg.setAttribute('height', String(size));
  bg.setAttribute('fill', '#ffffff');
  svg.append(bg);

  // 1行ぶんの連続した黒モジュールをまとめて1つの矩形にする（要素数を減らす）
  let path = '';
  for (let row = 0; row < count; row += 1) {
    let start = -1;
    for (let col = 0; col <= count; col += 1) {
      const dark = col < count && qr.isDark(row, col);
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) {
        path += `M${start + margin} ${row + margin}h${col - start}v1h${-(col - start)}z`;
        start = -1;
      }
    }
  }
  const shape = document.createElementNS(ns, 'path');
  shape.setAttribute('d', path);
  shape.setAttribute('fill', '#101418');
  svg.append(shape);

  return svg;
}
