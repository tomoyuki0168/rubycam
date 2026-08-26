/** 画面まわり — 撮影、文字認識、ルビの生成と表示 */
import { LANGUAGES, getLanguage, detectLanguage } from './lang/index.js';
import { recognize } from './ocr.js';
import { enhance } from './enhance.js';
import { makeQrSvg } from './qr.js';

const $ = (id) => document.getElementById(id);
const el = {
  stage: $('stage'), preview: $('preview'), shot: $('shot'), overlay: $('overlay'),
  retake: $('btn-retake'), stop: $('btn-stop'),
  fileCamera: $('file-camera'), fileAlbum: $('file-album'),
  cameraBtn: $('btn-camera-file'), albumBtn: $('btn-album'),
  browserWarning: $('browser-warning'),
  lang: $('lang'), style: $('style'), toggleOverlay: $('toggle-overlay'),
  toggleEnhance: $('toggle-enhance'),
  dialectField: $('dialect-field'), dialect: $('dialect'),
  toneLegend: $('tone-legend'),
  status: $('status'), progress: $('progress'), bar: $('progress-bar'), hint: $('hint'),
  textPanel: $('text-panel'), textView: $('text-view'),
  speak: $('btn-speak'), copy: $('btn-copy'),
  sharePanel: $('share-panel'), shareUrl: $('share-url'), shareActions: $('share-actions'),
  share: $('btn-share'), line: $('btn-line'), copyUrl: $('btn-copy-url'), shareNote: $('share-note'),
  qr: $('qr'), qrCode: $('qr-code'), installHint: $('install-hint'),
  scope: $('scope'), pickTools: $('pick-tools'), pickCount: $('pick-count'),
  pickAll: $('btn-pick-all'), pickNone: $('btn-pick-none'),
};

// 認識にかける画像の長辺。細かい文字の言語ほど大きく取る
const MAX_EDGE = 1600;
const STORE_KEY = 'rubycam.lang';
const DIALECT_KEY = 'rubycam.dialect';

/**
 * 設定の保存先
 *
 * ファイルとして開いた場合（file://）、ブラウザによっては localStorage への
 * アクセス自体が例外になる。ここで失敗しても本体は動かなければならないので、
 * 読み書きを包んで握りつぶす。
 */
const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* 保存できなくても、そのセッションでは使える */
    }
  },
};

let stream = null;
let canvas = null;
let lastResult = null;
let busy = false;

// ルビをふる語の指定。空のときは「選んだ語だけ」でも何も出ない
const picked = new Set();
const picking = () => el.scope.value === 'picked';
const rubyOn = (item) => !picking() || picked.has(item.id);

function togglePick(item) {
  if (picked.has(item.id)) picked.delete(item.id);
  else picked.add(item.id);
  render();
}

/* ---------------- 初期化 ---------------- */

LANGUAGES.forEach((l) => {
  const o = document.createElement('option');
  o.value = l.code;
  o.textContent = l.label;
  el.lang.append(o);
});
el.lang.value = store.get(STORE_KEY) ?? 'en';
syncStyleOptions();

el.lang.addEventListener('change', () => {
  store.set(STORE_KEY, el.lang.value);
  syncStyleOptions();
  if (lastResult) render();
});
el.style.addEventListener('change', () => lastResult && render());
el.scope.addEventListener('change', () => {
  el.pickTools.hidden = !picking();
  if (lastResult) render();
});
el.pickAll.addEventListener('click', () => {
  lastResult?.words.forEach((w) => picked.add(w.id));
  render();
});
el.pickNone.addEventListener('click', () => {
  picked.clear();
  render();
});
el.toggleOverlay.addEventListener('change', () => lastResult && render());
el.dialect.addEventListener('change', () => {
  store.set(DIALECT_KEY, el.dialect.value);
  if (lastResult) render();
});

el.retake.addEventListener('click', reset);
el.stop.addEventListener('click', () => {
  stopCamera();
  setStatus(defaultStatus());
});
el.fileCamera.addEventListener('change', onFile);
el.fileAlbum.addEventListener('change', onFile);
el.albumBtn.addEventListener('click', () => el.fileAlbum.click());

