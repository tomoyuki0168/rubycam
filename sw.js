/* 自前のファイルだけを先読みしておく最小の Service Worker */
const CACHE = 'rubycam-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './assets/styles.css', './assets/icon.svg', './assets/icon-192.png', './assets/icon-512.png',
  './src/app.js', './src/ocr.js', './src/kana.js',
  './src/lang/index.js', './src/lang/rules.js', './src/lang/en.js', './src/lang/en-dict.js',
  './src/lang/ko.js', './src/lang/zh.js', './src/lang/vi.js', './src/lang/ru.js',
  './src/lang/el.js', './src/lang/de.js', './src/lang/fr.js', './src/lang/romance.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // CDN は素通し
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request)));
});
