// Copies the WPI Assist rep equipment app (github.com/Blakew316/repequipment) into the Equipment tab.
//
//   node tools/sync-equipment.mjs [path to a repequipment checkout]   (default: ../repequipment)
//
// What it writes:
//   public/assets/{img,flyers,guides,basil}/  the app's images, flyers, guides and forms, as they are
//   public/assets/js/data.js                  as it is
//   public/assets/js/app.js                   the app, with the integration changes listed in PATCHES
//   public/assets/css/equipment.css           the app's stylesheet, scoped to where the app shows (the Equipment tab,
//                                             the Proposal tab's quote tools, pop-ups) so its look is kept exactly and
//                                             the cost comparison's styles can't reach it
// and stamps the ?v= of those three files in public/index.html with a hash of each file's content.
// Re-run it after changing index.html's <style> or scan.css too: equipment.css cancels those styles inside the app
// (npm test fails until it's re-run).
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { costCompCss, fingerprint, STAMPED, stamp } from './cost-comp-css.mjs';

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
  /* cost comp: the app's equipment sections live in #raMain (the Equipment tab: Flyers, Installation, Troubleshooting),
     its tools, quote builders and Compare in #raProp (the Proposal tab), and its pop-ups in #raLayer */
  const raLayer = () => document.getElementById("raLayer") || document.body;
  const raRoots = () => ["raMain", "raLayer"].map(id => document.getElementById(id)).filter(Boolean);
  /* cost comp: the quote builders and Compare open in the Proposal tab in place of its tools, with a way back */
  const raQuotePage = () => { const hub = document.getElementById("raHome"), q = document.getElementById("raQuote"); if (!hub || !q) return null; q.hidden = false; return q; };
  const raBack = () => \`<div class="wrap"><section class="sec-head"><a class="back" href="#/">\${ic("arrowL")} Proposal</a></section></div>\`;`],
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
  ['header height: set on the Equipment tab, where the app\u2019s variables live',
    `    document.documentElement.style.setProperty("--hdr-h", Math.round(h.getBoundingClientRect().height) + "px");`,
    `    raRoots().forEach(r => r.style.setProperty("--hdr-h", Math.round(h.getBoundingClientRect().height) + "px"));`],
  ['header height: the Equipment tab\u2019s menu bar (phones) is the header the filter bar parks under', null, null, src => {
    const from = 'document.querySelector(".hdr")';
    if (src.split(from).length !== 3) throw new Error('header lookups not found');
    return src.split(from).join('document.querySelector("#raMain .ra-bar")');
  }],
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
  ['Equipment Quote: a page in the Proposal tab (host) instead of a pop-up', null, null, src => {
    const edits = [
      ['  function openQuote(){\n', '  function openQuote(host){   /* cost comp: host = the Proposal tab\u2019s page for it; no host = the pop-up */\n'],
      ['    wrap.className = "modal open"; wrap.id = "quoteModal";', '    wrap.className = host ? "ra-eqq" : "modal open"; wrap.id = "quoteModal";'],
      ['    document.body.appendChild(wrap);\n    const close = ()=>wrap.remove();', '    if (host) host.appendChild(wrap); else document.body.appendChild(wrap);\n    const close = host ? ()=>{ location.hash = "#/"; } : ()=>wrap.remove();'],
      ['    $("#qCancel",wrap).addEventListener("click",close);\n    wrap.addEventListener("click",e=>{ if(e.target===wrap) close(); });', '    $("#qCancel",wrap).addEventListener("click",close);\n    wrap.addEventListener("click",e=>{ if(!host && e.target===wrap) close(); });'],
      ['      close(); openQuotePdfBuilder();', '      if (!host) close(); openQuotePdfBuilder();'],
      ['      const a = loadAgent();\n      close();\n      downloadQuote(', '      const a = loadAgent();\n      if (!host) close();\n      downloadQuote('],
    ];
    for (const [from, to] of edits) { if (src.split(from).length !== 2) throw new Error('openQuote: not found: ' + from.slice(0, 60)); src = src.replace(from, () => to); }
    return src;
  }],
  ['router: the Equipment Quote opens in the Proposal tab',
    `    if (sec==="basil"){`,
    `    if (sec==="quote"){ const q = raQuotePage(); if (q){ q.innerHTML = raBack() + \`<div class="wrap ra-eqq-page"><section class="bz-hero"><div><h1>Equipment Quote</h1></div></section></div>\`; openQuote(q.querySelector(".ra-eqq-page")); } window.scrollTo(0,0); closeSheet(true); return; }
    if (sec==="basil"){`],
  ['pop-ups: into #raLayer', null, null, src => {
    const n = src.split('document.body.appendChild(').length - 1;
    if (!n) throw new Error('no document.body.appendChild');
    return src.split('document.body.appendChild(').join('raLayer().appendChild(');
  }],
  ['router: Home is the Proposal tab\u2019s tools', 
    `    if (sec==="home"){ app.innerHTML = homeView(); window.scrollTo(0,0); closeSheet(true); return; }`,
    `    if (sec==="home"){
      /* cost comp: Home is the Proposal tab's tool row (renderTools); a page opened from it closes */
      const hub = document.getElementById("raHome"), q = document.getElementById("raQuote");
      if (hub && q){ hub.hidden = false; q.hidden = true; q.innerHTML = ""; } else app.innerHTML = homeView();
      window.scrollTo(0,0); closeSheet(true); return;
    }`],
  ['router: the Basil quote opens in the Proposal tab',
    `app.innerHTML = basilView(); wireBasil();`,
    `{ const q = raQuotePage(); (q || app).innerHTML = (q ? raBack() : "") + basilView(); } wireBasil();`],
  ['router: the Genius quote opens in the Proposal tab',
    `app.innerHTML = geniusView(); wireGenius();`,
    `{ const q = raQuotePage(); (q || app).innerHTML = (q ? raBack() : "") + geniusView(); } wireGenius();`],
  ['router: Compare opens in the Proposal tab',
    `app.innerHTML = compareView(); wireCompare();`,
    `{ const q = raQuotePage(); (q || app).innerHTML = (q ? raBack() : "") + compareView(); } wireCompare();`],
  ['Home: only its quote tools, in the Proposal tab; the equipment sections have the Equipment tab\u2019s tabs instead', null, null, src => {
    const from = `  function init(){ fillStaticIcons(); render(); registerSW(); }`;
    if (src.split(from).length !== 2) throw new Error('init not found');
    return src.replace(from, () => `  function init(){ fillStaticIcons(); renderTools(); render(); registerSW(); }
  /* cost comp: Home's quick links (quotes first) as the Proposal tab's left-hand tools menu; the equipment sections are the Equipment tab's */
  function renderTools(){
    const hub = document.getElementById("raHome"); if (!hub) return;
    const t = document.createElement("div"); t.innerHTML = homeView();
    const row = t.querySelector(".home-quick"); if (!row) return;
    row.querySelectorAll('a[href="#/install"]').forEach(el => el.remove());   /* install videos and guides are in the Equipment tab */
    row.style.setProperty("--i", "0");
    const quote = [...row.children].filter(el => el.id === "quoteBtn" || /#\\/(basil|genius)$/.test(el.getAttribute("href") || ""));
    quote.reverse().forEach(el => row.prepend(el));
    /* the Equipment Quote opens as a page here, like the other quotes, not as a pop-up */
    const qb = row.querySelector("#quoteBtn");
    if (qb){ const a = document.createElement("a"); a.className = "qlink"; a.href = "#/quote"; a.innerHTML = qb.innerHTML; qb.replaceWith(a); }
    /* each label in its own span, so a folded menu can show just the icons */
    [...row.children].forEach(el => { [...el.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => { const sp = document.createElement("span"); sp.className = "ra-label"; sp.textContent = n.textContent.trim(); n.replaceWith(sp); }); el.title = el.textContent.trim(); });
    const list = document.getElementById("raTools") || hub; list.innerHTML = ""; list.appendChild(row);
  }`);
  }],
  ['equipment sections: no "\u2190 Home" link (Home isn\u2019t in the Equipment tab)',
    `        <a class="back" href="#/">\${ic("arrowL")} Home</a>\n`, ''],
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

