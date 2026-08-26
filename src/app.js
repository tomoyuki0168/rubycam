/** 画面まわり — 撮影、文字認識、ルビの生成と表示 */
import { LANGUAGES, getLanguage, detectLanguage, tokenize } from './lang/index.js';
import { recognize } from './ocr.js';
import { enhance } from './enhance.js';

const $ = (id) => document.getElementById(id);
const el = {
  stage: $('stage'), preview: $('preview'), shot: $('shot'), overlay: $('overlay'),
  liveControls: $('live-controls'),
  camera: $('btn-camera'), shutter: $('btn-shutter'), retake: $('btn-retake'),
  fileCamera: $('file-camera'), fileAlbum: $('file-album'),
  lang: $('lang'), style: $('style'), toggleOverlay: $('toggle-overlay'),
  toggleEnhance: $('toggle-enhance'),
  dialectField: $('dialect-field'), dialect: $('dialect'),
  toneLegend: $('tone-legend'),
  status: $('status'), progress: $('progress'), bar: $('progress-bar'), hint: $('hint'),
  textPanel: $('text-panel'), textView: $('text-view'),
  speak: $('btn-speak'), copy: $('btn-copy'),
  sharePanel: $('share-panel'), shareUrl: $('share-url'), shareActions: $('share-actions'),
  share: $('btn-share'), line: $('btn-line'), copyUrl: $('btn-copy-url'), shareNote: $('share-note'),
};

const MAX_EDGE = 1600;
const STORE_KEY = 'rubycam.lang';
const DIALECT_KEY = 'rubycam.dialect';

let stream = null;
let canvas = null;
let lastResult = null;
let busy = false;

/* ---------------- 初期化 ---------------- */

LANGUAGES.forEach((l) => {
  const o = document.createElement('option');
  o.value = l.code;
  o.textContent = l.label;
  el.lang.append(o);
});
el.lang.value = localStorage.getItem(STORE_KEY) ?? 'en';
syncStyleOptions();

el.lang.addEventListener('change', () => {
  localStorage.setItem(STORE_KEY, el.lang.value);
  syncStyleOptions();
  if (lastResult) render();
});
el.style.addEventListener('change', () => lastResult && render());
el.toggleOverlay.addEventListener('change', () => lastResult && render());
el.dialect.addEventListener('change', () => {
  localStorage.setItem(DIALECT_KEY, el.dialect.value);
  if (lastResult) render();
});

el.camera.addEventListener('click', startCamera);
el.shutter.addEventListener('click', shoot);
el.retake.addEventListener('click', reset);
el.fileCamera.addEventListener('change', onFile);
el.fileAlbum.addEventListener('change', onFile);

// https 以外で開くとブラウザがカメラを渡さない。その場合は
// 「カメラで撮る」（端末の標準カメラを呼ぶ経路）だけを残す
const liveCameraAvailable = Boolean(navigator.mediaDevices?.getUserMedia);
if (!liveCameraAvailable) {
  el.liveControls.hidden = true;
  setStatus(defaultStatus());
}
el.speak.addEventListener('click', speakAll);
el.copy.addEventListener('click', copyReadings);

/** 選んだ言語に関係のない設定は出さない */
function syncStyleOptions() {
  const lang = getLanguage(el.lang.value);
  const supportsRoman = ['ko', 'ru', 'el', 'zh'].includes(lang.code);
  el.style.disabled = !supportsRoman;
  if (!supportsRoman) el.style.value = 'kana';
  if (lang.code === 'zh') el.style.value = el.style.value === 'kana' ? 'kana' : 'roman';

  // 発音が地域で大きく分かれる言語だけ、選べるようにする
  el.dialectField.hidden = !lang.dialects;
  if (lang.dialects) {
    const saved = localStorage.getItem(DIALECT_KEY);
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
  if (!liveCameraAvailable) {
    setStatus('この開き方では画面内カメラが使えません。「カメラで撮る」をお使いください。');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
      audio: false,
    });
    el.preview.srcObject = stream;
    await el.preview.play();
    el.stage.classList.add('live');
    el.stage.classList.remove('shot');
    el.shutter.disabled = false;
    setStatus('紙が画面いっぱいに入るように構えて、撮影してください。');
  } catch (e) {
    setStatus(`カメラを起動できませんでした（${e.name}）。「写真を選ぶ」からでも使えます。`);
  }
}

function stopCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  el.stage.classList.remove('live');
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
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  el.shot.src = canvas.toDataURL('image/jpeg', 0.92);
  el.stage.classList.add('shot');
  el.retake.hidden = false;
  el.shutter.disabled = true;
}

