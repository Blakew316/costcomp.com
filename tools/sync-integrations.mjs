// Copies the Integration Atlas (github.com/Blakew316/Integrations) into the Integrations tab.
//
//   node tools/sync-integrations.mjs [path to an Integrations checkout]   (default: ../integrations)
//
// The Atlas is one page (index.html) with its directory and flyer logo embedded. This writes:
//   public/assets/integrations/atlas.css   its stylesheet, every rule scoped to the tab (#atlas); its light and dark
//                                          themes follow the cost comparison's switch (body.dark)
//   public/assets/integrations/atlas.js    its page and script: the markup goes into #atlas, the script runs in a
//                                          function of its own, its element ids carry an at- prefix, and the changes
//                                          listed in PATCHES fit it into the site (see each one's note)
// and stamps the ?v= of the two files in public/index.html with a hash of each file's content. Its install-as-an-app
// layer (manifest, service worker, icons) isn't copied: the cost comparison is the app. Each patch is an exact piece of
// the Atlas's code, so a change upstream that moves one fails here instead of being skipped.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { STAMPED, stamp } from './cost-comp-css.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const SRC = path.resolve(process.argv[2] || path.join(ROOT, '..', 'integrations'));
const OUT = path.join(PUB, 'assets/integrations');
const page = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { cwd: SRC }).toString().trim(); } catch (e) {}

const one = (re, what) => { const m = re.exec(page); if (!m) throw new Error(what + ' not found in the Atlas page'); return m[1]; };
const css = one(/<style>([\s\S]*?)<\/style>/, 'its <style>');
let markup = one(/<body>([\s\S]*?)<script>/, 'its page');
let script = one(/<script>([\s\S]*?)<\/script>\s*<\/body>/, 'its script');