// https 以外ではブラウザがカメラ映像を渡さない（file:// やアプリ内ブラウザ）
const liveCameraAvailable = Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * 「カメラで撮る」の1つのボタンで、撮影までを引き受ける
 *
 * 画面内にカメラ映像を出せるならそれを使い、出せないときだけ
 * 端末の標準カメラに回す。入口を1つにしないと、
 * 「カメラで撮る」を押したのにアルバムが開く、という食い違いが起きる。
 *
 * 端末カメラを開く呼び出しは、押した流れの中で行う必要がある
 * （iOS は非同期の待ちを挟むと無視する）。だから await の後には置かない。
 */
el.cameraBtn.addEventListener('click', () => {
  if (stream) {
    shoot();
    return;
  }
  if (!liveCameraAvailable) {
    el.fileCamera.click();
    return;
  }
  startCamera();
});

el.speak.addEventListener('click', speakAll);
el.copy.addEventListener('click', copyReadings);

/** 選んだ言語に関係のない設定は出さない */
function syncStyleOptions() {
  const lang = getLanguage(el.lang.value);
  const supportsRoman = ['ko', 'ru', 'el', 'zh', 'my'].includes(lang.code);
  el.style.disabled = !supportsRoman;
  if (!supportsRoman) el.style.value = 'kana';
  if (lang.code === 'zh') el.style.value = el.style.value === 'kana' ? 'kana' : 'roman';

  // 発音が地域で大きく分かれる言語だけ、選べるようにする
  el.dialectField.hidden = !lang.dialects;
  if (lang.dialects) {
    const saved = store.get(DIALECT_KEY);
    el.dialect.replaceChildren(
      ...lang.dialects.map((d) => {
        const o = document.createElement('option');
        o.value = d.value;
        o.textContent = d.label;
        return o;
      }),
    );
    el.dialect.value = lang.dialects.some((d) => d.value === saved) ? saved : lang.dialects[0].value;
  }
}

/* ---------------- 撮影 ---------------- */

async function startCamera() {
  el.hint.hidden = true;
  setStatus('カメラを準備しています…');
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
      audio: false,
    });
    el.preview.srcObject = stream;
    await el.preview.play();
    el.stage.classList.add('live');
    el.stage.classList.remove('shot');
    el.cameraBtn.textContent = '撮影する';
    el.stop.hidden = false;
    el.retake.hidden = true;
    setStatus('紙が画面いっぱいに入るように構えて、「撮影する」を押してください。');
  } catch (e) {
    // ここは await のあとなので、端末カメラを直接開いても無視される。
    // もう一度押してもらう形にする
    offerDeviceCamera(e);
  }
}

/** 画面内カメラが使えなかったときに、端末の標準カメラへ回す案内を出す */
function offerDeviceCamera(error) {
  setStatus(`画面内のカメラを使えませんでした（${error.name}）。`);
  el.hint.replaceChildren('端末のカメラで撮ることもできます。');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn small';
  btn.textContent = '端末のカメラで撮る';
  btn.addEventListener('click', () => el.fileCamera.click());
  el.hint.append(btn);
  el.hint.hidden = false;
}

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  el.stage.classList.remove('live');
  el.cameraBtn.textContent = 'カメラで撮る';
  el.stop.hidden = true;
}

function shoot() {
  if (!stream) return;
  const v = el.preview;
  setImage(v, v.videoWidth, v.videoHeight);
  stopCamera();
  run();
}

function onFile(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    setImage(img, img.naturalWidth, img.naturalHeight);
    stopCamera();
    URL.revokeObjectURL(img.src);
    run();
  };
  img.onerror = () => setStatus('この画像は読み込めませんでした。');
  img.src = URL.createObjectURL(file);
  ev.target.value = '';
}

/** 長辺を抑えた canvas に描き直す（認識を速くするため） */
function setImage(source, width, height) {
  const maxEdge = getLanguage(el.lang.value).scanScale ?? MAX_EDGE;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  el.shot.src = canvas.toDataURL('image/jpeg', 0.92);
  el.stage.classList.add('shot');
  el.retake.hidden = false;
}

function reset() {
  lastResult = null;
  picked.clear();
  canvas = null;
  el.overlay.replaceChildren();
  el.stage.classList.remove('shot');
  el.textPanel.hidden = true;
  el.toneLegend.hidden = true;
  el.retake.hidden = true;
  el.hint.hidden = true;
  setStatus(defaultStatus());
}

/* ---------------- 認識とルビ付け ---------------- */

