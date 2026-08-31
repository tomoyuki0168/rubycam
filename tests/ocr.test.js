import test from 'node:test';
import assert from 'node:assert/strict';

import { scoreResult } from '../src/ocr.js';

const words = (confidences) => ({ words: confidences.map((confidence) => ({ confidence })) });

test('結果の点数 — 語数と確からしさの両方を見る', () => {
  // 1語だけ高得点より、多くの語がそこそこ読めているほうを採る
  assert.ok(scoreResult(words(Array(10).fill(70))) > scoreResult(words([95])));
  // 確からしさが低すぎる語は数えない（語数だけ稼がせない）
  assert.equal(scoreResult(words([10, 20, 25])), 0);
  assert.equal(scoreResult(words([])), 0);
  assert.equal(scoreResult(null), 0);
  // 同じ語数なら、確からしさが高いほうが上
  assert.ok(scoreResult(words([80, 80])) > scoreResult(words([60, 60])));
});
