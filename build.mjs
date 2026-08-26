/**
 * 配布用の1ファイル版を作る
 *
 * src/ 以下をまとめて index.html に埋め込み、dist/rubycam.html を書き出す。
 * 保存してダブルクリックで開ける形にするため、ES モジュールではなく
 * 素の <script> にまとめている（file:// ではモジュールが読めないため）。
 */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const p = (...s) => join(root, ...s);

const result = await build({
  entryPoints: [p('src/app.js')],
  bundle: true,
  format: 'iife',
  target: ['es2022'],
  charset: 'utf8',
  write: false,
  // 中国語のピンイン辞書は実行時に取りに行くので、まとめずそのまま残す
  external: ['https://*'],
});

const js = result.outputFiles[0].text;
const css = await readFile(p('assets/styles.css'), 'utf8');
const icon = await readFile(p('assets/icon.svg'), 'utf8');
const iconData = `data:image/svg+xml,${encodeURIComponent(icon)}`;
const png192 = await readFile(p('assets/icon-192.png'));
const pngData = `data:image/png;base64,${png192.toString('base64')}`;

let html = await readFile(p('index.html'), 'utf8');
html = html
  // 1ファイル版は URL を持たないので、共有カードの参照は相対のままにする
  .replaceAll('__SITE_URL__', '')
  .replace('<link rel="manifest" href="manifest.webmanifest">\n', '')
  .replace('href="assets/icon.svg"', `href="${iconData}"`)
  .replace('href="assets/icon-192.png"', `href="${pngData}"`)
  .replace(
    '<link rel="stylesheet" href="assets/styles.css">',
    `<style>\n${css}\n</style>`,
  )
  .replace(
    '<script type="module" src="src/app.js"></script>',
    `<script>window.__RUBYCAM_SINGLE_FILE__ = true;</script>\n<script>\n${js}\n</script>`,
  );

await mkdir(p('dist'), { recursive: true });
await writeFile(p('dist/rubycam.html'), html);
console.log(`dist/rubycam.html を書き出しました（${(html.length / 1024).toFixed(0)} KB）`);