async function run() {
  if (busy || !canvas) return;
  busy = true;
  el.hint.hidden = true;
  const lang = getLanguage(el.lang.value);
  try {
    setProgress(0.02);
    setStatus(`${lang.label}として読み取っています…`);
    await lang.prepare?.();
    if (lang.isReady && !lang.isReady()) {
      setStatus('中国語の読み仮名辞書を取得できませんでした。通信できる環境で開き直してください。');
    }

    const target = el.toggleEnhance.checked ? enhance(canvas) : canvas;
    const result = await recognize(target, lang.ocr, (m) => {
      if (m.status === 'recognizing text') setProgress(0.3 + m.progress * 0.7);
      else if (typeof m.progress === 'number') setProgress(m.progress * 0.3);
    });
    setProgress(1);

    if (!result.text.trim()) {
      setStatus('文字を見つけられませんでした。明るい場所で、紙を正面から撮り直してみてください。');
      el.textPanel.hidden = true;
  el.toneLegend.hidden = true;
      return;
    }

    lastResult = result;
    picked.clear();
    render();
    suggestLanguage(result.text);
    const fixed = countFixed(lang);
    const note = fixed ? `、うち${fixed}語は綴りを補正しました` : '';
    setStatus(`${result.words.length}語を読み取りました（認識の確からしさ ${Math.round(result.confidence)}%）${note}。`);
  } catch (e) {
    setStatus(e.message ?? '読み取りに失敗しました。');
  } finally {
    busy = false;
    setTimeout(() => setProgress(null), 600);
  }
}

/** 語からルビを1つ作る */
function readingOf(lang, word) {
  const raw = word.replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, '');
  if (!raw) return null;

  // 文字認識が綴りを取り違えていたら、直せる範囲で直してから読む
  const fix = lang.correct?.(raw);
  const core = fix?.changed ? fix.text : raw;

  const r = lang.read(core, { style: el.style.value, dialect: el.dialect.value });
  const roman = el.style.value === 'roman' && r.roman;
  const text = roman ? r.roman : r.ruby ?? r.kana;
  if (!text) return null;
  return {
    text,
    // 声調は読みそのものではないので、色を分けて添える
    sign: roman ? '' : r.sign ?? '',
    weak: r.confident === false,
    source: core,
    fixedFrom: fix?.changed ? raw : null,
  };
}

/** 読み + 声調記号 を、記号だけ色を変えて組み立てる */
function rubyNodes(r) {
  const nodes = [document.createTextNode(r.text)];
  if (r.sign) {
    const tone = document.createElement('i');
    tone.className = 'tone';
    tone.textContent = r.sign;
    nodes.push(tone);
  }
  return nodes;
}

function render() {
  const lang = getLanguage(el.lang.value);
  renderOverlay(lang);
  renderText(lang);
  renderToneLegend(lang);
  renderPickTools();
}

/** 選択の状況を出す */
function renderPickTools() {
  el.pickTools.hidden = !picking();
  if (!picking()) return;
  const total = lastResult?.words.length ?? 0;
  el.pickCount.textContent = picked.size
    ? `${total}語のうち${picked.size}語を選んでいます`
    : '写真の上か下の文章で、ルビをふりたい語を押してください（写真の上はなぞって囲むこともできます）';
}

/** 声調のある言語では、ルビに添えた記号の意味を出す */
function renderToneLegend(lang) {
  el.toneLegend.replaceChildren();
  if (!lang.toneLegend || el.style.value === 'roman') {
    el.toneLegend.hidden = true;
    return;
  }
  el.toneLegend.className = 'note tone-legend';
  el.toneLegend.append('ルビの末尾の記号は声調です — ');
  for (const [sign, meaning] of lang.toneLegend) {
    const span = document.createElement('span');
    const b = document.createElement('b');
    b.textContent = sign;
    span.append(b, meaning);
    el.toneLegend.append(span);
  }
  el.toneLegend.append('（記号なしは平らに伸ばす）');
  el.toneLegend.hidden = false;
}

