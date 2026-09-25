/* ═══════════════════════════════════════════════════════════════
   scan-core.js — Merchant statement scanning core
   Pure logic shared by the browser (scan.js) and the Node tests:
     • buildPageLines()   PDF.js text items → lines / column segments
     • parseStatement()   on-device extraction (no server, no AI)
     • matchProgram()     statement interchange line → Appendix G program
     • computeMarkup()    Appendix G true cost vs. current statement fees
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScanCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ───────────────────────── Layout ─────────────────────────
  // items: [{str, x, y, w, h}] in PDF user space (y grows upward)
  function buildPageLines(items, pageWidth) {
    const its = items
      .filter(i => i && i.str && i.str.trim())
      .map(i => ({ s: i.str, x: i.x, y: i.y, w: i.w || 0, h: Math.abs(i.h) || 8 }));
    its.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = [];
    for (const it of its) {
      const tol = Math.max(2, it.h * 0.45);
      let ln = null;
      for (let k = lines.length - 1; k >= 0 && k >= lines.length - 6; k--) {
        if (Math.abs(lines[k].y - it.y) <= tol) { ln = lines[k]; break; }
      }
      if (!ln) { ln = { y: it.y, items: [] }; lines.push(ln); }
      ln.items.push(it);
    }
    lines.sort((a, b) => b.y - a.y);
    return {
      width: pageWidth || 612,
      lines: lines.map(l => {
        l.items.sort((a, b) => a.x - b.x);
        const segs = [];
        let cur = null, lastEnd = null;
        for (const it of l.items) {
          const gap = lastEnd === null ? 0 : it.x - lastEnd;
          if (!cur || gap > 12) { cur = { t: it.s, x: it.x, x2: it.x + it.w }; segs.push(cur); }
          else { cur.t += (gap > 1.5 ? ' ' : '') + it.s; cur.x2 = it.x + it.w; }
          lastEnd = it.x + it.w;
        }
        segs.forEach(s => { s.t = s.t.replace(/\s+/g, ' ').trim(); });
        const kept = segs.filter(s => s.t);
        return { y: l.y, segs: kept, text: kept.map(s => s.t).join(' | ') };
      }).filter(l => l.text)
    };
  }

  // ───────────────────────── OCR (photos & scanned PDFs) ─────────────────────────
  // Fix the digit confusions OCR makes inside money/number tokens.
  function normalizeOcrWord(raw) {
    let s = String(raw || '').replace(/[“”]/g, '"').replace(/[‘’`´]/g, "'").replace(/[—–]/g, '-').trim();
    s = s.replace(/^[»«¥£€•·*~_=|]+|[»«¥£€•·*~_=|]+$/g, '');
    if (!s) return s;
    // stray quote/comma specks next to a number: "12,345.67 → 12,345.67
    const bare = s.replace(/^["',:;]+|["',:;]+$/g, '');
    if (bare !== s && /\d.*\d/.test(bare) && /^[-(]?[$S§]?[-(]?[\dOoIl|,.]+[)%-]?$/.test(bare)) s = bare;
    const digits = (s.match(/\d/g) || []).length;
    if (digits >= 2 && /^[-(]?[$S§]?[-(]?[\dOoIl|,.]+[)%-]?$/.test(s)) {
      s = s.replace(/^([-(]?)[S§](?=[-(]?[\dOoIl])/, '$1$').replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
      if (/^[-(]?\$?-?\d{1,3}(\.\d{3})+\.\d{2}[)-]?$/.test(s)) s = s.replace(/\.(?=\d{3}[.,])/g, ',');          // 1.234.56 → 1,234.56
      if (/^[-(]?\$?-?\d{1,3}(,\d{3})*,\d{2}[)-]?$/.test(s)) s = s.replace(/,(\d{2})([)-]?)$/, '.$1$2');          // 1,234,56 → 1,234.56
    }
    return s;
  }

  // How readable an OCR pass was: confident real words. A sideways or upside-down page scores near zero.
  function ocrQuality(ocr) {
    let good = 0, all = 0;
    (ocr.lines || []).forEach(l => (l.words || []).forEach(w => {
      all++;
      if (w.c >= 70 && /[A-Za-z]{3,}|\d{2,}/.test(w.t || '')) good++;
    }));
    return { good, all, ratio: all ? good / all : 0 };
  }

  // Tesseract result {width, height, lines:[{baseline, words:[{t, b:{x0,y0,x1,y1}, c}]}]}
  // → the same page shape buildPageLines produces for PDF text (612-wide user space, y up).
  function buildPageLinesFromOcr(ocr) {
    const W = ocr.width, H = ocr.height;
    // Straighten tilted photos using the slope of the longer text baselines. Phone photos are rarely flat
    // (perspective, curled paper), so each word uses the median slope of the baselines near its own height.
    const base = [];
    (ocr.lines || []).forEach(l => {
      const b = l.baseline;
      if (!b || !(l.words || []).length || l.words.length < 2 || b.x1 - b.x0 < W * 0.08) return;
      base.push({ y: (b.y0 + b.y1) / 2, k: (b.y1 - b.y0) / (b.x1 - b.x0) });
    });
    const median = arr => { const v = arr.slice().sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    const slope = base.length >= 3 ? median(base.map(g => g.k)) : 0;
    const slopeNear = y => {
      if (base.length < 3) return slope;
      const near = base.filter(g => Math.abs(g.y - y) < H * 0.06).map(g => g.k);
      return near.length >= 3 ? median(near) : slope;
    };
    const s = 612 / W;
    const items = [];
    (ocr.lines || []).forEach(l => (l.words || []).forEach(w => {
      const t = normalizeOcrWord(w.t);
      if (!t || (w.c != null && w.c < 20 && !/[A-Za-z0-9]{2}/.test(t))) return;
      const b = w.b;
      const cy = (b.y0 + b.y1) / 2 - slopeNear((b.y0 + b.y1) / 2) * ((b.x0 + b.x1) / 2 - W / 2);
      items.push({ str: t, x: b.x0 * s, y: (H - cy) * s, w: (b.x1 - b.x0) * s, h: (b.y1 - b.y0) * s });
    }));
    const page = buildPageLines(items, 612);
    page.ocr = { conf: ocr.conf, skew: slope };
    return page;
  }

  // ───────────────────────── Tokens ─────────────────────────
  const MONEY_TOKEN = /^\(?[-–]?\$?\(?[-–]?(?:\d{1,3}(?:,\d{3})+|\d*)\.\d{2}\)?-?$/;
  const INT_TOKEN = /^(?:\d{1,3}(?:,\d{3})+|\d+)$/;

  function parseMoney(raw) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    const neg = /^\(.*\)$|^\$?\(|[-–]/.test(s);
    const n = parseFloat(s.replace(/[^\d.]/g, ''));
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }

  // Split a line into typed tokens: money (2 decimals), int, pct, dec (rates / per-item), word
  function tokens(text) {
    const out = [];
    String(text).split(/\s*\|\s*|\s+/).forEach(raw => {
      if (!raw) return;
      let r = raw.replace(/^[:=+]+|[:,;]+$/g, '');
      if (!r) return;
      if (r === '$' || r === '-' || r === '--' || r === '+' || r === '=') return;
      if (/%$/.test(r)) { const v = parseFloat(r.replace(/[^\d.\-]/g, '')); if (isFinite(v)) out.push({ k: 'pct', v, raw }); return; }
      if (MONEY_TOKEN.test(r)) { out.push({ k: 'money', v: parseMoney(r), raw }); return; }
      if (INT_TOKEN.test(r)) { out.push({ k: 'int', v: parseInt(r.replace(/,/g, ''), 10), raw }); return; }
      if (/^\$?-?\d*\.\d{3,6}$/.test(r) || /^\.\d{3,6}\+\d*\.\d+$/.test(r)) { out.push({ k: 'dec', v: parseFloat(r.replace(/^\$/, '').replace(/\+.*$/, '')) || 0, raw }); return; }
      out.push({ k: 'word', v: r, raw });
    });
    return out;
  }
  const firstOf = (toks, k) => { const t = toks.find(x => x.k === k); return t ? t.v : null; };
  // first int followed (later in the row) by a money token → [count, amount]
  function countAndAmount(toks) {
    const lead = toks.filter(t => t.k !== 'pct' && t.k !== 'dec');
    if (lead.length >= 2 && lead[0].k === 'money' && lead[1].k === 'int') {
      const a = lead[0].v, n = lead[1].v, b = lead[2] && lead[2].k === 'money' ? lead[2].v : null;
      if (a >= 1 && b != null && b > 0 && Math.abs(a * n - b) / b < 0.02) return { count: n, amount: b };  // avg ticket, items, amount
      if (a >= 1 && n > 0 && n < a) return { count: n, amount: a };                                        // amount, qty
    }
    for (let i = 0; i < toks.length; i++) {
      if (toks[i].k !== 'int') continue;
      for (let j = i + 1; j < toks.length; j++) {
        if (toks[j].k === 'money') return { count: toks[i].v, amount: toks[j].v };
        if (toks[j].k === 'word' && /[a-z]{3,}/i.test(toks[j].v)) break;
      }
    }
    return null;
  }
  const r2 = n => Math.round(n * 100) / 100;

  // ───────────────────────── Document model ─────────────────────────
  function makeDoc(pages) {
    const all = [];
    pages.forEach((p, pi) => (p.lines || []).forEach((l, li) => all.push({ page: pi, idx: li, y: l.y, text: l.text, segs: l.segs || [{ t: l.text, x: 0 }], width: p.width || 612 })));
    const full = all.map(l => l.text).join('\n');
    return { pages, all, full };
  }

  // Find the first money value after a label on the same line (or the next line when stacked)
  function valueAfterLabel(doc, re, opts) {
    opts = opts || {};
    const hits = [];
    for (let i = 0; i < doc.all.length; i++) {
      const l = doc.all[i];
      const m = re.exec(l.text);
      if (!m) continue;
      if (opts.notRe && opts.notRe.test(l.text)) continue;
      const rest = l.text.slice(m.index + m[0].length);
      let toks = tokens(rest);
      let v = firstOf(toks, 'money');
      let src = l.text;
      if (v == null && opts.nextLine !== false) {
        for (let k = 1; k <= (opts.lookahead || 1) && v == null; k++) {
          const nl = doc.all[i + k];
          if (!nl || nl.page !== l.page) break;
          toks = tokens(nl.text);
          v = firstOf(toks, 'money');
          if (v != null && opts.stackedCount) {
            const c = firstOf(toks, 'int');
            if (c != null) hits.push({ value: Math.abs(v), count: c, line: i, src: l.text + ' ⏎ ' + nl.text });
            v = null; break;
          }
          src = l.text + ' ⏎ ' + nl.text;
        }
      }
      if (v != null) hits.push({ value: opts.keepSign ? v : Math.abs(v), line: i, src });
      if (hits.length && opts.first !== false) break;
    }
    return hits;
  }

  // TSYS plan summary whose "**" total label was lost (common in scans): the first row after the
  // plan-code rows that starts with a count and totals at least as much as any single plan
  function unlabeledPlanTotal(doc) {
    for (let i = 0; i < doc.all.length; i++) {
      if (!/Plan Summary/i.test(doc.all[i].text)) continue;
      let plans = 0, maxAmt = 0;
      for (let j = i + 1; j < Math.min(doc.all.length, i + 25); j++) {
        const t = doc.all[j].text, first = t.split(' | ')[0];
        if (/^[A-Za-z$§]{1,3}$/.test(first)) {
          const ca = countAndAmount(tokens(t.slice(first.length)));
          plans++; if (ca && ca.amount > maxAmt) maxAmt = ca.amount;
          continue;
        }
        if (plans >= 2 && /^\d[\d,]*$/.test(first)) {
          const ca = countAndAmount(tokens(t));
          if (ca && ca.amount >= maxAmt && maxAmt > 0) return Object.assign(ca, { line: j, src: t });
        }
        if (plans >= 2) break;
      }
    }
    return null;
  }

  // Worldpay Integrated Payments card-type summary total. OCR often reads the count "12,345" as "12.345",
  // so a count cell with a 3-digit fraction right before the amount is read as thousands.
  function worldpayIpTotal(doc) {
    const hit = totalRowAfter(doc, /^Card Type\b/i, /^Total\b/i, 30);
    if (!hit) return null;
    const segs = hit.src.split(' | ');
    const ai = segs.findIndex(x => { const t = tokens(x); return t.length === 1 && t[0].k === 'money' && Math.abs(t[0].v - hit.amount) < 0.005; });
    if (ai > 0 && /^\d{1,3}[.,]\d{3}$/.test(segs[ai - 1].trim())) hit.count = +segs[ai - 1].replace(/\D/g, '');
    return hit;
  }

  // First "total" style row after an anchor line → {count, amount}
  function totalRowAfter(doc, anchorRe, rowRe, maxLines) {
    for (let i = 0; i < doc.all.length; i++) {
      if (!anchorRe.test(doc.all[i].text)) continue;
      for (let j = i + 1; j < Math.min(doc.all.length, i + (maxLines || 40)); j++) {
        const t = doc.all[j].text;
        if (rowRe.test(t)) {
          const ca = countAndAmount(tokens(t.replace(rowRe, ' ')));
          if (ca) return Object.assign(ca, { line: j, src: t });
        }
      }
    }
    return null;
  }

  // ───────────────────────── Family detection ─────────────────────────
  function detectFamily(full) {
    if (/Processing Activity Summary/i.test(full) && /Total Monthly Fees/i.test(full)) return 'payroc';
    if (/Billing Account/i.test(full) && /Amount Total:|Subtotal in USD/i.test(full)) return 'clover_billing';
    if (/Account Summary/i.test(full) && /Summary By Day/i.test(full) && /Amount Submitted/i.test(full)) return 'north';
    if (/YOUR CARD PROCESSING STATEMENT/i.test(full)) return 'fiserv';
    if (/Plan Summary/i.test(full) || /Discount Due/i.test(full)) return 'tsys';
    if (/Card Processing - Visa/i.test(full) || /\bToast\b/i.test(full)) return 'toast';
    if (/Total Fees For Billing Period/i.test(full) || (/worldpay/i.test(full) && /Merchant Billing Statement/i.test(full))) return 'worldpay';
    if (/Interchange (&|and) Worldpay Fees/i.test(full) || (/Worldpay Integrated/i.test(full) && /MERCHANT STATEMENT|DEPOSIT SUMM/i.test(full))) return 'worldpay_ip';
    if (/Merchant Billing Statement/i.test(full)) return 'usbank';
    if (/spoton/i.test(full)) return 'spoton';
    if (/Sales Summary/i.test(full) && /Total Collected/i.test(full) && /Net Total/i.test(full)) return 'square';   // Square dashboard sales report
    if (/shift4/i.test(full) || /TOTAL PROCESSING SERVICE FEES APPLIED/i.test(full)) return 'shift4';
    return 'generic';
  }
  const PROCESSOR_NAMES = [
    ['payroc', 'Payroc'], ['paysafe', 'Paysafe'], ['clover', 'Clover (Fiserv)'], ['toast', 'Toast'], ['spoton', 'SpotOn'],
    ['shift4', 'Shift4'], ['commercecontrol', 'North (Commerce Control)'], ['north american bancard', 'North American Bancard'],
    ['ecrypt', 'eCrypt (Fiserv)'], ['wholesale payments', 'Wholesale Payments (Fiserv)'], ['us bank', 'U.S. Bank / Elavon'],
    ['elavon', 'Elavon'], ['payments insider', 'Worldpay'], ['worldpay', 'Worldpay'], ['heartland', 'Heartland'],
    ['global payments', 'Global Payments'], ['tsys', 'TSYS'], ['square', 'Square'], ['stripe', 'Stripe'],
    ['merchant one', 'Merchant One'], ['first data', 'First Data (Fiserv)'], ['fiserv', 'Fiserv'], ['cardpointe', 'CardPointe (Fiserv)']
  ];
  function detectProcessor(full) {
    const f = full.toLowerCase().replace(/\s+/g, ' ');
    for (const [k, name] of PROCESSOR_NAMES) if (f.includes(k)) return name;
    return null;
  }

  // ───────────────────────── Totals ─────────────────────────
  function pickBest(cands, volume) {
    cands = cands.filter(c => c && isFinite(c.value) && c.value > 0);
    if (volume) {
      const ok = cands.filter(c => c.value / volume > 0.002 && c.value / volume < 0.15);
      if (ok.length) cands = ok;
    }
    cands.sort((a, b) => b.score - a.score || a.line - b.line);
    return cands[0] || null;
  }

  function extractVolume(doc, fam) {
    const c = [];
    const add = (score, hit, label) => { if (hit) c.push({ score, value: Math.abs(hit.amount != null ? hit.amount : hit.value), count: hit.count != null ? hit.count : null, line: hit.line || 0, src: hit.src, label }); };

    if (fam === 'payroc') add(100, totalRowAfter(doc, /Processing Activity Summary/i, /^Total\b/i, 30), 'Processing Activity Summary total');
    if (fam === 'fiserv') {
      add(96, totalRowAfter(doc, /Total Gross Sales You Submitted/i, /^(0-0 )?Total\b/i, 30), 'Summary by card type total');
      valueAfterLabel(doc, /\b(Total )?Amounts? Submitted\b/i, { notRe: /Total Gross|\(|You Submitted/ }).forEach(h => add(85, h, 'Amounts submitted'));
    }
    if (fam === 'north') {
      for (let i = 0; i < doc.all.length; i++) {
        if (!/Amount Submitted/i.test(doc.all[i].text) || !/Fees/i.test(doc.all[i].text)) continue;
        for (let j = i + 1; j < Math.min(doc.all.length, i + 60); j++) {
          if (/^Total\b/i.test(doc.all[j].text)) { const m = tokens(doc.all[j].text).filter(t => t.k === 'money'); if (m.length) add(98, { amount: m[0].v, line: j, src: doc.all[j].text }, 'Summary by day total'); break; }
        }
        break;
      }
    }
    if (fam === 'clover_billing') valueAfterLabel(doc, /^Total Sales\b/i, { stackedCount: true, lookahead: 2 }).forEach(h => add(98, h, 'Total sales'));
    if (fam === 'tsys') {
      add(97, totalRowAfter(doc, /Plan Summary/i, /^(\*\*|Totals?)\b\s*/i, 25), 'Plan summary total');
      add(93, unlabeledPlanTotal(doc), 'Plan summary total');
      add(80, totalRowAfter(doc, /./, /^Deposit Totals\b/i, 100000), 'Deposit totals');
    }
    if (fam === 'toast') add(97, totalRowAfter(doc, /Card Processing/i, /^Total\b/i, 25), 'Card processing total');
    if (fam === 'usbank') {
      doc.all.forEach((l, i) => { const m = /^(Total Sales|Sales)\s*\|/i.exec(l.text); if (m) { const ca = countAndAmount(tokens(l.text.slice(m[0].length))); if (ca) add(/^Total/i.test(m[1]) ? 95 : 90, Object.assign(ca, { line: i, src: l.text }), m[1]); } });
    }
    if (fam === 'worldpay') {
      const hit = totalRowAfter(doc, /^Card Fees\b/i, /^Totals?\b/i, 25);
      if (hit) { const t = tokens(hit.src); add(97, { amount: firstOf(t, 'money'), count: firstOf(t, 'int'), line: hit.line, src: hit.src }, 'Card fees total'); }
    }
    if (fam === 'worldpay_ip') add(96, worldpayIpTotal(doc), 'Card type summary total');
    if (fam === 'spoton') add(96, totalRowAfter(doc, /ACTIVITY SUMMARY/i, /^TOTAL\b/i, 20), 'Activity summary total');
    if (fam === 'square') valueAfterLabel(doc, /^Card \|/i, { nextLine: false }).forEach(h => add(96, h, 'Card payments'));
    if (fam === 'shift4') {
      doc.all.forEach((l, i) => { if (/^ACTIVITY TOTAL/i.test(l.text)) { const t = tokens(l.text); const amt = firstOf(t, 'money'); const ints = t.filter(x => x.k === 'int' && x.v > 0); add(96, { amount: amt, count: ints.length ? ints[0].v : null, line: i, src: l.text }, 'Activity total'); } });
    }
    // Generic labelled amounts
    [
      [/Total Gross Sales\b/i, 70], [/Gross Sales Volume\b/i, 70], [/\bTotal (Card )?Sales\b/i, 68], [/Total Amount Submitted/i, 72],
      [/\bAmounts? Submitted\b/i, 66], [/\bGross Sales\b/i, 64], [/YOUR SALES/i, 60], [/\bNet Sales\b/i, 55], [/Total (Sales )?Volume\b/i, 62]
    ].forEach(([re, sc]) => valueAfterLabel(doc, re, { lookahead: 2, notRe: /reportable|year-to-date|ytd/i }).forEach(h => add(sc, h, 'Label')));
    // Generic total rows (count + amount)
    doc.all.forEach((l, i) => {
      if (/^(TOTAL|Totals?|GRAND TOTAL|\*\*)\s*(\||$)/i.test(l.text)) {
        const ca = countAndAmount(tokens(l.text.replace(/^[^|]*\|/, '')));
        if (ca && ca.amount > 50 && ca.count > 0) add(40 - Math.min(10, l.page * 2), Object.assign(ca, { line: i, src: l.text }), 'Total row');
      }
    });
    return c;
  }

  function extractFees(doc, fam) {
    const c = [];
    const add = (score, h, label) => { if (h && h.value != null) c.push({ score, value: Math.abs(h.value), line: h.line || 0, src: h.src, label }); };
    const lab = (re, score, opts) => valueAfterLabel(doc, re, opts || {}).forEach(h => add(score, h, re.source));

    if (fam === 'tsys') {
      const disc = valueAfterLabel(doc, /^(Total )?Discount Due\b:?/i, { notRe: /Net Discount/i })[0];
      const fees = valueAfterLabel(doc, /^(Total )?Fees Due\b:?/i, { notRe: /Net Fees/i })[0];
      if (fees) add(disc ? 100 : 92, { value: (disc ? disc.value : 0) + fees.value, line: fees.line, src: (disc ? disc.src + ' + ' : '') + fees.src }, 'Discount due + fees due');
      // Only the summary page (e.g. one photo): the month-end deduction, which includes a monthly-billed discount
      lab(/^(Amount )?Deducted:?(\s*\||$)/i, 70, { lookahead: 2 });
    }
    if (fam === 'payroc') lab(/Total Monthly Fees\b/i, 100);
    if (fam === 'fiserv') {
      lab(/\bFees Charged\b/i, 100, { notRe: /\+|Amount Funded/i });
      doc.all.forEach((l, i) => { if (/^Page \| \d+ \| Fees \|/i.test(l.text)) add(99, { value: firstOf(tokens(l.text), 'money'), line: i, src: l.text }, 'Summary fees'); });
      lab(/^Fees$/i, 90, { lookahead: 1 });
      lab(/Total \(Misc Fees and Card Fees\)/i, 95);
      lab(/^TOTAL \(Service Charges/i, 95);
      lab(/^GRAND TOTAL\b/i, 60);
    }
    if (fam === 'clover_billing') { lab(/Amount Total:/i, 100); lab(/Subtotal in USD:/i, 95); }
    if (fam === 'north') {
      lab(/^Fees$/i, 98, { lookahead: 1 });
      for (let i = 0; i < doc.all.length; i++) {
        if (!/Amount Submitted/i.test(doc.all[i].text) || !/Fees/i.test(doc.all[i].text)) continue;
        for (let j = i + 1; j < Math.min(doc.all.length, i + 60); j++) {
          if (/^Total\b/i.test(doc.all[j].text)) { const m = tokens(doc.all[j].text).filter(t => t.k === 'money' && t.v < 0); if (m.length) add(96, { value: m[0].v, line: j, src: doc.all[j].text }, 'Summary by day fees'); break; }
        }
        break;
      }
    }
    if (fam === 'toast') {
      const row = totalRowAfter(doc, /Card Processing/i, /^Total\b/i, 25);
      if (row) {
        const m = tokens(row.src).filter(t => t.k === 'money').map(t => t.v);
        if (m.length >= 4) add(97, { value: m[2] + m[3], line: row.line, src: row.src }, 'Toast fees collected + adjustments');
      }
    }
    if (fam === 'usbank') lab(/Total Charges and Fees\b/i, 100);
    if (fam === 'worldpay') lab(/Total Fees For Billing Period/i, 100);
    if (fam === 'worldpay_ip') {
      // Total fees = interchange & Worldpay fees + other fees + discount + the card-type processing fees
      const one = re => valueAfterLabel(doc, re, { nextLine: false })[0];
      const ic = one(/^Total Interchange and Worldpay Fees\b/i), other = one(/^Total Other \S+ \|/i), disc = one(/^Discount Collected\b/i);
      const row = worldpayIpTotal(doc);
      const proc = row ? tokens(row.src).filter(t => t.k === 'money').pop() : null;
      const comp = ic && other ? r2(ic.value + other.value + (disc ? disc.value : 0) + (proc && proc.v !== row.amount ? proc.v : 0)) : null;
      const total = one(/^Total Fees \|/i);
      if (total && (comp == null || Math.abs(total.value - comp) <= comp * 0.005)) add(100, total, 'Total fees');
      else if (total) add(90, total, 'Total fees');
      if (comp != null) add(98, { value: comp, line: ic.line, src: [ic.src, other.src, disc && disc.src, proc && row.src].filter(Boolean).join(' + ') }, 'Fee section totals');
    }
    if (fam === 'spoton') lab(/^TOTAL FEES\b/i, 100);
    if (fam === 'square') lab(/^Fees \|/i, 100, { nextLine: false });
    if (fam === 'shift4') {
      const a = valueAfterLabel(doc, /TOTAL PROCESSING SERVICE FEES APPLIED/i)[0];
      const b = valueAfterLabel(doc, /ADDITIONAL SERVICES FEE TOTAL/i)[0];
      if (a) add(100, { value: a.value + (b ? b.value : 0), line: a.line, src: a.src + (b ? ' + ' + b.src : '') }, 'Processing + additional services fees');
    }
    [
      [/Total Monthly Fees\b/i, 85], [/Total Fees For Billing Period/i, 85], [/Total Card Fees\b/i, 84], [/Total Charges and Fees\b/i, 84], [/\bTotal Fees( Charged| Paid| Assessed)?\b(?! Due)/i, 80],
      [/\bFees Charged\b/i, 78], [/Total (Processing )?Charges\b/i, 70], [/Amount Total:/i, 70], [/Total Amount (Deducted|Charged)/i, 55], [/Amount Deducted\b/i, 45]
    ].forEach(([re, sc]) => lab(re, sc, { lookahead: 1, notRe: /Net Fees|Fees Due|pending/i }));
    return c;
  }

  function extractTransactions(doc, volumeHit) {
    if (volumeHit && volumeHit.count) return { value: volumeHit.count, src: volumeHit.src };
    const labels = [/Transaction Count\b/i, /Total (# of )?(Items|Transactions)\b/i, /Number of (Sales|Transactions)\b/i, /# of Transactions\b/i];
    for (const re of labels) {
      for (let i = 0; i < doc.all.length; i++) {
        const l = doc.all[i];
        const m = re.exec(l.text);
        if (!m) continue;
        let v = firstOf(tokens(l.text.slice(m.index + m[0].length)), 'int');
        if (v == null && doc.all[i + 1]) v = firstOf(tokens(doc.all[i + 1].text), 'int');
        if (v) return { value: v, src: l.text };
      }
    }
    const vol = volumeHit && volumeHit.value;
    if (vol) {
      const avg = valueAfterLabel(doc, /Avg\.? Ticket( Size)?\b|Average Ticket\b/i, { lookahead: 1 })[0];
      if (avg && avg.value > 0 && avg.value < vol) return { value: Math.round(vol / avg.value), src: avg.src + ' (volume ÷ average ticket)', derived: true };
    }
    return null;
  }

  // ───────────────────────── Merchant name & address ─────────────────────────
  const STATES = { alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY' };
  const STATE_NAMES = Object.keys(STATES).sort((a, b) => b.length - a.length).join('|');
  const CITY_RE = new RegExp("^([A-Za-z][A-Za-z .'\\-]{1,40}?),?\\s+([A-Z]{2}|" + STATE_NAMES + "),?\\s+(\\d{5})(?:-{1,2}\\d{0,4})?\\b", 'i');
  const stateAbbr = s => (s.length === 2 ? s.toUpperCase() : STATES[s.toLowerCase()] || s);
  const STREET_RE = /^(\d{1,6}[A-Z]?\s+[A-Za-z0-9#.,'\- ]{2,60}|P\.?\s?O\.?\s+BOX\s+\d+.*)$/i;
  const PROC_WORDS = /payroc|paysafe|fiserv|first data|\bclover\b|\btoast\b|spoton|shift4|commerce ?control|ecrypt|wholesale payments|merchant servic|elavon|\bus bank|u\.s\. bank|worldpay|heartland|global payments|\btsys\b|\bsquare\b|\bstripe\b|merchant one|appstar|bancard|payments inc|c\/o |\bbank\b|customer service|www\.|\.com\b|p\.?o\.? box \d+ (charlotte|pmb)|remit/i;
  const PERSONISH = /^[A-Z][A-Za-z'.-]+(\s+[A-Z]\.?)?\s+[A-Z][A-Za-z'.-]+$/;
  const BIZ_WORDS = /\b(inc|llc|l\.l\.c|corp|co|company|ltd|group|store|shop|cafe|café|restaurant|grill|bar|auto|market|supply|services?|repair|towing|furniture|salon|spa|smoke|vape|liquor|wine|meat|grocery|bbq|pizza|taco|trailers?|gallery|gifts?|souvenirs|wash|gardens?|pool|tan|trucks?|outfitters|zone|packing|discounts?|stereo|wheels|general|squared|inspections|cantina|hookah|appliances)\b/i;

  function cleanName(s) {
    return String(s || '')
      .replace(/^COLR\w*\s*/i, '').replace(/^\d{3,4}\s+\d{3,4}\s+\d{3}/, '')  // Fiserv mailing barcode prefix
      .replace(/^(DBA( Name)?|Merchant( Name)?|Business Name|Legal Name|Bill to)\s*:\s*/i, '')
      .replace(/([A-Za-z.)])\d{4,7}$/, '$1')                                     // account number glued to the name
      .replace(/\s{2,}/g, ' ').replace(/[|·]+$/, '').trim();
  }
  function titleCase(s) {
    if (!s || /[a-z]/.test(s)) return s;
    return s.toLowerCase().replace(/(^|[\s(\/&-])([a-z])/g, (m, a, b) => a + b.toUpperCase())
      .replace(/'S\b/g, "'s").replace(/\b(Llc|Inc|Dba|Usa|Ii|Iii|Bbq|Po|Tx|Fm)\b/g, m => m.toUpperCase());
  }
  const titleCaseKeep = s => (/[a-z]/.test(s) ? s : titleCase(s));
  // label lines (OCR often drops the space: "CustomerService", "MerchantNumber")
  const STOP_LINE = /^(statement|page\b|\w?erchant ?(number|nbr|#|id)|customer ?service|phone|www\.|https?:|summary|processing|bank ?number|routing|deposit|association|amount|details|period|issue|payment|billing|product|account|client|store|chain|cycle|parent|principal|month|this ?is|your|website|united states|have a question|open a|or call|\$|\(?\d{3}\)?[ .-]\d{3}-\d{4})/i;
  const isPerson = t => PERSONISH.test(t) && !BIZ_WORDS.test(t);
  const isStreet = t => STREET_RE.test(t) && !CITY_RE.test(t) && !/^\d+\s*(of|\/)\s*\d+$/i.test(t) && !/^\d{1,2}\/\d{1,2}/.test(t) &&
    !/^\d[\d\s,.$%-]*$/.test(t) && !/\bPAGE\b|\bOF\s+\d/i.test(t) && !/\d{5,}\s+\d{5,}/.test(t) && /[A-Za-z]{2,}/.test(t.replace(/^\d+\s*/, ''));

  function extractMerchant(doc, fam) {
    const res = { name: null, legal_name: null, address: null, src: null };
    const pageLines = pi => doc.all.filter(l => l.page === pi);
    let lines = pageLines(0);
    if (lines.length < 12 || !lines.some(l => CITY_RE.test(l.segs[0] ? l.segs[0].t : ''))) lines = lines.concat(pageLines(1));
    const stream = [];
    lines.forEach((l, li) => l.segs.forEach((s, si) => stream.push({ t: cleanName(s.t) || s.t, raw: s.t, x: s.x, y: l.y, pg: l.page, li, si, w: l.width })));
    // A suite number wrapped onto the city line ("…Main St Suite" / "#200 Springfield, TX 75001") belongs to the street
    stream.forEach((sg, i) => {
      const m = /^(#\s?\w+|(?:Suite|Ste|Unit|Apt)\.?\s+#?\w+),?\s+(.+)$/i.exec(sg.t);
      if (!m || !CITY_RE.test(m[2])) return;
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        if (!isStreet(stream[j].t)) continue;
        stream[j].t += ' ' + m[1]; sg.t = m[2];
        break;
      }
    });
    const left = stream.filter(s => s.x < s.w * 0.58);
    const fmtAddr = (street, city) => titleCaseKeep(street.replace(/,\s*$/, '')) + ', ' + city;
    const cityOf = (seg, prev) => {
      let m = CITY_RE.exec(seg.t);
      if (m && (m[2].length > 2 || m[2] === m[2].toUpperCase())) return titleCaseKeep(m[1].trim()) + ', ' + stateAbbr(m[2]) + ' ' + m[3];
      m = /^([A-Z]{2}),?\s+(\d{5})(?:-\d{4})?$/.exec(seg.t);
      if (m && prev && /^[A-Za-z][A-Za-z .'-]{2,30}$/.test(prev.t) && !STOP_LINE.test(prev.t)) return titleCaseKeep(prev.t) + ', ' + m[1] + ' ' + m[2];
      return null;
    };
    // Find street + city after index i (within a few segments) in a segment list
    const addressAfter = (list, i, span) => {
      for (let a = i; a < Math.min(list.length, i + (span || 6)); a++) {
        if (!isStreet(list[a].t)) continue;
        for (let b = a + 1; b < Math.min(list.length, a + 4); b++) {
          const c = cityOf(list[b], list[b - 1]);
          if (c) return { street: list[a].t, city: c, end: b };
        }
      }
      return null;
    };

    // 1) Fiserv mailing block: "[owner] / COLR637F 1101 8888 124<BUSINESS or STREET> / street / city" + "Location:" block
    if (fam === 'fiserv') {
      const ci = stream.findIndex(s => /^COLR\w*/i.test(s.raw));
      if (ci >= 0) {
        const colr = stream[ci];
        const rest = cleanName(colr.raw);
        const prevLine = stream.filter(s => s.li === colr.li - 1)[0];
        const nextLine = stream.filter(s => s.li === colr.li + 1)[0];
        let biz = null, owner = null;
        if (rest && isStreet(rest)) { biz = prevLine && prevLine.t; }
        else if (rest && /[A-Za-z]{2}/.test(rest)) { biz = rest; owner = prevLine && prevLine.t; }
        else { biz = nextLine && nextLine.t; owner = prevLine && prevLine.t; }
        if (biz && /[A-Za-z]{2}/.test(biz) && !STOP_LINE.test(biz)) { res.legal_name = cleanName(biz); res.src = colr.raw; }
        const mail = addressAfter(left, left.findIndex(s => s.li >= colr.li), 8);
        const loc = stream.findIndex(s => /^Location:?$/i.test(s.t));
        let locAddr = null, dba = null;
        if (loc >= 0) {
          const after = stream.slice(loc + 1, loc + 9);
          locAddr = addressAfter(after, 0, 6);
          const names = after.slice(0, locAddr ? after.findIndex(s => s.t === locAddr.street) : 3)
            .filter(s => /[A-Za-z]{3}/.test(s.t) && !STOP_LINE.test(s.t) && !/^\d/.test(s.t) && !/PAGE \d+ OF/i.test(s.t));
          dba = (names.find(n => (!owner || n.t !== cleanName(owner)) && n.t !== cleanName(biz || '')) || names.find(n => !owner || n.t !== cleanName(owner)) || {}).t || null;
        }
        res.name = titleCaseKeep(dba || res.legal_name || '') || null;
        if (res.legal_name) res.legal_name = titleCaseKeep(res.legal_name);
        if (res.legal_name === res.name) res.legal_name = null;
        const a = locAddr || mail;
        if (a) res.address = fmtAddr(a.street, a.city);
        if (res.name && res.address) return res;
      }
    }
    // 2) Explicit labels
    const labelled = [
      [/^DBA(?: NAME)?\s*:\s*(.+)$/i, 'inline'], [/^DBA(?: NAME)?\s*:?\s*$/i, 'next'],
      [/^Merchant Name\s*:\s*(.+)$/i, 'inline'], [/^Merchant Name\s*:?\s*$/i, 'next'],
      [/^Merchant\s*:\s*(.+)$/i, 'inline'], [/^Merchant\s*:?\s*$/i, 'next'], [/^Bill to$/i, 'nextline'], [/^Business Name\s*:?\s*(.+)$/i, 'inline']
    ];
    let labelIdx = -1;
    outer: for (const [re, mode] of labelled) {
      for (let i = 0; i < stream.length; i++) {
        const m = re.exec(stream[i].raw);
        if (!m) continue;
        let v = null;
        if (mode === 'inline') v = m[1];
        else if (mode === 'nextline') { const n = stream.find(s => s.li === stream[i].li + 1); v = n && n.t; }
        else {
          const cands = stream.slice(i + 1, i + 6).filter(s => /[A-Za-z]{2}/.test(s.t) && !isStreet(s.t) && !cityOf(s, null) && !STOP_LINE.test(s.t) && !/:$|^(merchant|address)\b/i.test(s.t));
          const li0 = stream[i].li;
          cands.sort((a, b) => (a.li - li0) - (b.li - li0) || Math.abs(a.x - stream[i].x) - Math.abs(b.x - stream[i].x));
          v = cands[0] && cands[0].t;
        }
        v = cleanName(v);
        if (v && /[A-Za-z]{2}/.test(v) && !STOP_LINE.test(v) && !/^\d/.test(v)) { res.name = titleCaseKeep(v.replace(/\s+-\s+\d+.*$/, '')); res.src = stream[i].raw; labelIdx = i; break outer; }
      }
    }
    // 3) Address blocks — street and name lines sit left-aligned above the city/state/zip line
    const blocks = [];
    const SKIP_LABEL = /^((Location|Mailing|Merchant|Business|Physical)\s+)?address:?$|^Location:?$/i;
    const aligned = (i, x, maxBack) => {
      const out = [];
      const li0 = stream[i].li;
      for (let j = i - 1; j >= 0 && stream[j].li >= li0 - maxBack; j--) if (Math.abs(stream[j].x - x) < 28 && stream[j].li < li0) out.push(j);
      return out;  // nearest first
    };
    for (let i = 0; i < stream.length; i++) {
      if (stream[i].x > stream[i].w * 0.72) continue;
      let city = cityOf(stream[i], null);
      let cityIdx = i;
      if (!city) {
        const up = aligned(i, stream[i].x, 1)[0];
        city = up != null ? cityOf(stream[i], stream[up]) : null;
        if (!city) continue;
        cityIdx = up;
      }
      const cand = aligned(cityIdx, stream[cityIdx].x, 4);
      const k = cand.find(j => isStreet(stream[j].t));
      if (k == null) continue;
      const names = [];
      let procAbove = false;
      // the name lines sit right above the street; a big vertical gap means a logo or header, not the name
      const lineGap = Math.abs(stream[k].y - stream[cityIdx].y);
      let prevY = stream[k].y;
      for (const n of aligned(k, stream[k].x, 5)) {
        const t = stream[n].t;
        if (names.length >= 3) break;
        if (lineGap > 0 && stream[n].pg === stream[k].pg && stream[n].y - prevY > lineGap * 2.6) break;
        prevY = stream[n].y;
        if (SKIP_LABEL.test(t) || (isStreet(t) && t === stream[k].t)) continue;
        if (!t || cityOf(stream[n], null) || STOP_LINE.test(t) || /:$/.test(t) || !/[A-Za-z]{2}/.test(t) || /^\d{1,2}\/\d{1,2}/.test(t)) break;
        if (PROC_WORDS.test(t)) { procAbove = true; break; }
        names.push({ t });
      }
      const near = [stream[k].t, stream[cityIdx].t, names[0] ? names[0].t : ''].join(' ');
      let score = 10;
      if (PROC_WORDS.test(near) || (procAbove && names.length < 2)) score -= 25;
      if (/^p\.?\s?o\.?\s+box/i.test(stream[k].t) && /(charlotte|pmb)/i.test(near)) score -= 20;
      const ctxAbove = aligned(k, stream[k].x, 3).map(j => stream[j].raw).join(' ');
      if (/Location|Bill to|Merchant Address|Address:|DBA/i.test(ctxAbove)) score += 8;
      if (names.some(n => BIZ_WORDS.test(n.t))) score += 5;
      if (names.length) score += 3;
      const below = stream.find(s => s.li > stream[i].li && Math.abs(s.x - stream[i].x) < 28);
      if (below && /^\(?\d{3}\)?[ .-]?\d{3}-\d{4}|^Customer Service/i.test(below.raw)) score -= 12;   // processor/ISO header: phone right under the address
      else if (below && /^United States$/i.test(below.raw) && !names.length) score -= 6;
      blocks.push({ score, street: stream[k].t, city, names, idx: i });
    }
    // Inline "Address: 150 BENITO ST, SOLEDAD CA 93960"
    stream.forEach((s, i) => {
      const inline = /^(?:Merchant )?Address\s*:\s*(.+)$/i.exec(s.raw);
      const labelOnly = /^(?:Merchant )?Address\s*:?$/i.test(s.raw);
      if (!inline && !labelOnly) return;
      const v = inline ? inline[1] : (stream[i + 1] ? stream[i + 1].t : '');
      const m = /^(.+?),\s*([A-Za-z .'-]+?),?\s+([A-Z]{2}),?\s+(\d{5})/.exec(v);
      if (m) { blocks.push({ score: 30, street: m[1], city: titleCaseKeep(m[2]) + ', ' + m[3] + ' ' + m[4], names: [], idx: i }); return; }
      if (isStreet(v)) {
        for (let b = i + 1; b < Math.min(stream.length, i + 6); b++) { const c = cityOf(stream[b], stream[b - 1]); if (c) { blocks.push({ score: 28, street: v, city: c, names: [], idx: i }); return; } }
      }
      const a = addressAfter(stream, i + 1, 6);
      if (a) blocks.push({ score: 28, street: a.street, city: a.city, names: [], idx: i });
    });
    blocks.sort((a, b) => b.score - a.score || a.idx - b.idx);
    const best = blocks.find(b => b.score > 0);
    if (best) {
      res.address = fmtAddr(best.street, best.city);
      if (!res.name && best.names.length) {
        const ordered = best.names.slice().reverse().filter(n => !/^attn/i.test(n.t));
        const biz = ordered.find(n => BIZ_WORDS.test(n.t)) || ordered.find(n => !isPerson(n.t)) || ordered[0];
        if (biz) { res.name = titleCaseKeep(biz.t); res.src = biz.t; }
        const legal = ordered.find(n => n !== biz && /\b(llc|inc|corp|l\.l\.c)\b/i.test(n.t));
        if (legal) res.legal_name = titleCaseKeep(legal.t);
      }
    }
    return res;
  }

  // ───────────────────────── Card mix ─────────────────────────
  const FEE_WORDS = /fee|assess|interchange|discount|auth|network|dues|surcharge|total|chargeback|adjust|refund|return|batch|deposit|amount|average|rate/i;
  function classifyCard(name) {
    const n = String(name).trim().replace(/^\d{6,}\s+/, '');
    const u = n.toUpperCase();
    if (!n || n.length > 48 || FEE_WORDS.test(n)) return null;
    if (/^(\d|\*)/.test(n)) return null;
    let brand = null, type = 'unknown';
    const sale = /,\s*(Visa|MasterCard|Discover|American Express|Amex|Pin Debit)\s*,\s*(Credit|Debit|Prepaid)/i.exec(n);
    if (sale) { brand = /pin/i.test(sale[1]) ? 'pin_debit' : sale[1]; type = sale[2]; }
    else if (/^Authorization:/i.test(n)) return null;
    else if (/^(EB|EBT)\b/.test(u)) { brand = 'ebt'; type = 'debit'; }
    else if (/^(VS|VB|VL|VISA)\b|^VISA|^VI\b/.test(u)) brand = 'visa';
    else if (/^VD$/.test(u)) { brand = 'visa'; type = 'debit'; }
    else if (/^(MC|MB|ML|M\/C|MASTERCARD|MASTER CARD)\b|^MASTERCARD|^M\/C$/.test(u)) brand = 'mastercard';
    else if (/^MD$/.test(u)) { brand = 'mastercard'; type = 'debit'; }
    else if (/^(DS|DZ|DCVR|DISCOVER|DISC)\b|^DISCOVER|^DCVR/.test(u)) brand = 'discover';
    else if (/^(DD|DJ)$/.test(u)) { brand = 'discover'; type = 'debit'; }
    else if (/^(AM|AX|AEXP|AMEX|AMERICAN EXPRESS)\b|^AMEX|^AMERICAN EXP/.test(u)) brand = 'amex';
    else if (/^DEBIT CARD\b/.test(u)) { brand = 'pin_debit'; type = 'debit'; }
    else if (/^(DB|PIN DEBIT|DEBIT|INTERLINK|INLK|STAR|PULSE|PULS|NYCE|MAESTRO|ACCEL|ACCL|SHAZAM|JEANIE|AFFN|CU24)\b|\(PIN DEBIT\)/.test(u)) { brand = 'pin_debit'; type = 'debit'; }
    else if (/^V\/MC\/D\b|^V\/MC\b/.test(u)) brand = 'visa_mc_discover';
    else if (/^(JC|JCB|DINERS|DC)\b/.test(u)) brand = 'other';
    if (!brand) return null;
    brand = brand.toLowerCase().replace('american express', 'amex');
    if (type === 'unknown') {
      if (/DEBIT|CHECK|\(SIG\)|\bDB\b/.test(u) && brand !== 'pin_debit') type = 'debit';
      else if (/PREPAID|\(PP\)/.test(u)) type = 'debit';
      else if (/CREDIT|BUSINESS|COMMERCIAL|CORP/.test(u)) type = 'credit';
    }
    return { brand, type: type.toLowerCase().replace('prepaid', 'debit') };
  }

  function extractCardMix(doc, volume) {
    const rows = [];
    doc.all.forEach((l, i) => {
      if (/^\d{1,2}\/\d{1,2}/.test(l.text)) return;
      const first = l.segs[0] ? l.segs[0].t : l.text;
      const cls = classifyCard(first);
      if (!cls) return;
      const toks = tokens(l.text.slice(first.length));
      const ca = countAndAmount(toks);
      if (!ca || ca.amount < 0) return;
      rows.push(Object.assign({ line: i, name: first }, cls, { count: ca.count, volume: ca.amount }));
    });
    // group into runs of nearby rows (a table may continue past a page break or interleave other rows)
    const runs = [];
    rows.forEach(r => {
      const last = runs[runs.length - 1];
      const prev = last && last[last.length - 1];
      const between = prev ? doc.all.slice(prev.line + 1, r.line) : [];
      const joinable = prev && r.line - prev.line <= 14 && !between.some(l => /^(Total|Totals|Sub-?Total|\*\*)\b/i.test(l.text) && tokens(l.text).some(t => t.k === 'money'));
      if (joinable) last.push(r); else runs.push([r]);
    });
    const sum = run => run.reduce((a, r) => a + r.volume, 0);
    let best = null;
    if (volume) {
      const close = runs.filter(run => Math.abs(sum(run) - volume) / volume < 0.03);
      best = close[0] || null;
      if (!best) {
        const under = runs.filter(run => run.length >= 2 && sum(run) <= volume * 1.03);
        under.sort((a, b) => sum(b) - sum(a));
        best = under[0] || null;
      }
    } else best = runs.find(run => run.length >= 2) || null;
    if (!best) return [];
    // Brand rows without explicit type become credit when the same brand has a debit row
    const hasDebit = b => best.some(r => r.brand === b && r.type === 'debit');
    const agg = {};
    best.forEach(r => {
      let type = r.type;
      if (type === 'unknown' && hasDebit(r.brand)) type = 'credit';
      const k = r.brand + '|' + type;
      agg[k] = agg[k] || { brand: r.brand, type, volume: 0, count: 0 };
      agg[k].volume = r2(agg[k].volume + r.volume);
      agg[k].count += r.count;
    });
    return Object.values(agg).filter(r => r.volume > 0 || r.count > 0);
  }

  // ───────────────────────── Interchange lines ─────────────────────────
  function inferBrandFromName(name, fallback) {
    const u = String(name).toUpperCase();
    if (/^VI[- ]|^VISA\b|^VS[- ]/.test(u)) return 'visa';
    if (/^MC[- ]|^MASTERCARD\b|^MASTER CARD/.test(u)) return 'mastercard';
    if (/^DS[- ]|^DSCVR|^DISCOVER|^DCVR|^DISC[- ]/.test(u)) return 'discover';
    if (/^AM[- ]|^AMEX|^AMERICAN EXP/.test(u)) return 'amex';
    return fallback || null;
  }
  function inferTypeFromName(name) {
    const u = String(name).toUpperCase();
    return /\(DB\)|\(PP\)|DEBIT|CHECK CARD|PREPAID|REGULATED|\bREG\b|\bDB\b/.test(u) ? 'debit' : 'credit';
  }

  function extractInterchangeLines(doc, table) {
    const out = [];
    const seen = new Set();
    let sectionBrand = null, inSection = false;
    doc.all.forEach(l => {
      const t = l.text;
      const hb = /^(Visa|MasterCard|Mastercard|Discover|Amex OptBlue|Amex|Debit)\s+Interchange\b/i.exec(t);
      if (hb) { sectionBrand = inferBrandFromName(hb[1]) || (/debit/i.test(hb[1]) ? 'pin_debit' : null); inSection = true; return; }
      if (/^(MASTERCARD|VISA|DISCOVER|AMERICAN EXPRESS|DEBIT CARD)$/i.test(t)) { sectionBrand = inferBrandFromName(t) || null; return; }
      if (/^(Sub-?Total|Total|Grand Total)\b/i.test(t) || /\bTOTAL\s*\|/i.test(t)) { if (!/Interchange/i.test(t)) inSection = inSection && !/^Total/i.test(t); }
      const name = l.segs[0] ? l.segs[0].t : '';
      if (!name || /^\d/.test(name) || name.length < 4) return;
      const toks = tokens(t.slice(name.length));
      const monies = toks.filter(x => x.k === 'money');
      if (monies.length < 2) return;
      const known = table ? findByName(table, name) : null;
      const looksIC = known || /^(VI|MC|DS|DSCVR|DISC)[- ]/i.test(name) || (inSection && /[a-z]{3}/i.test(name));
      if (!looksIC || FEE_WORDS.test(name.replace(/interchange/i, '')) && !known) return;
      const ints = toks.filter(x => x.k === 'int');
      const decs = toks.filter(x => x.k === 'dec');
      const volTok = monies.find(m => Math.abs(m.v) >= 1 && /\$|,/.test(m.raw)) || monies[0];
      const volume = Math.abs(volTok.v);
      const fee = Math.abs(monies[monies.length - 1].v);
      if (volume <= 0 || fee > volume * 0.2) return;
      const count = ints.length ? ints[0].v : null;
      let rate = null, item = null;
      const combo = toks.find(x => x.k === 'dec' && /\+/.test(x.raw));
      if (combo) { const p = combo.raw.split('+'); rate = parseFloat(p[0]) * 100; item = parseFloat(p[1]); }
      else if (decs.length) {
        rate = decs[0].v < 0.2 ? decs[0].v * 100 : null;
        const it = decs[1] || monies.find(m => m !== volTok && m !== monies[monies.length - 1] && Math.abs(m.v) < 5);
        item = it ? Math.abs(it.v) : null;
      }
      const key = name + '|' + volume + '|' + fee;
      if (seen.has(key)) return;
      seen.add(key);
      const brand = inferBrandFromName(name, sectionBrand);
      out.push({ name, brand, type: inferTypeFromName(name), volume, count, fee, rate, item, pc: null });
    });
    return out.filter(x => x.brand && x.brand !== 'pin_debit');
  }

  // ───────────────────────── Appendix G ─────────────────────────
  function loadTable(json) {
    if (!json) return null;
    if (Array.isArray(json)) return json;
    const cols = json.columns;
    return json.programs.map(r => { const o = {}; cols.forEach((c, i) => { o[c] = r[i]; }); o.norm = normName(o.name); return o; });
  }
  function normName(s) {
    return String(s || '').toUpperCase()
      .replace(/\bVI-|\bMC-|\bMC\s|\bDSCVR-|\bDS-/g, m => m.replace(/[-\s]/, ' '))
      .replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function findByName(table, name) {
    const n = normName(name);
    if (!n || n.length < 5) return null;
    return table.find(p => p.norm === n) || null;
  }
  const STOP = new Set(['VI', 'MC', 'DS', 'DSCVR', 'THE', 'AND', 'OF', 'US', 'U', 'S']);
  const SYN = { CHECK: 'DB', DEBIT: 'DB', PREPAID: 'PP', REG: 'REGULATED', TRAD: 'TRADITIONAL', RWDS: 'REWARDS', RWD: 'REWARDS', PRF: 'PREF', PREFERRED: 'PREF', SIGN: 'SIGNATURE', SIG: 'SIGNATURE', BUS: 'BUSINESS', P2: 'PRODUCT2', P1: 'PRODUCT1', TR1: 'TIER1', TR2: 'TIER2', TR3: 'TIER3', TR4: 'TIER4', TR5: 'TIER5', TCKT: 'TICKET', TKT: 'TICKET', ECOMM: 'ECOMMERCE', ELEC: 'ELECTRONIC', KEY: 'KEYED', ENT: 'KEYED', ENTERED: 'KEYED' };
  function tokset(s) {
    const t = normName(s).replace(/PRODUCT (\d)/g, 'P$1').replace(/TIER (\d)/g, 'TR$1').split(' ').filter(w => w && !STOP.has(w)).map(w => SYN[w] || w);
    return new Set(t);
  }
  function similarity(a, b) {
    const A = tokset(a), B = tokset(b);
    if (!A.size || !B.size) return 0;
    let inter = 0; A.forEach(x => { if (B.has(x)) inter++; });
    return inter / (A.size + B.size - inter);
  }

  // Match a statement interchange line to an Appendix G program
  function matchProgram(table, line) {
    if (!table || !line) return null;
    const brand = line.brand, type = line.type;
    const pool = table.filter(p => (!brand || p.brand === brand));
    if (line.pc) {
      const byPc = pool.filter(p => p.pc === String(line.pc).toUpperCase());
      if (byPc.length === 1) return { program: byPc[0], method: 'code', confidence: 'high' };
      if (byPc.length > 1) {
        const pick = byPc.slice().sort((a, b) => similarity(line.name, b.name) - similarity(line.name, a.name))[0];
        return { program: pick, method: 'code', confidence: 'high' };
      }
    }
    const exact = pool.find(p => p.norm === normName(line.name));
    if (exact) return { program: exact, method: 'name', confidence: 'high' };
    let best = null, bestScore = 0;
    pool.forEach(p => {
      let s = similarity(line.name, p.name);
      if (type && p.type === type) s += 0.08;
      if (line.rate != null) s += Math.abs(p.rate - line.rate) < 0.006 ? 0.3 : -0.15;
      if (line.item != null && line.item > 0) s += Math.abs(p.item - line.item) < 0.006 ? 0.1 : -0.05;
      if (s > bestScore) { bestScore = s; best = p; }
    });
    if (best && bestScore >= 0.5) return { program: best, method: 'fuzzy', confidence: bestScore >= 0.75 ? 'medium' : 'low' };
    return null;
  }

  // ───────────────────────── Markup analysis ─────────────────────────
  // Default Appendix G programs used when a statement shows only a card-brand mix (card-present retail).
  // Calibrated against the sample statements that itemize interchange: premium rewards credit and
  // Durbin-regulated debit dominate real volume, so these land within a few percent of itemized cost.
  const DEFAULT_PROGRAMS = {
    'visa|credit': 'J58',        // VI-RETAIL P2 SIGN PRF INFSQ   2.10% + $0.10
    'visa|debit': 'N01',         // VI-US REGULATED (DB)          0.05% + $0.22
    'mastercard|credit': '097',  // MC-WORLDCARD MERIT III        1.90% + $0.10
    'mastercard|debit': 'N03',   // MC-REGULATED POS UST (DB)     0.05% + $0.21
    'discover|credit': '010',    // PSL - Retail (Rewards)        1.72% + $0.10
    'discover|debit': '737'      // DSCVR-PSLRETAILREG(DB)        0.05% + $0.22
  };
  const DEFAULT_ASSUMPTIONS = { assessPct: 0.14, assessItem: 0.02, amexRate: 1.60, amexItem: 0.10 };

  function defaultProgram(table, brand, type) {
    if (!table) return null;
    const key = brand + '|' + type;
    const pc = DEFAULT_PROGRAMS[key];
    return table.find(p => p.brand === brand && p.type === type && p.pc === pc) || table.find(p => p.brand === brand && p.type === type) || null;
  }
  function programOptions(table, brand, type) {
    if (!table) return [];
    return table.filter(p => p.brand === brand && (!type || type === 'unknown' || p.type === type));
  }

  function computeMarkup(input) {
    const table = input.table;
    const A = Object.assign({}, DEFAULT_ASSUMPTIONS, input.assumptions || {});
    const V = +input.volume || 0, T = +input.transactions || 0, F = +input.fees || 0;
    const overrides = input.overrides || {};
    let mix = (input.cardMix || []).filter(r => r && (r.volume > 0));
    let mixAssumed = false;
    if (!mix.length && V > 0) {
      mixAssumed = true;
      mix = [{ brand: 'visa', type: 'credit', volume: V * 0.6, count: Math.round(T * 0.6) }, { brand: 'visa', type: 'debit', volume: V * 0.4, count: T - Math.round(T * 0.6) }];
    }
    // Statements that don't separate credit from debit: assume half of each
    mix = [].concat.apply([], mix.map(r => (r.type === 'unknown' && ['visa', 'mastercard', 'discover', 'visa_mc_discover'].includes(r.brand))
      ? [Object.assign({}, r, { type: 'credit', volume: r.volume / 2, count: Math.round((r.count || 0) / 2), split: true }),
         Object.assign({}, r, { type: 'debit', volume: r.volume / 2, count: (r.count || 0) - Math.round((r.count || 0) / 2), split: true })]
      : [r]));
    const mixVol = mix.reduce((a, r) => a + r.volume, 0);
    const mixCnt = mix.reduce((a, r) => a + (r.count || 0), 0);
    const vScale = mixVol > 0 && V > 0 ? V / mixVol : 1;
    const cScale = mixCnt > 0 && T > 0 ? T / mixCnt : 1;

    // Itemized interchange lines matched to Appendix G
    const lines = (input.lines || []).map(l => {
      const m = matchProgram(table, l);
      const trueCost = m ? (m.program.rate / 100) * l.volume + m.program.item * (l.count || 0) : null;
      return Object.assign({}, l, { match: m, trueCost });
    });
    const matched = lines.filter(l => l.match);
    const icEligible = mix.filter(r => ['visa', 'mastercard', 'discover', 'visa_mc_discover'].includes(r.brand)).reduce((a, r) => a + r.volume, 0) * vScale;
    const matchedVol = matched.reduce((a, l) => a + l.volume, 0);
    const itemized = matched.length >= 3 && icEligible > 0 && matchedVol / icEligible >= 0.8;

    const rows = [];
    let icTrue = 0;
    if (itemized) {
      const trueSum = matched.reduce((a, l) => a + l.trueCost, 0);
      const remainder = Math.max(0, icEligible - matchedVol);
      const remCost = matchedVol > 0 ? remainder * (trueSum / matchedVol) : 0;
      icTrue = trueSum + remCost;
      matched.forEach(l => rows.push({ kind: 'line', label: l.name, brand: l.brand, type: l.type, volume: l.volume, count: l.count || 0, program: l.match.program, method: l.match.method, charged: l.fee, cost: l.trueCost }));
      if (remainder > 1) rows.push({ kind: 'remainder', label: 'Unitemized Visa/MC/Discover volume', volume: remainder, count: 0, cost: remCost, note: 'priced at the itemized blended rate' });
    }
    mix.forEach(r => {
      const vol = r.volume * vScale, cnt = Math.round((r.count || 0) * cScale);
      const key = r.brand + '|' + (r.type === 'unknown' ? 'credit' : r.type);
      if (r.brand === 'amex') {
        const cost = (A.amexRate / 100) * vol + A.amexItem * cnt;
        rows.push({ kind: 'amex', label: 'American Express', brand: 'amex', type: r.type, volume: vol, count: cnt, cost, note: 'Not in Appendix G — assumed ' + A.amexRate + '% + $' + A.amexItem.toFixed(2) });
        return;
      }
      if (itemized && ['visa', 'mastercard', 'discover', 'visa_mc_discover'].includes(r.brand)) return;
      let brand = r.brand, type = r.type === 'unknown' ? 'credit' : r.type;
      if (brand === 'ebt') { rows.push({ kind: 'ebt', label: 'EBT', brand: 'ebt', type: 'debit', volume: vol, count: cnt, cost: 0, note: 'No card interchange' }); return; }
      if (brand === 'pin_debit') { brand = 'visa'; type = 'debit'; }
      if (brand === 'visa_mc_discover' || brand === 'other') brand = 'visa';
      const ovKey = r.brand + '|' + r.type;
      let prog = null;
      if (overrides[ovKey]) prog = table.find(p => p.brand === brand && p.pc === overrides[ovKey]) || null;
      if (!prog) prog = defaultProgram(table, brand, type);
      const cost = prog ? (prog.rate / 100) * vol + prog.item * cnt : 0;
      icTrue += cost;
      rows.push({ kind: 'bucket', key: ovKey, label: bucketLabel(r) + (r.split ? ' (est. 50%)' : ''), brand: r.brand, type: r.type, volume: vol, count: cnt, program: prog, cost, programBrand: brand, programType: type,
        note: r.split ? 'Statement does not split credit/debit — assumed 50/50' : null });
    });
    const amexCost = rows.filter(r => r.kind === 'amex').reduce((a, r) => a + r.cost, 0);
    const assess = (A.assessPct / 100) * V + A.assessItem * T;
    const trueCost = icTrue + amexCost + assess;
    const markup = F - trueCost;
    const chargedIC = matched.filter(l => l.fee != null).reduce((a, l) => a + l.fee, 0);
    const trueMatched = matched.reduce((a, l) => a + l.trueCost, 0);
    return {
      mode: itemized ? 'itemized' : 'estimated', mixAssumed, rows, assumptions: A,
      interchange: r2(icTrue), amex: r2(amexCost), assessments: r2(assess), trueCost: r2(trueCost),
      fees: r2(F), volume: V, transactions: T, markup: r2(markup),
      markupPct: V > 0 ? markup / V * 100 : 0, trueCostPct: V > 0 ? trueCost / V * 100 : 0, feesPct: V > 0 ? F / V * 100 : 0,
      markupShare: F > 0 ? markup / F * 100 : 0,
      linesMatched: matched.length, linesTotal: lines.length,
      interchangePadding: itemized && chargedIC > 0 ? r2(chargedIC - trueMatched) : null
    };
  }
  function bucketLabel(r) {
    const b = { visa: 'Visa', mastercard: 'Mastercard', discover: 'Discover', amex: 'American Express', pin_debit: 'PIN Debit', visa_mc_discover: 'Visa / MC / Discover', other: 'Other cards' }[r.brand] || r.brand;
    if (r.brand === 'pin_debit') return b;
    return b + (r.type === 'credit' ? ' Credit' : r.type === 'debit' ? ' Debit' : '');
  }

  // ───────────────────────── Main entry ─────────────────────────
  function parseStatement(pages, opts) {
    opts = opts || {};
    const doc = makeDoc(pages);
    const textChars = doc.full.replace(/\s/g, '').length;
    const result = {
      source: 'device', family: null, processor: null, merchant_name: null, legal_name: null, address: null, mid: null, statement_period: null,
      volume: null, transactions: null, total_fees: null, card_mix: [], interchange_lines: [], evidence: {}, warnings: [], textChars
    };
    if (textChars < 80) { result.warnings.push('No readable text in this file (it looks like a scan or photo).'); return result; }
    const fam = detectFamily(doc.full);
    result.family = fam;
    result.processor = detectProcessor(doc.full) || (fam === 'square' ? 'Square' : null);

    const volC = extractVolume(doc, fam);
    const feeC = extractFees(doc, fam);
    // choose volume first by score, then fees validated against it; retry volume if the ratio is implausible
    volC.sort((a, b) => b.score - a.score || a.line - b.line);
    let vol = null, fee = null;
    for (const v of volC.slice(0, 6)) {
      const f = pickBest(feeC, v.value);
      if (f && f.value / v.value > 0.002 && f.value / v.value < 0.15) { vol = v; fee = f; break; }
    }
    if (!vol) { vol = volC[0] || null; fee = pickBest(feeC, vol && vol.value); }
    if (vol) { result.volume = r2(vol.value); result.evidence.volume = vol.src; }
    if (fee) { result.total_fees = r2(fee.value); result.evidence.total_fees = fee.src; }
    const tx = extractTransactions(doc, vol);
    if (tx) { result.transactions = tx.value; result.evidence.transactions = tx.src; }

    const mer = extractMerchant(doc, fam);
    result.merchant_name = mer.name; result.legal_name = mer.legal_name; result.address = mer.address;
    if (mer.src) result.evidence.merchant_name = mer.src;

    const mid = /Merchant (?:Number|#|ID)\s*:?\s*\|?\s*([xX*\d][\dxX* ]{5,24}\d)/i.exec(doc.full) || /Billing Account(?: Number)?\s*\|?\s*(\d{8,20})/i.exec(doc.full);
    if (mid) result.mid = mid[1].replace(/\s+/g, '');
    const per = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/.exec(doc.full) || /Summary for ([A-Z][a-z]{2} \d{2}, \d{4} - [A-Z][a-z]{2} \d{2}, \d{4})/.exec(doc.full) || /(?:Processing Month|Statement for the month|MONTH ENDING|STATEMENT FOR)\s*:?\s*\|?\s*([A-Za-z0-9\/ -]{4,20}\d)/i.exec(doc.full);
    if (per) result.statement_period = per[2] ? per[1] + ' – ' + per[2] : per[1].trim();

    result.card_mix = extractCardMix(doc, result.volume);
    if (opts.table) result.interchange_lines = extractInterchangeLines(doc, opts.table);

    const net = valueAfterLabel(doc, /Net Charges and Fees\b/i)[0];
    if (net && result.total_fees && Math.abs(net.value - result.total_fees) > 0.5) result.warnings.push('Statement also shows net charges of $' + net.value.toFixed(2) + ' after rebates — adjust Statement Fees if you want to compare net cost.');
    if (result.volume === 0) result.warnings.push('Statement shows $0 in sales for this period.');
    if (result.volume == null) result.warnings.push('Could not find the total sales volume.');
    if (result.total_fees == null) result.warnings.push('Could not find the total fees charged.');
    if (result.transactions == null) result.warnings.push('Could not find the number of transactions.');
    if (!result.merchant_name) result.warnings.push('Could not find the merchant name.');
    if (!result.address) result.warnings.push('Could not find the merchant address.');
    return result;
  }

  return {
    buildPageLines, buildPageLinesFromOcr, ocrQuality, normalizeOcrWord, tokens, parseMoney, parseStatement, detectFamily,
    loadTable, normName, matchProgram, similarity, computeMarkup, defaultProgram, programOptions, bucketLabel, titleCase: titleCaseKeep,
    DEFAULT_ASSUMPTIONS, DEFAULT_PROGRAMS
  };
});
