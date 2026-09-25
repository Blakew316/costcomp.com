// Copies the WPI Assist rep equipment app (github.com/Blakew316/repequipment) into the Equipment tab.
//
//   node tools/sync-equipment.mjs [path to a repequipment checkout]   (default: ../repequipment)
//
// What it writes:
//   public/assets/{img,flyers,guides,basil}/  the app's images, flyers, guides and forms, as they are
//   public/assets/js/data.js                  as it is
//   public/assets/js/app.js                   the app, with the integration changes listed in PATCHES
//   public/assets/css/equipment.css           the app's stylesheet, scoped to the Equipment tab so its look
//                                             is kept exactly and the cost comparison's styles can't reach it
// and points the ?v= of those three files in public/index.html at the repequipment commit.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REP = path.resolve(process.argv[2] || path.join(ROOT, '..', 'repequipment'));
const PUB = path.join(ROOT, 'public');
const read = f => fs.readFileSync(f, 'utf8');
if (!fs.existsSync(path.join(REP, 'assets/js/app.js'))) throw new Error('Not a repequipment checkout: ' + REP);
let commit = 'local';
try { commit = execSync('git -C "' + REP + '" rev-parse --short HEAD').toString().trim(); } catch (e) { /* not a git checkout */ }

// ─── 1. assets, as they are ───
for (const dir of ['img', 'flyers', 'guides', 'basil']) {
  const dst = path.join(PUB, 'assets', dir);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(path.join(REP, 'assets', dir), dst, { recursive: true });
}
fs.mkdirSync(path.join(PUB, 'assets/js'), { recursive: true });
fs.mkdirSync(path.join(PUB, 'assets/css'), { recursive: true });
fs.copyFileSync(path.join(REP, 'assets/js/data.js'), path.join(PUB, 'assets/js/data.js'));

// ─── 2. app.js, with the changes that let it live inside the cost comparison ───
// The cost comparison supplies the page, its header, light/dark switch, install prompt and service worker, so the
// app's own versions of those are switched off. Pop-ups go into #raLayer so they keep the app's styles.
const PATCHES = [
  ['helpers: the Equipment tab containers',
    `  const $ = (s, r=document) => r.querySelector(s);`,
    `  const $ = (s, r=document) => r.querySelector(s);
  /* cost comp: the app lives in #raMain (the Equipment tab) and its pop-ups in #raLayer */
  const raLayer = () => document.getElementById("raLayer") || document.body;
  const raRoots = () => ["raMain", "raLayer"].map(id => document.getElementById(id)).filter(Boolean);`],
  ['theme: follow the cost comparison’s light/dark switch (body.dark) instead of the app’s own', null, null, src => {
    const a = src.indexOf('  /* ------------------------------ theme ------------------------------ */');
    const b = src.indexOf('  /* ------------------------------ toast ------------------------------ */');
    if (a < 0 || b < a) throw new Error('theme block not found');
    return src.slice(0, a) + `  /* ------------------------------ theme ------------------------------ */
  /* cost comp: light and dark follow the cost comparison's own switch (body.dark), so the app's theme code is off */
  function toggleTheme(){}

` + src.slice(b);
  }],
  ['header actions: the theme button is the cost comparison’s',
    `    const tb = e.target.closest("#themeBtn"); if (tb){ toggleTheme(); }\n`, ''],
  ['header height: set on the Equipment tab, where the app’s variables live',
    `    document.documentElement.style.setProperty("--hdr-h", Math.round(h.getBoundingClientRect().height) + "px");`,
    `    raRoots().forEach(r => r.style.setProperty("--hdr-h", Math.round(h.getBoundingClientRect().height) + "px"));`],
  ['install prompt: the cost comparison has its own', null, null, src => {
    const a = src.indexOf('  /* ------------------------------ PWA ------------------------------ */');
    const b = src.indexOf('  function registerSW(){');
    if (a < 0 || b < a) throw new Error('PWA block not found');
    return src.slice(0, a) + `  /* ------------------------------ PWA ------------------------------ */
  /* cost comp: installing and offline caching belong to the cost comparison */
` + src.slice(b);
  }],
  ['service worker: the cost comparison’s', null, null, src => src.replace(
    /  function registerSW\(\)\{\n    if \("serviceWorker" in navigator\)\{\n      window\.addEventListener\("load", \(\)=>\{ navigator\.serviceWorker\.register\("sw\.js"\)\.catch\(\(\)=>\{\}\); \}\);\n    \}\n  \}/,
    () => '  function registerSW(){}', 1)],
  ['pop-ups: into #raLayer', null, null, src => {
    const n = src.split('document.body.appendChild(').length - 1;
    if (!n) throw new Error('no document.body.appendChild');
    return src.split('document.body.appendChild(').join('raLayer().appendChild(');
  }],
  ['router: "Pricing & Proposal" shows the cost comparison’s equipment pricing under the same tabs',
    `    const {sec,id,id2} = parseHash();
    setTabs(sec);`,
    `    const {sec,id,id2} = parseHash();
    /* cost comp: #/pricing is the cost comparison's own equipment pricing, which feeds the proposal */
    const pricing = document.getElementById("eqPricing");
    if (pricing){ pricing.hidden = sec !== "pricing"; app.hidden = sec === "pricing"; }
    if (sec === "pricing"){ setTabs(sec); closeSheet(true); return; }
    setTabs(sec);`],
];
let app = read(path.join(REP, 'assets/js/app.js'));
for (const [name, from, to, fn] of PATCHES) {
  const before = app;
  if (fn) app = fn(app);
  else {
    const n = app.split(from).length - 1;
    if (n !== 1) throw new Error('Patch "' + name + '": expected the original text once, found it ' + n + ' times');
    app = app.replace(from, () => to);
  }
  if (app === before) throw new Error('Patch "' + name + '" changed nothing');
}
for (const bad of ['document.body.appendChild(', 'serviceWorker.register', 'beforeinstallprompt', 'data-theme', 'document.documentElement'])
  if (app.includes(bad)) throw new Error('app.js still contains ' + bad);
