import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toGray, adaptiveThreshold, removeRuledLines, estimateSkew, dilate, isInverted,
} from '../src/imaging.js';

/** 明るさの配列から、白紙に黒で描いた絵を作る */
function blank(w, h) {
  return { w, h, gray: new Uint8Array(w * h).fill(255) };
}
const ink = (page, x, y) => { page.gray[y * page.w + x] = 0; };
const binarize = (page, bias = 0.12) =>
  adaptiveThreshold(page.gray, page.w, page.h, { radius: 8, bias });

test('明るさの取り出し', () => {
  const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]);
  assert.deepEqual([...toGray(rgba, 2, 1)], [255, 0]);
});

test('局所しきい値 — 明暗のむらがあっても文字が残る', () => {
  const page = blank(120, 60);
  // 左は明るく、右へ行くほど暗い紙
  for (let y = 0; y < 60; y += 1) {
    for (let x = 0; x < 120; x += 1) page.gray[y * 120 + x] = 255 - x;
  }
  // 地より 60 だけ暗い「文字」を左右に置く
  for (const cx of [20, 100]) {
    for (let y = 20; y < 34; y += 1) {
      for (let x = cx; x < cx + 8; x += 1) {
        page.gray[y * 120 + x] = Math.max(0, 255 - x - 60);
      }
    }
  }
  const out = binarize(page);
  assert.equal(out[26 * 120 + 22], 1, '明るい側の文字');
  assert.equal(out[26 * 120 + 102], 1, '暗い側の文字');
  assert.equal(out[5 * 120 + 60], 0, '地は文字にしない');
});

test('罫線を消す — 線だけが消えて文字は残る', () => {
  const page = blank(100, 40);
  for (let x = 0; x < 100; x += 1) ink(page, x, 20);          // 横罫線
  for (let y = 10; y < 16; y += 1) for (let x = 30; x < 34; x += 1) ink(page, x, y);
  const out = binarize(page);
  const removed = removeRuledLines(out, 100, 40);
  assert.ok(removed > 50, '線の画素が消えている');
  assert.equal(out[20 * 100 + 50], 0, '罫線は消えた');
  assert.equal(out[12 * 100 + 31], 1, '文字は残っている');
});

test('罫線を消す — 短い線は消さない', () => {
  const page = blank(100, 40);
  for (let x = 20; x < 45; x += 1) ink(page, x, 20);          // 幅の1/4しかない線
  const out = binarize(page);
  removeRuledLines(out, 100, 40);
  assert.equal(out[20 * 100 + 30], 1, '文字の一部かもしれない線は残す');
});

/** 文字の行を並べた絵を、指定の角度だけ傾けて作る */
function tilted(deg) {
  const w = 400;
  const h = 300;
  const out = new Uint8Array(w * h);
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  for (let row = 0; row < 6; row += 1) {
    for (let x = 40; x < 360; x += 1) {
      if (Math.floor(x / 8) % 2 === 1) continue; // 文字の隙間
      for (let t = 0; t < 14; t += 1) {
        const cx = x - w / 2;
        const cy = 40 + row * 40 + t - h / 2;
        const nx = Math.round(cx * cos - cy * sin + w / 2);
        const ny = Math.round(cx * sin + cy * cos + h / 2);
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = 1;
      }
    }
  }
  return out;
}

test('傾きの推定 — 直すべき角度を返す', () => {
  for (const deg of [0, -5, -2.5, 1.5, 4, 7]) {
    const angle = estimateSkew(tilted(deg), 400, 300);
    assert.ok(Math.abs(angle + deg) < 1.0, `${deg}度 → ${angle}度`);
  }
});

test('途切れた線をつなぐ', () => {
  const w = 5;
  const h = 5;
  const src = new Uint8Array(w * h);
  src[1 * w + 2] = 1;
  src[3 * w + 2] = 1; // 縦に1画素あいた隙間
  const out = dilate(src, w, h);
  assert.equal(out[2 * w + 2], 1, '上下が文字なら隙間を埋める');
  assert.equal(out[0 * w + 0], 0, '関係のない所は埋めない');
});

test('白黒が反転しているかの判定', () => {
  assert.equal(isInverted(new Uint8Array([1, 1, 1, 0])), true);
  assert.equal(isInverted(new Uint8Array([0, 0, 0, 1])), false);
});
