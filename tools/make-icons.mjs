// The home-screen app icons: the bars from the site's logo (public/wp-logo-clean.png) over "WPI" (bold, in the logo's navy)
// and "Cost Comp" (light, in its gray), centered, on white.
//
//   npm i --no-save playwright @fontsource/montserrat && node tools/make-icons.mjs
//
// writes public/apple-touch-icon.png (iPhone and iPad), icon-192.png and icon-512.png, and icon-maskable-512.png (Android,
// which crops icons to its own shapes, so the logo sits smaller in it). Montserrat is the logo's typeface; set
// MONTSERRAT_DIR to a folder with its woff2 files instead of installing it, and CHROMIUM to use an installed Chromium.
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const OUT = process.argv[2] || PUB;
const LINE1 = 'WPI', LINE2 = 'Cost Comp';
const fontDir = process.env.MONTSERRAT_DIR ||
  path.join(path.dirname(createRequire(import.meta.url).resolve('@fontsource/montserrat/package.json')), 'files');
const font = w => 'data:font/woff2;base64,' + fs.readFileSync(path.join(fontDir, `montserrat-latin-${w}-normal.woff2`)).toString('base64');
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(PUB, 'wp-logo-clean.png')).toString('base64');

// drawn on a canvas in the page: wp-logo-clean.png is 673x168 with the bars at x 0-112 and the wordmark at x 130-673
// ("wholesale" in the top half, "payments" in the bottom half), which also give the two colours
function draw({ S, content, logo, bold, light, LINE1, LINE2 }) {
  return (async () => {
    for (const [w, src] of [[700, bold], [300, light]]) { const f = new FontFace('Logo', `url(${src})`, { weight: String(w) }); await f.load(); document.fonts.add(f); }
    const img = new Image(); img.src = logo; await img.decode();
    const c = document.createElement('canvas'); c.width = S; c.height = S;
    const g = c.getContext('2d');
    // the logo's navy and gray: the average of the wordmark's solid pixels in each half
    const src = document.createElement('canvas'); src.width = img.width; src.height = img.height;
    const sg = src.getContext('2d'); sg.drawImage(img, 0, 0);
    const avg = (y0, y1) => {
      const d = sg.getImageData(130, y0, img.width - 130, y1 - y0).data; let r = 0, gg = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 250 && d[i] + d[i + 1] + d[i + 2] < 600) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
      return `rgb(${Math.round(r / n)},${Math.round(gg / n)},${Math.round(b / n)})`;
    };
    const NAVY = avg(0, 84), GRAY = avg(100, 168);
    g.fillStyle = '#fff'; g.fillRect(0, 0, S, S);   // opaque: iOS turns a transparent icon background black
    // the bars 40% of the icon tall, as on the first icon, and 7% of it between them and the words
    const markH = S * 0.40 * content, markW = 113 * markH / 168, gap = S * 0.07 * content;
    const box = (text, size, weight) => { g.font = `${weight} ${size}px Logo`; const m = g.measureText(text);
      return { l: m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight, a: m.actualBoundingBoxAscent, d: m.actualBoundingBoxDescent }; };
    // "Cost Comp" is 77% of the icon wide and "WPI" 1.54 times its size above it, both centered
    let m2 = box(LINE2, 100, 300); const f2 = 100 * S * 0.77 * content / (m2.l + m2.r); m2 = box(LINE2, f2, 300);
    const f1 = f2 * 1.54, m1 = box(LINE1, f1, 700), lead = f1 * 0.14;
    const textH = m1.a + m1.d + lead + m2.a + m2.d, top = (S - (markH + gap + textH)) / 2;
    const left = m => (S - (m.l + m.r)) / 2 + m.l;
    g.drawImage(img, 0, 0, 113, 168, (S - markW) / 2, top, markW, markH);
    const base1 = top + markH + gap + m1.a, base2 = base1 + m1.d + lead + m2.a;
    g.font = `700 ${f1}px Logo`; g.fillStyle = NAVY; g.fillText(LINE1, left(m1), base1);
    g.font = `300 ${f2}px Logo`; g.fillStyle = GRAY; g.fillText(LINE2, left(m2), base2);
    return c.toDataURL('image/png').split(',')[1];
  })();
}

const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const p = await b.newPage();
for (const [name, S, content] of [['apple-touch-icon.png', 180, 1], ['icon-192.png', 192, 1], ['icon-512.png', 512, 1], ['icon-maskable-512.png', 512, 0.72]]) {
  const png = await p.evaluate(draw, { S, content, logo, bold: font(700), light: font(300), LINE1, LINE2 });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(png, 'base64'));
}
await b.close();
console.log('icons written to', OUT);
