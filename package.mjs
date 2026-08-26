/**
 * 配布用の zip を作る
 *
 * 中身は 1ファイル版 + サーバで動かす完全版一式。
 * どちらの使い方でも、これ1つ渡せば済むようにしている。
 */
import { execFileSync } from 'node:child_process';
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const staging = join(root, 'dist', 'rubycam');
const zip = join(root, 'dist', 'rubycam.zip');

if (!existsSync(join(root, 'dist', 'rubycam.html'))) {
  throw new Error('先に `npm run build` を実行してください');
}

rmSync(staging, { recursive: true, force: true });
rmSync(zip, { force: true });
mkdirSync(staging, { recursive: true });

for (const item of ['index.html', 'sw.js', 'manifest.webmanifest', 'README.md', 'package.json', 'src', 'assets', 'tests']) {
  cpSync(join(root, item), join(staging, item), { recursive: true });
}
cpSync(join(root, 'dist', 'rubycam.html'), join(staging, 'rubycam.html'));

execFileSync('zip', ['-qr', zip, 'rubycam'], { cwd: join(root, 'dist') });
rmSync(staging, { recursive: true, force: true });
console.log(`dist/rubycam.zip を作りました`);