function renderOverlay(lang) {
  el.overlay.replaceChildren();
  if (!el.toggleOverlay.checked || !lastResult || !canvas) return;
  const W = canvas.width;
  const H = canvas.height;

  el.overlay.classList.toggle('picking', picking());

  for (const w of lastResult.words) {
    if (!w.bbox) continue;
    const r = readingOf(lang, w.text);
    if (!r) continue;
    const on = rubyOn(w);
    const { x0, y0, x1, y1 } = w.bbox;
    const box = document.createElement('div');
    const nearTop = y0 / H < 0.09;
    box.className = `w${r.weak ? ' weak' : ''}${nearTop ? ' below' : ''}${r.fixedFrom ? ' fixed' : ''}`
      + (picking() ? (on ? ' on' : ' off') : '');
    box.style.left = `${(x0 / W) * 100}%`;
    box.style.top = `${(y0 / H) * 100}%`;
    box.style.width = `${((x1 - x0) / W) * 100}%`;
    box.style.height = `${((y1 - y0) / H) * 100}%`;

    if (on) {
      const rt = document.createElement('b');
      rt.append(...rubyNodes(r));
      // 文字の高さに合わせる。cqw なので写真を縮めてもルビの比率は崩れない。
      // 語の幅よりルビが長くなりすぎると隣とぶつかるので、幅でも頭を押さえる
      const byHeight = ((y1 - y0) / W) * 100 * 0.62;
      const byWidth = (((x1 - x0) / W) * 100 * 1.7) / Math.max(1, (r.text.length + r.sign.length) * 0.62);
      rt.style.fontSize = `${Math.max(1.5, Math.min(byHeight, byWidth))}cqw`;
      box.append(rt);
    }

    box.title = r.fixedFrom ? `${r.fixedFrom} → ${r.source}` : w.text;
    box.addEventListener('click', () => (picking() ? togglePick(w) : speak(w.text, lang)));
    el.overlay.append(box);
  }
}

/** 写真の上をなぞって、囲んだ範囲の語をまとめて選ぶ */
function setUpRegionPick() {
  let start = null;
  let rect = null;

  el.overlay.addEventListener('pointerdown', (ev) => {
    if (!picking() || !lastResult) return;
    start = { x: ev.offsetX, y: ev.offsetY };
    rect = document.createElement('div');
    rect.className = 'sel-rect';
    el.overlay.append(rect);
    el.overlay.setPointerCapture(ev.pointerId);
  });

  el.overlay.addEventListener('pointermove', (ev) => {
    if (!start || !rect) return;
    const box = boundsOf(start, { x: ev.offsetX, y: ev.offsetY });
    Object.assign(rect.style, {
      left: `${box.left}px`, top: `${box.top}px`,
      width: `${box.width}px`, height: `${box.height}px`,
    });
  });

  el.overlay.addEventListener('pointerup', (ev) => {
    if (!start) return;
    const box = boundsOf(start, { x: ev.offsetX, y: ev.offsetY });
    rect?.remove();
    start = null;
    rect = null;
    // ほとんど動いていなければ、なぞりではなく語への操作とみなす
    if (box.width < 8 && box.height < 8) return;

    const view = el.overlay.getBoundingClientRect();
    for (const w of lastResult.words) {
      if (!w.bbox) continue;
      const cx = ((w.bbox.x0 + w.bbox.x1) / 2 / canvas.width) * view.width;
      const cy = ((w.bbox.y0 + w.bbox.y1) / 2 / canvas.height) * view.height;
      if (cx >= box.left && cx <= box.left + box.width && cy >= box.top && cy <= box.top + box.height) {
        picked.add(w.id);
      }
    }
    render();
  });
}