fs.writeFileSync(path.join(PUB, 'assets/js/app.js'), '/* WPI Assist from github.com/Blakew316/repequipment @ ' + commit + ', adapted for the Equipment tab by tools/sync-equipment.mjs. Edit the app in repequipment and re-run the tool. */\n' + app);

// ─── 3. equipment.css ───
// A small CSS reader: top-level rules and at-rules with their bodies (comments and strings respected).
function blocks(css) {
  const out = [];
  let i = 0;
  const skip = j => {
    if (css[j] === '/' && css[j + 1] === '*') { const e = css.indexOf('*/', j + 2); return e < 0 ? css.length : e + 2; }
    if (css[j] === '"' || css[j] === "'") { const q = css[j]; j++; while (j < css.length && css[j] !== q) j += css[j] === '\\' ? 2 : 1; return j + 1; }
    return -1;
  };
  while (i < css.length) {
    let start = i, depth = 0;
    while (i < css.length) {
      const s = skip(i); if (s >= 0) { i = s; continue; }
      const c = css[i];
      if (c === '(') depth++; else if (c === ')') depth--;
      else if (!depth && (c === '{' || c === ';' || c === '}')) break;
      i++;
    }
    const prelude = css.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (i >= css.length) break;
    if (css[i] === ';' || css[i] === '}') { if (prelude) out.push({ at: true, prelude, body: null }); i++; continue; }
    let j = i + 1, d = 1;
    while (j < css.length && d) { const s = skip(j); if (s >= 0) { j = s; continue; } if (css[j] === '{') d++; else if (css[j] === '}') d--; j++; }
    out.push({ at: prelude.startsWith('@'), prelude, body: css.slice(i + 1, j - 1) });
    i = j;
  }
  return out;
}
const splitTop = (s, sep) => { const out = []; let d = 0, cur = '', q = null; for (const c of s) { if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '(' || c === '[') d++; else if (c === ')' || c === ']') d--; else if (c === sep && !d) { out.push(cur); cur = ''; continue; } cur += c; } out.push(cur); return out.map(x => x.trim()).filter(Boolean); };