const SCOPE = ':is(#raMain,#raLayer,#raHome,#raQuote,#raPropBar)';
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
      if (/^@(-webkit-)?keyframes\b|^@font-face\b/i.test(b.prelude) && b.body != null) return b.prelude + '{' + b.body + '}\n';   // not selectors: as they are
      if (/^@charset\b/i.test(b.prelude)) return '';
      // @container, @layer, @scope, @import...: this tool doesn't scope them yet, and copied as they are they'd reach the cost comparison
      throw new Error('The app stylesheet uses ' + b.prelude.split(/[\s{(]/)[0] + ', which tools/sync-equipment.mjs doesn\u2019t know how to scope: ' + b.prelude);
    }
    if (inDarkMedia) {   // dropped (see scopeSel), which is only right if the app's dark switch has the same rule
      const miss = splitTop(b.prelude, ',').filter(s => !darkTwins.has(twinKey(':root[data-theme="dark"]' + s.slice(':root:not([data-theme="light"])'.length), b.body)));
      if (miss.length) throw new Error('A prefers-color-scheme: dark rule has no :root[data-theme="dark"] twin, so the dark switch wouldn\u2019t apply it: ' + miss.join(', '));
    }
    const sels = splitTop(b.prelude, ',').map(s => scopeSel(s, inDarkMedia)).filter(Boolean);
    return sels.length ? sels.join(',\n') + '{' + b.body + '}\n' : '';
  }).join('');
}
const repCss = read(path.join(REP, 'assets/css/styles.css'));
// every :root[data-theme="dark"] rule (selector + declarations), to check the prefers-color-scheme: dark rules against
const twinKey = (sel, body) => sel.replace(/\s+/g, ' ').trim() + '{' + splitTop(body, ';').map(d => d.replace(/\s+/g, ' ').replace(/\s*:\s*/, ':')).sort().join(';') + '}';
const darkTwins = new Set();
(function walk(css, dark) { for (const b of blocks(css)) {
  if (b.at) { if (b.body && /^@(media|supports)\b/i.test(b.prelude) && !/prefers-color-scheme/i.test(b.prelude)) walk(b.body); continue; }
  splitTop(b.prelude, ',').filter(s => s.startsWith(':root[data-theme="dark"]')).forEach(s => darkTwins.add(twinKey(s, b.body)));
} })(repCss);
const scoped = scopeCss(repCss, false);
if (/data-theme|:root\b/.test(scoped)) throw new Error('Unscoped theme selector left in the app stylesheet');