// ─── the stylesheet, scoped to #atlas ───
function splitTop(s, sep) {   // split on sep outside brackets and quotes
  const out = []; let depth = 0, q = null, cur = '';
  for (const ch of s) {
    if (q) { if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === sep && !depth) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur); return out;
}
const DARK = ':root[data-theme="dark"]';
function scopeSel(sel) {
  const s = sel.trim().replace(/\s+/g, ' ');
  if (s === ':root' || s === 'html' || s === 'body') return '#atlas';
  if (s === DARK) return 'body.dark #atlas';
  if (s.startsWith(DARK + ' ')) return 'body.dark #atlas ' + s.slice(DARK.length + 1);
  if (/^(:root|html|body)\b/.test(s)) throw new Error('unexpected page-level selector: ' + s);
  return '#atlas ' + s;
}
function scope(block) {   // a list of rules and at-rules
  let out = '', i = 0;
  while (i < block.length) {
    const open = block.indexOf('{', i);
    if (open < 0) { if (block.slice(i).trim()) throw new Error('stray CSS: ' + block.slice(i).trim().slice(0, 60)); break; }
    const prelude = block.slice(i, open).trim();
    let depth = 1, j = open + 1;
    for (; j < block.length && depth; j++) { if (block[j] === '{') depth++; else if (block[j] === '}') depth--; }
    const body = block.slice(open + 1, j - 1);
    i = j;
    if (prelude.startsWith('@media')) {
      // the page's own dark theme follows the phone's setting; here the cost comparison's switch sets it (the
      // :root[data-theme="dark"] rules, scoped to body.dark above), so the rules keyed to the phone's setting stay out
      if (/prefers-color-scheme\s*:\s*dark/.test(prelude)) continue;
      out += prelude + '{\n' + scope(body) + '}\n';
    } else if (prelude.startsWith('@')) {
      throw new Error('an at-rule the scoper doesn’t handle: ' + prelude);
    } else {
      out += splitTop(prelude, ',').map(scopeSel).join(',') + '{' + body.trim() + '}\n';
    }
  }
  return out;
}
const scoped = scope(css.replace(/\/\*[\s\S]*?\*\//g, ''));

// ─── the page ───
const ids = [...markup.matchAll(/\bid="([\w-]+)"/g)].map(m => m[1]);
markup = markup
  .replace(/\bid="([\w-]+)"/g, 'id="at-$1"')
  .replace(/aria-labelledby="([\w-]+)"/g, 'aria-labelledby="at-$1"')
  .replace(/<main\b/g, '<div').replace(/<\/main>/g, '</div>')
  .trim();

// ─── the script ───
const PATCHES = [
  ['element ids: the page’s carry an at- prefix, so they can’t collide with the rest of the site',
    'const $ = id => document.getElementById(id);', "const $ = id => document.getElementById('at-' + id);"],
  ['the message box: looked up and created with the prefix too',
    "let el=document.getElementById('toast');", "let el=$('toast');"],
  ['the message box id', "el.id='toast';", "el.id='at-toast';"],
  ['the category pills’ sync function: kept inside the Atlas’s own scope instead of on window',
    '/* ---------- category pills ---------- */', 'let syncCats;\n/* ---------- category pills ---------- */'],
  ['(the same)', 'window.syncCats = function(){', 'syncCats = function(){'],
  ['the flyer builder isn’t put on window', 'window.buildFlyerPDF = buildFlyerPDF;\n', ''],
  ['“/” jumps to the search box only on the Integrations tab, and never while the rep is typing in a field',
    "if(e.key==='/' && document.activeElement !== $('q')){",
    "if(e.key==='/' && atlasShown() && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||'') && document.activeElement !== $('q')){"],
  ['the flyer’s merchant and account executive start from the analysis when the rep hasn’t typed them here',
    'function openSheet(d){\n  lastFocus = document.activeElement;', 'function openSheet(d){\n  lastFocus = document.activeElement;\n  fromAnalysis();'],
  ['speed: each brand’s card is built once and kept, so a search or filter only reorders cards that already exist instead of rebuilding up to 624 of them on every keystroke (a card shows only its brand’s fixed data)',
    '  items.forEach(d=>{\n    const el = document.createElement(\'button\');',
    '  items.forEach(d=>{\n    let el = cardCache.get(d);\n    if(el){ frag.appendChild(el); return; }\n    el = document.createElement(\'button\');'],
  ['(the same: keep the card)', '    frag.appendChild(el);\n  });\n  grid.replaceChildren(frag);',
    '    cardCache.set(d, el);\n    frag.appendChild(el);\n  });\n  grid.replaceChildren(frag);'],
  ['(the same: where the cards are kept)', 'function render(){', 'const cardCache = new Map();\nfunction render(){'],
  ['no service worker of its own: the cost comparison’s covers the whole site', null, null, s => {
    const a = s.indexOf('/* ---------- PWA service worker ---------- */');
    if (a < 0) throw new Error('service worker block not found');
    return s.slice(0, a).trimEnd() + '\n';
  }],
];
const lines = script.split('\n');
// the directory and the flyer's logo are single long lines of data: patches and the id prefix leave them alone
const isData = l => /^const (DATA|WPI_LOGO_B64)\s*=/.test(l);
let code = lines.map(l => isData(l) ? l : l.replace(/\bid="([A-Za-z]\w*)"/g, 'id="at-$1"')).join('\n');
for (const [what, from, to, fn] of PATCHES) {
  if (fn) { code = fn(code); continue; }
  const n = code.split(from).length - 1;
  if (n !== 1) throw new Error('patch “' + what + '”: expected its code once, found it ' + n + ' times');
  code = code.replace(from, () => to);
}
const brands = JSON.parse(one(/^const DATA = \/\*[^*]*\*\/(\[.*\]);\s*$/m, 'the directory'));

const js = `/* Integration Atlas from github.com/Blakew316/Integrations @ ${commit}, copied into the Integrations tab by tools/sync-integrations.mjs. Do not edit; re-run the tool. */
(function () {
var root = document.getElementById('atlas');
if (!root || root.hasAttribute('data-ready')) return;
root.setAttribute('data-ready', '');
root.innerHTML = ${JSON.stringify(markup)};
function atlasShown() { var t = document.getElementById('tab-integrations'); return !t || t.classList.contains('active'); }
// the analysis's merchant and account executive (the cost comparison's data, D), for the flyer
function fromAnalysis() {
  if (typeof D === 'undefined' || !D) return;
  if (!merchantName && D.merchantName) merchantName = String(D.merchantName);
  if (!ae.name && D.accountExec) ae.name = String(D.accountExec);
}
${code}
// on a phone the open brand sheet follows a finger swiping it back to the right, and closes past 80px, as iOS sheets do
(function () {
  var sx = 0, sy = 0, dx = 0, drag = false;
  sheet.addEventListener('touchstart', function (e) {
    drag = sheet.classList.contains('open') ? null : false; sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0;
  }, { passive: true });
  sheet.addEventListener('touchmove', function (e) {
    if (drag === false) return;
    var x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
    if (drag === null) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return;
      drag = x > 0 && Math.abs(x) > Math.abs(y);
      if (!drag) return;
      sheet.style.transition = 'none';
    }
    dx = Math.max(0, x); sheet.style.transform = 'translateX(' + dx + 'px)';
  }, { passive: true });
  function release() {
    if (!drag) { drag = false; return; }
    drag = false; sheet.style.transition = ''; sheet.style.transform = '';
    if (dx > 80) closeSheet();
  }
  sheet.addEventListener('touchend', release);
  sheet.addEventListener('touchcancel', release);
})();
// leaving the tab closes an open brand sheet (it holds the page still while it's open)
var tab = document.getElementById('tab-integrations');
if (tab) new MutationObserver(function () { if (!tab.classList.contains('active') && sheet.classList.contains('open')) closeSheet(); })
  .observe(tab, { attributes: true, attributeFilter: ['class'] });
})();
`;

const integration = `
/* ─── In the cost comparison's Integrations tab ─── */
/* edge to edge under the site's header, like the Equipment tab (undoes .main's padding), with the page's own type */
#atlas{margin:-1.5rem -1.5rem 0;line-height:normal;letter-spacing:normal}
@media(max-width:900px){#atlas{margin:-1rem -1rem 0}}
@media(max-width:600px){#atlas{margin:-0.75rem -0.75rem 0}}
@media(max-height:500px) and (orientation:landscape){#atlas{margin:-0.5rem -0.5rem 0}}
/* the site's header already carries the Wholesale Payments logo */
#atlas .top{display:none}
/* paragraphs keep the browser's spacing the page was designed with (the site's reset takes it away) */
#atlas :where(p){margin:1em 0}
/* its brand sheet and messages sit above the site's header and the app's tab bar */
#atlas .overlay{z-index:1040}
#atlas .sheet{z-index:1041;overscroll-behavior:contain}
/* closed, the sheet is off the page: without its shadow (which fell across the right edge of the page) and hidden, so it's
   out of the tab order too; it hides once it has slid out */
#atlas .sheet:not(.open){box-shadow:none;visibility:hidden;transition:transform .32s cubic-bezier(.32,.72,.28,1),visibility 0s .32s}
/* a long category name stops short of the close button */
#atlas .sheet-head .cat-label{padding-right:44px}
#at-toast{z-index:1050!important}
/* on a phone: the brands run down the page with it rather than scrolling in a box of their own, the title is tighter
   (the site's header is above it), and the search and filters scroll away with the page instead of holding a fifth of
   the screen (tapping the tab again goes back to the top) */
@media(max-width:720px){
  #atlas .grid{max-height:none;overflow:visible;padding:4px 0 28px}
  #atlas .hero{padding:26px 0 4px}
  #atlas .hero h1{font-size:42px}
  #atlas .hero .sub{margin-top:12px;font-size:16px}
  #atlas .toolbar{position:static;margin-top:14px}
}
/* touch: the share button on each card is a full-size place to tap */
@media(pointer:coarse){#atlas .share-btn{width:36px;height:36px}#atlas .share-btn svg{width:17px;height:17px}}
/* the home-screen app: the toolbar sticks just under the status bar's strip (index.html, --sb), the sheet clears the
   status bar and the home bar, and messages sit above the tab bar */
html.pwa #atlas .toolbar{top:var(--sb)}
html.pwa #atlas .sheet-head{padding-top:calc(30px + var(--sb))}
html.pwa #atlas .sheet-close{top:calc(20px + var(--sb))}
html.pwa #atlas .sheet-cta{padding-bottom:calc(30px + env(safe-area-inset-bottom))}
@media(max-width:900px),(max-height:500px){html.pwa #at-toast{bottom:calc(var(--tabbar-h, 56px) + env(safe-area-inset-bottom) + 12px)!important}}
/* speed: a card off the screen isn't laid out or painted until it scrolls near (624 of them made the tab take a second
   and a half to show on a phone, and each search keystroke nearly as long); 190px holds its place until then */
#atlas .item{content-visibility:auto;contain-intrinsic-size:auto 190px}
/* waiting for the directory, if the tab is opened before it has loaded in the background */
#atlas .atlas-wait{padding:18vh 20px;text-align:center;color:var(--slate);font-size:15px}
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'atlas.js'), js);
fs.writeFileSync(path.join(OUT, 'atlas.css'),
  `/* Integration Atlas styles from github.com/Blakew316/Integrations @ ${commit}, scoped to the Integrations tab (#atlas) by tools/sync-integrations.mjs. Do not edit; re-run the tool. */\n` +
  scoped + integration);

// stamp index.html with each file's content hash
const INDEX = path.join(PUB, 'index.html');
let idx = fs.readFileSync(INDEX, 'utf8');
for (const f of STAMPED.filter(f => f.startsWith('assets/integrations/'))) {
  const re = new RegExp(f.replace(/[.\/]/g, '\\$&') + '\\?v=[\\w.-]+', 'g');
  if (!re.test(idx)) throw new Error('index.html doesn’t load ' + f);
  idx = idx.replace(re, f + '?v=' + stamp(PUB, f));
}
fs.writeFileSync(INDEX, idx);
console.log('Integration Atlas synced from', SRC, '@', commit, '·', brands.length, 'brands ·', ids.length, 'ids prefixed ·',
  STAMPED.filter(f => f.startsWith('assets/integrations/')).map(f => path.basename(f) + '?v=' + stamp(PUB, f)).join(', '));
