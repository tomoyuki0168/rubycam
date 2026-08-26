/*
 * 自前のファイルをキャッシュして、二回目以降を速くする Service Worker
 *
 * 取り方は「まずネット、駄目ならキャッシュ」。
 * キャッシュを先に返すと、直した不具合がいつまでも利用者に届かない。
 * 通信できないときだけキャッシュに落とすことで、更新の確実さと
 * オフラインでの動作を両立させる。
 */
const CACHE = 'rubycam-v5';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './assets/styles.css', './assets/icon.svg',
  './assets/icon-192.png', './assets/icon-512.png', './assets/og.png',
  './src/app.js', './src/ocr.js', './src/kana.js', './src/enhance.js',
  './src/qr.js', './src/vendor/qrcode.mjs',
  './src/lang/index.js', './src/lang/rules.js', './src/lang/en.js', './src/lang/en-dict.js',
  './src/lang/ko.js', './src/lang/zh.js', './src/lang/vi.js', './src/lang/ru.js',
  './src/lang/el.js', './src/lang/de.js', './src/lang/fr.js', './src/lang/romance.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // 1つでも取れないと全部が失敗するので、個別に入れる
      .then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== 'GET') return; // CDN は素通し

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit ?? Promise.reject(new Error('offline')))),
  );
});