// Cancel the cost comparison's own rules inside the app: each property they set goes back to what the app alone would
// have (its own rules, or the browser default). :where() keeps these at the scope's weight, so every app rule, which
// comes later and weighs at least as much, still wins.
const index = read(path.join(PUB, 'index.html'));
const ccCss = costCompCss(PUB);
// a ::-webkit-scrollbar rule can't be cancelled (any match turns on a custom scrollbar), so the cost comparison's must
// leave the app out themselves
const SB_GUARD = ':not(' + SCOPE + ',' + SCOPE + ' *)';
const cancel = new Map();
(function walk(css) {
  for (const b of blocks(css)) {
    if (b.at) { if (b.body && /^@(media|supports)\b/i.test(b.prelude)) walk(b.body); continue; }
    const props = splitTop(b.body, ';').map(d => d.split(':')[0].trim().toLowerCase())
      .filter((p, k, all) => p && !p.startsWith('--') && /^[a-z-]+$/.test(p) && all.indexOf(p) === k);
    const important = new Set(splitTop(b.body, ';').filter(d => /!\s*important\s*$/i.test(d)).map(d => d.split(':')[0].trim().toLowerCase()));
    for (let s of splitTop(b.prelude, ',')) {
      if (/-webkit-scrollbar/.test(s)) {
        if (!s.startsWith(SB_GUARD + '::-webkit-scrollbar')) throw new Error('The cost comparison\u2019s scrollbar rule "' + s + '" would reach inside the app: start it with ' + SB_GUARD);
        continue;
      }
      if (/#raMain|#raLayer|#raHome|#raQuote|#raPropBar/.test(s)) continue;
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
#raMain,#raPropBar{margin:-1.5rem -1.5rem 0}
@media(max-width:900px){#raMain,#raPropBar{margin:-1rem -1rem 0}}
@media(max-width:600px){#raMain,#raPropBar{margin:-0.75rem -0.75rem 0}}
@media(max-height:500px) and (orientation:landscape){#raMain,#raPropBar{margin:-0.5rem -0.5rem 0}}

/* ─── Left-hand menus: the Equipment tab's sections and the Proposal tab's tools ─── */
.ra-shell{display:grid;grid-template-columns:260px minmax(0,1fr);gap:24px;align-items:start}
.ra-shell.ra-collapsed{grid-template-columns:64px minmax(0,1fr)}
#raMain .ra-shell{padding:24px 0 0 24px}
:is(#raMain .ra-side,#raHome){position:sticky;top:16px;display:flex;flex-direction:column;gap:4px;margin:0;padding:10px;max-height:calc(100vh - 32px);overflow:auto;
  background:var(--card);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow-sm)}
:is(#raMain,#raHome) .ra-side-head,:is(#raMain,#raPropBar) .ra-burger{display:flex;align-items:center;gap:12px;font:inherit;font-weight:700;font-size:15px;letter-spacing:-0.01em;color:var(--text);cursor:pointer;text-align:left}
:is(#raMain,#raHome) .ra-side-head{width:100%;padding:10px 12px;margin:0 0 6px;border:0;border-bottom:1px solid var(--border-2);border-radius:12px 12px 0 0;background:none}
:is(#raMain,#raHome) .ra-side-head:hover{background:var(--bg-soft)}
:is(#raMain,#raHome,#raPropBar) :is(.ra-side-head,.ra-burger) svg{width:22px;height:22px;flex:0 0 auto}
/* the items: the app's own tab and quick-link styles, stacked */
#raMain .ra-side .subnav{flex-direction:column;gap:4px;padding:0;overflow:visible}
#raMain .ra-side .tab{width:100%;justify-content:flex-start;gap:12px;padding:12px 14px;border-radius:12px;font-size:15px;line-height:20px;white-space:nowrap}
#raHome .home-quick{display:flex;flex-direction:column;gap:4px;padding:0;animation:none}
#raHome .qlink{width:100%;justify-content:flex-start;gap:12px;padding:12px 14px;border-color:transparent;border-radius:12px;background:none;box-shadow:none;font-size:15px;line-height:20px;text-align:left;white-space:nowrap}
#raHome .qlink:hover{background:var(--bg-soft);border-color:transparent}
#raHome .qlink.active{background:var(--navy);border-color:var(--navy);color:#fff}
#raHome .qlink.active svg{color:#fff}
:is(#raMain .ra-side .tab,#raHome .qlink) svg{width:18px;height:18px;flex:0 0 auto}
/* folded to icons */
.ra-collapsed :is(#raMain .ra-side,#raHome) .ra-label{display:none}
.ra-collapsed :is(#raMain .ra-side .tab,#raHome .qlink,#raMain .ra-side-head,#raHome .ra-side-head){justify-content:center;padding-left:0;padding-right:0}
/* the phone bar and drawer */
:is(#raMain,#raPropBar) .ra-bar,#raPropBar{display:none}
.ra-scrim{display:none}
@media(max-width:900px){
  .ra-shell,.ra-shell.ra-collapsed{grid-template-columns:minmax(0,1fr);gap:0}
  #raMain .ra-shell{padding:0}
  .ra-collapsed :is(#raMain .ra-side,#raHome) .ra-label{display:inline}
  .ra-collapsed :is(#raMain .ra-side .tab,#raHome .qlink){justify-content:flex-start;padding:12px 14px}
  :is(#raMain .ra-side,#raHome){position:fixed;top:0;left:0;bottom:0;z-index:1100;width:min(300px,84vw);max-height:none;border-radius:0 20px 20px 0;
    padding:calc(12px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom));transform:translateX(-105%);visibility:hidden;transition:transform .22s cubic-bezier(.22,.61,.36,1),visibility 0s .22s;box-shadow:var(--shadow-lg)}
  /* closed, the drawer is out of the tab order and hidden from screen readers too */
  :is(#raMain .ra-shell.ra-open .ra-side,.ra-shell.ra-open > #raHome){transform:none;visibility:visible;transition:transform .22s cubic-bezier(.22,.61,.36,1)}
  .ra-shell.ra-open + .ra-scrim{display:block;position:fixed;inset:0;z-index:1099;background:rgba(0,0,0,0.38)}
  #raMain .ra-bar,#raPropBar{display:flex;position:sticky;top:0;z-index:50;align-items:center;padding:10px 16px;background:transparent;border-bottom:1px solid var(--border-2)}
  /* the blur sits behind the button, as on the app's own header, so taps reach it on iOS */
  :is(#raMain .ra-bar,#raPropBar)::before{content:"";position:absolute;inset:0;z-index:0;background:var(--header-bg);
    -webkit-backdrop-filter:saturate(180%) blur(18px);backdrop-filter:saturate(180%) blur(18px)}
  #raPropBar{margin-bottom:14px}
  :is(#raMain,#raPropBar) .ra-burger{position:relative;z-index:1;padding:9px 16px 9px 12px;border:1px solid var(--border);border-radius:999px;background:var(--card);box-shadow:var(--shadow-sm)}
  body.ra-drawer{overflow:hidden}
}
@media(prefers-reduced-motion:reduce){:is(#raMain .ra-side,#raHome){transition:none}}
/* a quote or Compare opens in the Proposal tab's main column, in place of the proposal */
#raQuote{position:relative;border:1px solid var(--border);border-radius:18px;padding-bottom:24px;margin-bottom:1.25rem}
/* their headers: the title centered at the top, without the Wholesale Payments logo (the page already has it) */
#raQuote > .wrap:first-child .sec-head{padding:14px 0 0}
#raQuote > .wrap:first-child .sec-head .back{margin-bottom:4px}
#raQuote .bz-hero{justify-content:center;padding:6px 2px 4px}
#raQuote .gn-hero2{padding:6px 0 4px}
#raQuote .gn-logo{display:none}
#raQuote .gnhero{margin-top:14px}
@media(min-width:761px){
  #raQuote > .wrap:first-child{position:absolute;top:0;left:0;z-index:2}
  #raQuote > .wrap:first-child .sec-head{padding-top:22px}
  #raQuote .bz-hero,#raQuote .gn-hero2{padding-top:14px}
}
/* the Equipment Quote as a page: the builder's card in the page instead of over it */
#raQuote .ra-eqq .modal-card{position:static;transform:none;width:auto;max-width:620px;max-height:none;margin:14px auto 0;overflow:visible;box-shadow:var(--shadow-sm)}
#raQuote .ra-eqq .modal-head,#raQuote .ra-eqq #qCancel{display:none}
#raQuote .ra-eqq .modal-body{padding-top:18px}
#tab-proposal:has(#raQuote:not([hidden])) .ra-content > :not(#raQuote){display:none}
/* native control parts (date pickers, dropdown lists, scrollbars) follow the system setting, as the app's own page says */
${SCOPE}{color-scheme:light dark}
/* a quote's total bar is fixed to the bottom of the screen: the app's page ends in blank space for it, so the cost
   comparison's footer steps aside while one is open instead of sitting under the bar */
body:has(#raQuote:not([hidden]) .bz-bar) .footer{display:none}
/* reduced motion: the app jumps to the top of a page instead of scrolling there (its html rule, on the page while it shows) */
@media(prefers-reduced-motion:reduce){html:has(body.ra-tab){scroll-behavior:auto}}
/* pop-ups sit above the cost comparison's header; the layer itself takes no space */
#raLayer{position:relative;z-index:1000;height:0;margin:0;padding:0;background:transparent}
body:not(.ra-tab) #raLayer{display:none}
/* the page behind the app is the app's background */
body.ra-on{background:${bgLight}}
body.dark.ra-on{background:${bgDark}}
`;

fs.writeFileSync(path.join(PUB, 'assets/css/equipment.css'),
  '/* WPI Assist styles from github.com/Blakew316/repequipment @ ' + commit + ', scoped to the Equipment tab by tools/sync-equipment.mjs. Do not edit; re-run the tool. */\n' +
  '/* cost comparison styles: ' + fingerprint(ccCss) + ' */\n' +
  '/* 1. the cost comparison’s rules cancelled inside the app */\n' + cancelCss + '\n' +
  '/* 2. the page as the app’s own page starts: browser defaults for what the cost comparison sets on its page */\n' +
  SCOPE + '{' + reset.map(p => p + ':initial').concat(unset.map(v => v + ':initial')).join(';') + '}\n' +
  '/* 3. the app’s stylesheet */\n' + scoped + integration);

// ─── 4. cache-busting: each file's ?v= is a hash of its content, so it changes exactly when the file does ───
let idx2 = index;
for (const f of STAMPED) {
  const re = new RegExp(f.replace(/[.\/]/g, '\\$&') + '\\?v=[\\w.-]+', 'g');
  if (!re.test(idx2)) throw new Error('index.html doesn\u2019t load ' + f + '?v=');
  idx2 = idx2.replace(re, f + '?v=' + stamp(PUB, f));
}
if (idx2 !== index) fs.writeFileSync(path.join(PUB, 'index.html'), idx2);
console.log('WPI Assist synced from', REP, '@', commit, '(' + STAMPED.map(f => path.basename(f) + '?v=' + stamp(PUB, f)).join(', ') + ')');
console.log('  cancelled cost comparison selectors:', cancel.size, '· page styles reset:', reset.join(', ') || 'none', '· variables unset:', unset.join(', ') || 'none');
