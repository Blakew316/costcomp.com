// The home-screen app icons, drawn from the site's own logo (public/wp-logo-clean.png): the bars over the wordmark, on white.
//
//   npm i --no-save playwright && node tools/make-icons.mjs
//
// writes public/apple-touch-icon.png (iPhone and iPad), icon-192.png and icon-512.png, and icon-maskable-512.png (Android,
// which crops icons to its own shapes, so the logo sits smaller in it). Set CHROMIUM to use an installed Chromium.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OUT = process.argv[2] || PUB;
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(PUB, 'wp-logo-clean.png')).toString('base64');
// wp-logo-clean.png is 673x168: the bars are x 0-112, the wordmark x 130-673
const MARK = [0, 113], WORD = [130, 673], LH = 168, LW = 673;
const html = (S, content) => {
  const markH = S * 0.40 * content, wordW = S * 0.80 * content;
  const ms = markH / LH, ws = wordW / (WORD[1] - WORD[0]);
  const gap = S * 0.07 * content;
  const top = (S - (markH + gap + LH * ws)) / 2;
  return `<html><body style="margin:0;background:#fff;width:${S}px;height:${S}px;position:relative;overflow:hidden">
    <div style="position:absolute;left:${(S - (MARK[1] - MARK[0]) * ms) / 2}px;top:${top}px;width:${(MARK[1] - MARK[0]) * ms}px;height:${markH}px;overflow:hidden">
      <img src="${logo}" style="position:absolute;left:${-MARK[0] * ms}px;top:0;width:${LW * ms}px;height:${LH * ms}px"></div>
    <div style="position:absolute;left:${(S - wordW) / 2}px;top:${top + markH + gap}px;width:${wordW}px;height:${LH * ws}px;overflow:hidden">
      <img src="${logo}" style="position:absolute;left:${-WORD[0] * ws}px;top:0;width:${LW * ws}px;height:${LH * ws}px"></div>
  </body></html>`;
};
const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const [name, S, content] of [['apple-touch-icon.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable-512.png', 512, 0.72]]) {
  const p = await b.newPage({ viewport: { width: S, height: S }, deviceScaleFactor: 1 });
  await p.setContent(html(S, content));
  await p.waitForTimeout(200);
  await p.screenshot({ path: path.join(OUT, name) });   // opaque: iOS turns a transparent icon background black
  await p.close();
}
await b.close();
console.log('icons written to', OUT);