function reset() {
  lastResult = null;
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

  for (const w of lastResult.words) {
    if (!w.bbox) continue;
    const r = readingOf(lang, w.text);
    if (!r) continue;
    const { x0, y0, x1, y1 } = w.bbox;
    const box = document.createElement('div');
    const nearTop = y0 / H < 0.09;
    box.className = `w${r.weak ? ' weak' : ''}${nearTop ? ' below' : ''}${r.fixedFrom ? ' fixed' : ''}`;
    box.style.left = `${(x0 / W) * 100}%`;
    box.style.top = `${(y0 / H) * 100}%`;
    box.style.width = `${((x1 - x0) / W) * 100}%`;
    box.style.height = `${((y1 - y0) / H) * 100}%`;
    const rt = document.createElement('b');
    rt.append(...rubyNodes(r));
    // 文字の高さに合わせる。cqw なので写真を縮めてもルビの比率は崩れない。
    // 語の幅よりルビが長くなりすぎると隣とぶつかるので、幅でも頭を押さえる
    const byHeight = ((y1 - y0) / W) * 100 * 0.62;
    const byWidth = (((x1 - x0) / W) * 100 * 1.7) / Math.max(1, (r.text.length + r.sign.length) * 0.62);
    rt.style.fontSize = `${Math.max(1.5, Math.min(byHeight, byWidth))}cqw`;
    box.append(rt);
    box.title = r.fixedFrom ? `${r.fixedFrom} → ${r.source}` : w.text;
    box.addEventListener('click', () => speak(w.text, lang));
    el.overlay.append(box);
  }
}

function renderText(lang) {
  el.textView.replaceChildren();
  if (!lastResult) return;
  const lines = lastResult.lines.length
    ? lastResult.lines.map((l) => l.text)
    : lastResult.text.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    const p = document.createElement('p');
    for (const token of tokenize(line, lang.code)) {
      if (!token.isWord) {
        p.append(token.text);
        continue;
      }
      const r = readingOf(lang, token.text);
      if (!r) {
        p.append(token.text);
        continue;
      }
      const ruby = document.createElement('ruby');
      ruby.className = `${r.weak ? 'weak ' : ''}${r.fixedFrom ? 'fixed' : ''}`.trim();
      if (r.fixedFrom) ruby.title = `文字認識の綴りを補正: ${r.fixedFrom} → ${r.source}`;
      ruby.append(token.text);
      const rt = document.createElement('rt');
      rt.append(...rubyNodes(r));
      ruby.append(rt);
      ruby.addEventListener('click', () => speak(token.text, lang));
      p.append(ruby);
    }
    el.textView.append(p);
  }
  el.textPanel.hidden = el.textView.childElementCount === 0;
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
    localStorage.setItem(STORE_KEY, guess);
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
  const out = (lastResult.lines.length ? lastResult.lines.map((l) => l.text) : lastResult.text.split('\n'))
    .filter((l) => l.trim())
    .map((line) => {
      const reads = tokenize(line, lang.code)
        .filter((t) => t.isWord)
        .map((t) => {
          const r = readingOf(lang, t.text);
          return r ? r.text + r.sign : t.text;
        })
        .join(lang.code === 'zh' ? '' : ' ');
      return `${line}\n${reads}`;
    })
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
  return liveCameraAvailable
    ? '写真を用意すると、ここに進み具合が出ます。'
    : '「カメラで撮る」で紙を撮ると、ここに進み具合が出ます。';
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
    el.shareNote.textContent =
      'このファイルは保存して開いているため、リンクとしては送れません。'
      + '相手にも使ってもらうには、公開したURLから開いてください。';
    return;
  }

  el.shareUrl.textContent = url;
  el.line.href = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}&text=${encodeURIComponent(SHARE_TITLE)}`;
  el.share.hidden = !navigator.share;
  el.shareNote.textContent = navigator.share
    ? '「共有する」を押すと、LINE を含む端末の共有メニューが開きます。'
    : 'リンクを送れば、相手はそのまま開いて使えます。インストールは要りません。';

  el.share.addEventListener('click', async () => {
    try {
      await navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url });
    } catch {
      /* 利用者が閉じただけなので何もしない */
    }
  });

  el.copyUrl.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      el.shareNote.textContent = 'リンクをコピーしました。LINE に貼り付けて送れます。';
    } catch {
      el.shareNote.textContent = '上のリンクを長押しして選択し、コピーしてください。';
    }
  });
}

setUpShare();

if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.__RUBYCAM_SINGLE_FILE__) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