function boundsOf(a, b) {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

function renderText(lang) {
  el.textView.replaceChildren();
  if (!lastResult) return;
  // 漢字は1文字ずつルビを振る。選ぶ単位は認識した語のまま
  const perChar = lang.code === 'zh';

  for (const line of lastResult.lines) {
    const p = document.createElement('p');
    line.items.forEach((item, i) => {
      if (i > 0 && !perChar) p.append(' ');
      for (const piece of perChar ? [...item.text] : [item.text]) {
        p.append(...renderWord(lang, item, piece));
      }
    });
    if (p.childNodes.length) el.textView.append(p);
  }
  el.textPanel.hidden = el.textView.childElementCount === 0;
}

/** 1語を、前後の記号と読みに分けて組み立てる */
function renderWord(lang, item, piece) {
  const [, before, core, after] = piece.match(/^([^\p{L}\p{M}\p{N}]*)(.*?)([^\p{L}\p{M}\p{N}]*)$/u);
  const r = core ? readingOf(lang, core) : null;
  const nodes = [];
  if (before) nodes.push(document.createTextNode(before));

  if (!r || !rubyOn(item)) {
    const span = document.createElement('span');
    span.className = picking() ? 'word pickable' : 'word';
    span.textContent = core;
    if (picking()) span.addEventListener('click', () => togglePick(item));
    nodes.push(span);
  } else {
    const ruby = document.createElement('ruby');
    ruby.className = `${r.weak ? 'weak ' : ''}${r.fixedFrom ? 'fixed' : ''}`.trim();
    if (r.fixedFrom) ruby.title = `文字認識の綴りを補正: ${r.fixedFrom} → ${r.source}`;
    ruby.append(core);
    const rt = document.createElement('rt');
    rt.append(...rubyNodes(r));
    ruby.append(rt);
    ruby.addEventListener('click', () => (picking() ? togglePick(item) : speak(core, lang)));
    nodes.push(ruby);
  }

  if (after) nodes.push(document.createTextNode(after));
  return nodes;
}

/** 文字認識の綴りを直した語の数 */
function countFixed(lang) {
  if (!lang.correct || !lastResult) return 0;
  return lastResult.words.filter((w) => readingOf(lang, w.text)?.fixedFrom).length;
}

/** 選んだ言語と中身が食い違うときだけ、切り替えを提案する */
function suggestLanguage(text) {
  const guess = detectLanguage(text);
  if (guess === el.lang.value) return;
  const lang = getLanguage(guess);
  el.hint.replaceChildren(`この文章は${lang.label}のようです。`);
  const btn = document.createElement('button');
  btn.className = 'btn small';
  btn.textContent = `${lang.label}で読み直す`;
  btn.addEventListener('click', () => {
    el.lang.value = guess;
    store.set(STORE_KEY, guess);
    syncStyleOptions();
    el.hint.hidden = true;
    run();
  });
  el.hint.append(btn);
  el.hint.hidden = false;
}

/* ---------------- 読み上げ・コピー ---------------- */

function speak(text, lang) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang.speech;
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

function speakAll() {
  if (!lastResult) return;
  speak(lastResult.text.replace(/\s+/g, ' ').slice(0, 1000), getLanguage(el.lang.value));
}

async function copyReadings() {
  if (!lastResult) return;
  const lang = getLanguage(el.lang.value);
  const join = lang.code === 'zh' ? '' : ' ';
  const out = lastResult.lines
    .map((line) => {
      const shown = line.items.filter((item) => rubyOn(item));
      if (!shown.length) return '';
      const source = shown.map((item) => item.text).join(join);
      const reads = shown
        .map((item) => {
          const r = readingOf(lang, item.text);
          return r ? r.text + r.sign : item.text;
        })
        .join(join);
      return `${source}\n${reads}`;
    })
    .filter(Boolean)
    .join('\n\n');
  try {
    await navigator.clipboard.writeText(out);
    setStatus('読みをコピーしました。');
  } catch {
    setStatus('コピーできませんでした。文章を直接選択してコピーしてください。');
  }
}

/* ---------------- 表示のこまごま ---------------- */

function defaultStatus() {
  return '「カメラで撮る」で紙を撮ると、ここに進み具合が出ます。';
}

function setStatus(msg) {
  el.status.textContent = msg;
}

function setProgress(v) {
  if (v === null) {
    el.progress.hidden = true;
    el.bar.style.width = '0%';
    return;
  }
  el.progress.hidden = false;
  el.bar.style.width = `${Math.round(v * 100)}%`;
}

// 1ファイル版には sw.js が付いてこないので、そのときは登録しない
/* ---------------- 開いているブラウザの事情 ---------------- */

/**
 * アプリ内ブラウザ（LINE など）で開かれているか
 *
 * LINE や各SNSのアプリ内ブラウザは、カメラや写真の選択を
 * 通さないことがある。ここで見分けて、本来のブラウザへ誘導する。
 */
function inAppBrowser() {
  const ua = navigator.userAgent;
  if (/\bLine\//i.test(ua)) return 'LINE';
  if (/FBAN|FBAV/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  return null;
}

/** LINE はこの印を付けたリンクを、端末のブラウザで開いてくれる */
function externalLink(url) {
  return `${url}${url.includes('?') ? '&' : '?'}openExternalBrowser=1`;
}

function warnAboutBrowser() {
  const app = inAppBrowser();
  const url = shareableUrl();
  if (!app || !url) return;

  const text = document.createElement('span');
  text.textContent = `${app}のアプリ内ブラウザで開かれています。この画面ではカメラが使えないことがあります。`;
  el.browserWarning.append(text);

  if (app === 'LINE') {
    const link = document.createElement('a');
    link.className = 'btn small';
    link.href = externalLink(url);
    link.textContent = 'ブラウザで開く';
    el.browserWarning.append(link);
  } else {
    text.textContent += ' 画面のメニューから「ブラウザで開く」を選んでください。';
  }
  el.browserWarning.hidden = false;
}

/* ---------------- 共有 ---------------- */

const SHARE_TITLE = 'ルビカメラ — 外国語の紙に発音ルビをふる';
const SHARE_TEXT = '外国語で書かれた紙をカメラで撮ると、読み方をふりがなで返します。';

/** 人に渡せるURLかどうか。ファイルとして開いた場合は渡せない */
function shareableUrl() {
  if (!['http:', 'https:'].includes(location.protocol)) return null;
  return `${location.origin}${location.pathname}`.replace(/index\.html$/, '');
}

function setUpShare() {
  const url = shareableUrl();
  if (!url) {
    el.shareUrl.hidden = true;
    el.shareActions.hidden = true;
    el.sharePanel.querySelector('h2').textContent = 'この形で受け取った方へ';
    el.shareNote.textContent =
      'このファイル1つでアプリ全体です。'
      + '紙を読み取るときは「カメラで撮る」を使ってください（画面内カメラはファイルからは使えません）。'
      + '初回だけ文字認識の辞書をネットから取得するため、通信できる状態で一度お使いください。'
      + '二回目以降は同じ端末に残ります。'
      + 'ほかの人に渡すときは、このファイルをそのまま送れば同じように使えます。';
    return;
  }

  el.shareUrl.textContent = url;

  // 目の前の相手にはリンクを送るより、画面を向けたほうが速い
  try {
    el.qrCode.replaceChildren(makeQrSvg(url));
    el.qr.hidden = false;
  } catch {
    el.qr.hidden = true;
  }
  // LINE から開いたときにアプリ内ブラウザに閉じ込められないよう、印を付けて渡す
  el.line.href = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(externalLink(url))}&text=${encodeURIComponent(SHARE_TITLE)}`;
  el.share.hidden = !navigator.share;
  el.shareNote.textContent = navigator.share
    ? '「共有する」を押すと、LINE を含む端末の共有メニューが開きます。'
    : 'リンクを送れば、相手はそのまま開いて使えます。インストールは要りません。';

  el.share.addEventListener('click', async () => {
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: externalLink(url) });
    } catch {
      /* 利用者が閉じただけなので何もしない */
    }
  });

  el.copyUrl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(externalLink(url));
      el.shareNote.textContent = 'リンクをコピーしました。LINE に貼り付けて送れます。';
    } catch {
      el.shareNote.textContent = '上のリンクを長押しして選択し、コピーしてください。';
    }
  });
}

/** 受け取った人が最初に開いたとき、ホーム画面への追加を一度だけすすめる */
function suggestInstall() {
  const HIDE_KEY = 'rubycam.installHintDismissed';
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  // アプリ内ブラウザではホーム画面に追加できない。警告と二重に出しても仕方がない
  if (!shareableUrl() || standalone || inAppBrowser() || store.get(HIDE_KEY) === '1') return;

  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const text = document.createElement('span');
  text.textContent = ios
    ? '下の共有ボタン（□に↑）から「ホーム画面に追加」を選ぶと、アプリのように1タップで開けます。'
    : 'ブラウザのメニューから「ホーム画面に追加」を選ぶと、アプリのように1タップで開けます。';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn small ghost';
  close.textContent = '閉じる';
  close.addEventListener('click', () => {
    el.installHint.hidden = true;
    store.set(HIDE_KEY, '1');
  });

  el.installHint.replaceChildren(text, close);
  el.installHint.hidden = false;
}

warnAboutBrowser();
setUpShare();
suggestInstall();
setUpRegionPick();
setStatus(defaultStatus());

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.__RUBYCAM_SINGLE_FILE__) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
