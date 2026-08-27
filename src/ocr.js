/**
 * 写真から文字を読み取る（Tesseract.js を実行時に読み込む）
 *
 * 単語ごとの座標が取れるので、写真の上にルビを重ねる表示に使える。
 */
const VERSION = '5.1.1';
const CORE_VERSION = '5.1.0';

// 取得先。先頭から順に試し、落ちたら次へ回す
const ORIGINS = [
  'https://cdn.jsdelivr.net/npm',
  'https://unpkg.com',
];
const LANG_BASE = 'https://tessdata.projectnaptha.com/4.0.0';

let scriptPromise = null;
let activeOrigin = ORIGINS[0];
const workers = new Map();

function loadOne(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.onload = resolve;
    el.onerror = () => {
      el.remove();
      reject(new Error(src));
    };
    document.head.append(el);
  });
}

/** ページ側で読み込み済みならそれを使い、なければ CDN を順に試す */
async function loadEngine() {
  if (window.Tesseract) return;
  if (scriptPromise) return scriptPromise;
  scriptPromise = (async () => {
    for (const origin of ORIGINS) {
      try {
        await loadOne(`${origin}/tesseract.js@${VERSION}/dist/tesseract.min.js`);
        activeOrigin = origin;
        return;
      } catch {
        /* 次の取得先を試す */
      }
    }
    scriptPromise = null;
    throw new Error('文字認識エンジンを読み込めませんでした。通信できる環境で開き直してください。');
  })();
  return scriptPromise;
}

/**
 * 認識用の作業単位を作る
 *
 * 字形が密な言語（ミャンマー文字など）は、精度の高い辞書（_best）を使う。
 * 取得できない場合に備えて、通常の辞書へ落とせるようにしてある。
 */
async function getWorker(lang, quality, onProgress) {
  const key = `${lang}:${quality}`;
  if (workers.has(key)) return workers.get(key);
  await loadEngine();

  const paths = quality === 'best' ? [`${LANG_BASE}_best`, LANG_BASE] : [LANG_BASE];
  const promise = (async () => {
    let lastError;
    for (const langPath of paths) {
      try {
        return await window.Tesseract.createWorker(lang, 1, {
          workerPath: `${activeOrigin}/tesseract.js@${VERSION}/dist/worker.min.js`,
          corePath: `${activeOrigin}/tesseract.js-core@${CORE_VERSION}`,
          langPath,
          logger: (m) => onProgress?.(m),
        });
      } catch (e) {
        lastError = e;
      }
    }
    workers.delete(key);
    throw lastError ?? new Error('文字認識の辞書を読み込めませんでした。');
  })();

  workers.set(key, promise);
  return promise;
}

/** data.blocks を辿って単語と座標を取り出す */
function collectWords(data) {
  const words = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node.words) {
      node.words.forEach((w) => {
        if (w.text?.trim()) words.push({ text: w.text, bbox: w.bbox, confidence: w.confidence ?? 0 });
      });
      return;
    }
    ['blocks', 'paragraphs', 'lines'].forEach((key) => visit(node[key]));
  };
  visit(data.blocks ?? []);
  if (words.length === 0 && Array.isArray(data.words)) {
    data.words.forEach((w) => {
      if (w.text?.trim()) words.push({ text: w.text, bbox: w.bbox, confidence: w.confidence ?? 0 });
    });
  }
  return words;
}

/** 認識結果を行にまとめ直す（読み上げと文章表示に使う） */
function collectLines(data) {
  const lines = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.lines) {
      node.lines.forEach((l) => {
        const words = (l.words ?? []).filter((w) => w.text?.trim());
        if (words.length) lines.push({ text: l.text?.trim() ?? words.map((w) => w.text).join(' '), bbox: l.bbox, words });
      });
      return;
    }
    ['blocks', 'paragraphs'].forEach((key) => visit(node[key]));
  };
  visit(data.blocks ?? []);
  return lines;
}

/**
 * 行と語を組み立てる
 *
 * 写真に重ねる表示と文章の表示で同じ語を指せるよう、
 * 語には通し番号を振り、両方から同じ実体を参照する。
 * 「この語にだけルビをふる」を扱うために要る。
 */
function buildWords(data) {
  const lines = collectLines(data).map((line) => ({ ...line }));
  const words = [];

  for (const line of lines) {
    line.items = (line.words ?? [])
      .filter((w) => w.text?.trim())
      .map((w) => {
        const item = { id: words.length, text: w.text, bbox: w.bbox, confidence: w.confidence ?? 0 };
        words.push(item);
        return item;
      });
  }

  // 行が取れない結果もあるので、そのときは語だけを1行として扱う
  if (words.length === 0) {
    for (const w of collectWords(data)) {
      words.push({ id: words.length, ...w });
    }
    if (words.length) {
      lines.push({ text: words.map((w) => w.text).join(' '), items: words });
    }
  }

  return { words, lines: lines.filter((l) => l.items?.length) };
}

export async function recognize(canvas, lang, onProgress, quality = 'standard') {
  const worker = await getWorker(lang, quality, onProgress);
  const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
  const { words, lines } = buildWords(data);
  return { text: data.text ?? '', words, lines, confidence: data.confidence ?? 0 };
}

export async function terminateAll() {
  for (const p of workers.values()) {
    try {
      (await p).terminate();
    } catch {
      /* 後片付けなので失敗は無視する */
    }
  }
  workers.clear();
}