const SCOPE = ':is(#raMain,#raLayer)';
// the app's selectors, inside the Equipment tab; :root/html/body become the tab itself; dark = the cost comparison's body.dark
function scopeSel(s, inDarkMedia) {
  if (inDarkMedia) {
    if (!s.startsWith(':root:not([data-theme="light"])')) throw new Error('Unexpected selector in a prefers-color-scheme block: ' + s);
    return null;   // the system setting doesn't switch the app; the cost comparison's dark switch does
  }
  let m;
  if ((m = /^(?::root\[data-theme="dark"\]|:root\.theme-dark)/.exec(s))) return 'body.dark ' + SCOPE + s.slice(m[0].length);
  if ((m = /^(?::root|html|body)(?![\w-])/.exec(s))) return SCOPE + s.slice(m[0].length);
  if ((m = /^main(?![\w-])/.exec(s))) return SCOPE + ' .ra-main' + s.slice(4);
  return SCOPE + ' ' + s;
}
function scopeCss(css, inDarkMedia) {
  return blocks(css).map(b => {
    if (b.at) {
      if (/^@media\s+print\b/i.test(b.prelude)) return '';   // the app prints through its own documents, not the page
      if (/^@(media|supports)\b/i.test(b.prelude)) {
        const inner = scopeCss(b.body, inDarkMedia || /prefers-color-scheme:\s*dark/i.test(b.prelude));
        return inner.trim() ? b.prelude + '{\n' + inner + '}\n' : '';
      }
      return b.body == null ? b.prelude + ';\n' : b.prelude + '{' + b.body + '}\n';   // @keyframes and the like
    }
    const sels = splitTop(b.prelude, ',').map(s => scopeSel(s, inDarkMedia)).filter(Boolean);
    return sels.length ? sels.join(',\n') + '{' + b.body + '}\n' : '';
  }).join('');
}
const repCss = read(path.join(REP, 'assets/css/styles.css'));
const scoped = scopeCss(repCss, false);
if (/data-theme|:root\b/.test(scoped)) throw new Error('Unscoped theme selector left in the app stylesheet');

// Cancel the cost comparison's own rules inside the app: each property they set goes back to what the app alone would
// have (its own rules, or the browser default). :where() keeps these at the scope's weight, so every app rule, which
// comes later and weighs at least as much, still wins.
const index = read(path.join(PUB, 'index.html'));
const ccCss = [...index.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n') + '\n' + read(path.join(PUB, 'scan.css'));
const cancel = new Map();
(function walk(css) {
  for (const b of blocks(css)) {
    if (b.at) { if (b.body && /^@(media|supports)\b/i.test(b.prelude)) walk(b.body); continue; }
    const props = splitTop(b.body, ';').map(d => d.split(':')[0].trim().toLowerCase())
      .filter((p, k, all) => p && !p.startsWith('--') && /^[a-z-]+$/.test(p) && all.indexOf(p) === k);
    const important = new Set(splitTop(b.body, ';').filter(d => /!\s*important\s*$/i.test(d)).map(d => d.split(':')[0].trim().toLowerCase()));
    for (let s of splitTop(b.prelude, ',')) {
      if (/-webkit-scrollbar|#raMain|#raLayer/.test(s)) continue;
      s = s.replace(/^(?:html|body)(?:[.:#[][^\s>+~]*)?\s*(?:>\s*)?/, '').trim();   // an ancestor outside the app
      if (!s || /^(?::root|html|body)$/.test(s)) continue;                      // the page itself
      const pe = /((?:::?(?:before|after|placeholder|selection|marker|first-line|first-letter))+)$/i.exec(s);
      const key = SCOPE + ' :where(' + (pe ? s.slice(0, -pe[1].length) || '*' : s) + ')' + (pe ? pe[1] : '');
      const set = cancel.get(key) || new Set();
      props.filter(p => !important.has(p)).forEach(p => set.add(p));
      cancel.set(key, set);
    }
  }
})(ccCss);
const cancelCss = [...cancel].filter(([, p]) => p.size).map(([sel, p]) => sel + '{' + [...p].map(x => x + ':revert').join(';') + '}').join('\n');

// inherited styles the cost comparison puts on the page (html, body) that the app's own page doesn't have: back to the
// browser defaults the app was built on (the cost comparison's phone layout sets a 14px root font, for one)
const INHERITED = /^(color|font|font-[\w-]+|line-height|letter-spacing|word-spacing|text-(align|indent|transform|shadow|rendering)|white-space|visibility|cursor|direction|-webkit-font-smoothing|-moz-osx-font-smoothing|-webkit-text-size-adjust|list-style[\w-]*|quotes|tab-size|caret-color|hyphens)$/;
const pageProps = css => { const out = new Set(); (function walk(c) { for (const b of blocks(c)) {
  if (b.at) { if (b.body && /^@(media|supports)\b/i.test(b.prelude)) walk(b.body); continue; }
  if (splitTop(b.prelude, ',').some(x => /^(?::root|html|body)(?:\.[\w-]+)?$/.test(x))) splitTop(b.body, ';').forEach(d => out.add(d.split(':')[0].trim().toLowerCase()));
} })(css); return out; };
const appPage = pageProps(repCss);
const reset = [...pageProps(ccCss)].filter(p => INHERITED.test(p) && !appPage.has(p) && !(p === 'font' && appPage.has('font-family')));

// variables the app uses without defining, which the cost comparison happens to define: unset, as on the app's own site
const defined = new Set([...repCss.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const used = new Set([...(repCss + app).matchAll(/var\((--[\w-]+)/g)].map(m => m[1]));
const ccDefined = new Set([...ccCss.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
const unset = [...used].filter(v => !defined.has(v) && ccDefined.has(v));

const bg = (re) => { const m = re.exec(repCss); if (!m) throw new Error('app --bg not found'); return m[1]; };
const bgLight = bg(/:root\s*\{[^}]*?--bg:\s*([^;]+);/), bgDark = bg(/:root\[data-theme="dark"\][^{]*\{[^}]*?--bg:\s*([^;]+);/);

const integration = `
/* ─── The app inside the Equipment tab ─── */
/* edge to edge under the cost comparison's tabs, like the app's own page (undoes .main's padding) */
#raMain{margin:-1.5rem -1.5rem 0}
@media(max-width:900px){#raMain{margin:-1rem -1rem 0}}
@media(max-width:600px){#raMain{margin:-0.75rem -0.75rem 0}}
@media(max-height:500px) and (orientation:landscape){#raMain{margin:-0.5rem -0.5rem 0}}
/* pop-ups sit above the cost comparison's header; the layer itself takes no space */
#raLayer{position:relative;z-index:1000;height:0;margin:0;padding:0;background:transparent}
body:not(.ra-tab) #raLayer{display:none}
/* the page behind the app is the app's background */
body.ra-on{background:${bgLight}}
body.dark.ra-on{background:${bgDark}}
`;

fs.writeFileSync(path.join(PUB, 'assets/css/equipment.css'),
  '/* WPI Assist styles from github.com/Blakew316/repequipment @ ' + commit + ', scoped to the Equipment tab by tools/sync-equipment.mjs. Do not edit; re-run the tool. */\n' +
  '/* 1. the cost comparison’s rules cancelled inside the app */\n' + cancelCss + '\n' +
  '/* 2. the page as the app’s own page starts: browser defaults for what the cost comparison sets on its page */\n' +
  SCOPE + '{' + reset.map(p => p + ':initial').concat(unset.map(v => v + ':initial')).join(';') + '}\n' +
  '/* 3. the app’s stylesheet */\n' + scoped + integration);

// ─── 4. cache-busting ───
const v = commit + '-' + Date.now().toString(36);
const idx2 = index.replace(/(assets\/(?:js\/data\.js|js\/app\.js|css\/equipment\.css))\?v=[\w.-]+/g, '$1?v=' + v);
if (idx2 !== index) fs.writeFileSync(path.join(PUB, 'index.html'), idx2);
console.log('WPI Assist synced from', REP, '@', commit, '(v=' + v + ')');
console.log('  cancelled cost comparison selectors:', cancel.size, '· page styles reset:', reset.join(', ') || 'none', '· variables unset:', unset.join(', ') || 'none');
