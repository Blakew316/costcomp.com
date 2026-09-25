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
    // a leading "|" that can only be a 1: "|,250.00" → 1,250.00, "|00.00" → 100.00
    s = s.replace(/^([$S§]?)\|(?=,\d{3}|0\d)/, '$11');
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
      // The printed Total Fees wins. When OCR garbles it, rebuild it from the fee sections:
      // interchange & Worldpay fees + other fees + discount + the card-type processing-fee column
      const one = re => valueAfterLabel(doc, re, { nextLine: false })[0];
      const total = one(/^Total Fees \|/i);
      if (total) add(100, total, 'Total fees');
      else {
        const ic = one(/^Total Interchange and Worldpay Fees\b/i), other = one(/^Total Other \S+ \|/i), disc = one(/^Discount Collected\b/i);
        const row = worldpayIpTotal(doc);
        const hi = row ? doc.all.slice(Math.max(0, row.line - 12), row.line).map(l => l.text).join(' ') : '';
        const proc = row && /Processing|Fees/i.test(hi) ? tokens(row.src).filter(t => t.k === 'money').pop() : null;
        if (ic && other) add(95, { value: r2(ic.value + other.value + (disc ? disc.value : 0) + (proc && proc.v !== row.amount ? proc.v : 0)), line: ic.line, src: [ic.src, other.src, disc && disc.src, proc && row.src].filter(Boolean).join(' + ') }, 'Fee section totals');
      }
    }
    if (fam === 'spoton') lab(/^TOTAL FEES\b/i, 100);
    if (fam === 'square') lab(/^Fees \|/i, 100, { nextLine: false });
    if (fam === 'shift4') {
      const a = valueAfterLabel(doc, /TOTAL PROCESSING SERVICE FEES APPLIED/i)[0];
      const b = valueAfterLabel(doc, /ADDITIONAL SERVICES FEE TOTAL/i)[0];
      // The detail section repeats that total; trust it when they differ (OCR reads "$25.00" as "525.00")
      const d = doc.all.findIndex(l => /ADDITIONAL SERVICES DETAIL/i.test(l.text));
      const detRow = d >= 0 ? doc.all.slice(d + 1, d + 20).find(l => /^ADDITIONAL SER.*TOTAL|^TOTAL\b/i.test(l.text)) : null;
      const detTotal = detRow ? tokens(detRow.text).filter(t => t.k === 'money').pop() : null;
      if (b && detTotal && Math.abs(detTotal.v - b.value) > 0.005) { b.value = Math.abs(detTotal.v); b.src += ' → ' + detRow.text; }
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
  const STREET_RE = /^(\d{1,6}(-\d{1,6})?[A-Z]?\s+[A-Za-z0-9#.,'\- ]{2,60}|P\.?\s?O\.?\s+BOX\s+\d+.*)$/i;
  const PROC_WORDS = /payroc|paysafe|fiserv|first data|\bclover\b|\btoast\b|spoton|shift4|commerce ?control|ecrypt|wholesale payments|merchant servic|elavon|\bus bank|u\.s\. bank|worldpay|heartland|global payments|\btsys\b|\bsquare\b|\bstripe\b|merchant one|appstar|bancard|payments inc|c\/o |\bbank\b|credit union|\bfcu\b|\bn\.a\.|customer service|www\.|\.com\b|p\.?o\.? box \d+ (charlotte|pmb)|remit/i;
  const PERSONISH = /^[A-Z][A-Za-z'.-]+(\s+[A-Z]\.?)?\s+[A-Z][A-Za-z'.-]+$/;
  const BIZ_WORDS = /\b(inc|llc|l\.l\.c|corp|co|company|ltd|group|store|shop|cafe|café|restaurant|grill|bar|auto|market|supply|services?|repair|towing|furniture|salon|spa|smoke|vape|liquor|wine|meat|grocery|bbq|pizza|taco|trailers?|gallery|gifts?|souvenirs|wash|gardens?|pool|tan|trucks?|outfitters|zone|packing|discounts?|stereo|wheels|general|squared|inspections|cantina|hookah|appliances)\b/i;

  function cleanName(s) {
    return String(s || '')
      .replace(/^COLR\w*\s*/i, '').replace(/^\d{3,4}\s+\d{3,4}\s+\d{3}/, '')  // Fiserv mailing barcode prefix
      .replace(/^(DBA( Name)?|Merchant( Name)?|Business Name|Legal Name|Bill to)\s*:\s*/i, '').replace(/^DBA\s+(?=[A-Za-z])/i, '')
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
  const STOP_LINE = /^(statement|page\b|\w?erchant ?(number|nbr|#|id)|customer ?service|phone|www\.|https?:|summary|processing|bank ?number|routing|deposit|association|amount|details|period|issue|payment|billing|product|account|client|store|chain|cycle|parent|principal|month|this ?is|your|website|united states|have a question|open a|or call|mailing address|bank name|managing your|(address|return) service requested|customer number|account (number|type|summary)|branch\b|visit\b|member (service|fdic)|contact us|((business|personal|commercial|platinum|premier|value|free|basic|advantage|choice|essential|analyzed)\s+)*(checking|savings|share draft|money market)\b|\$|\(?\d{3}\)?[ .-]\d{3}-\d{4})/i;
  const isPerson = t => PERSONISH.test(t) && !BIZ_WORDS.test(t);
  const isStreet = t => STREET_RE.test(t) && !CITY_RE.test(t) && !/^\d+\s*(of|\/)\s*\d+$/i.test(t) && !/^\d{1,2}\/\d{1,2}/.test(t) &&
    !/^\d[\d\s,.$%-]*$/.test(t) && !/\bPAGE\b|\bOF\s+\d/i.test(t) && !/\d{5,}\s+\d{5,}/.test(t) && /[A-Za-z]{2,}/.test(t.replace(/^\d+\s*/, ''));

  function extractMerchant(doc, fam) {
    const res = { name: null, legal_name: null, address: null, src: null };
    const pageLines = pi => doc.all.filter(l => l.page === pi);
    // Photos often arrive out of order: start from the page marked "Page 1 of N" (OCR: "Page 10f 4"),
    // else the first page not marked as a later page ("Page 3of 4")
    const pageNo = pi => {
      for (const l of pageLines(pi)) {
        // OCR: "Page | 10of7" is page 1 of 7, "Page 50f7" page 5 of 7
        const m = /\bPage\s*\|?\s*([\dIl]{1,2}?)\s*[o0]{1,2}\s?f\s*(\d{1,2})/i.exec(l.text);
        if (m) { const n = +m[1].replace(/[Il]/g, '1'); if (n >= 1 && n <= +m[2]) return n; }
      }
      return null;
    };
    const nums = doc.pages.map((p, pi) => pageNo(pi));
    let first = nums.indexOf(1);
    if (first < 0) first = Math.max(0, nums.findIndex(n => !(n >= 2)));
    let lines = pageLines(first);
    if (lines.length < 12 || !lines.some(l => CITY_RE.test(l.segs[0] ? l.segs[0].t : ''))) lines = lines.concat(pageLines(first + 1));
    const stream = [];
    lines.forEach((l, li) => l.segs.forEach((s, si) => stream.push({ t: cleanName(s.t) || s.t, raw: s.t, x: s.x, y: l.y, pg: l.page, li, si, w: l.width })));
    // A suite number wrapped onto the city line ("…Main St Suite" / "#200 Springfield, TX 75001") belongs to the street
    stream.forEach((sg, i) => {
      const m = /^(#\s?\w+|(?:Suite|Ste|Unit|Apt)\.?\s+#?\w+),?\s+(.+)$/i.exec(sg.t);
      if (!m || !CITY_RE.test(m[2])) return;
      for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
        if (stream[j].li >= sg.li || Math.abs(stream[j].x - sg.x) > 28 || !isStreet(stream[j].t)) continue;   // same column, line above
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
        if (/^[A-Za-z .#]{1,14}:\s*[A-Z0-9-]*\d[A-Z0-9-]*$/i.test(t)) continue;   // mail-drop / routing codes ("MD: 1GH2Y1")
        if (/^((business|personal|commercial|platinum|premier|value|free|basic|advantage|choice|essential|analyzed)\s+)*(checking|savings|share\s+draft|money\s+market|deposit)(\s+account)?$/i.test(t)) continue;
        if (stream[n].raw.trim().length <= 3 && /^[A-Za-z]{1,3}$/.test(stream[n].raw.trim())) continue;   // OCR specks ("iE") beside the name
        if (!t || cityOf(stream[n], null) || STOP_LINE.test(t) || /:$/.test(t) || !/[A-Za-z]{2}/.test(t) || /^\d{1,2}\/\d{1,2}/.test(t)) break;
        if ((t.match(/\d/g) || []).length > (t.match(/[A-Za-z]/g) || []).length) { if (names.length) break; continue; }   // barcode / sort-code lines (above the name, they end the block)
        if (PROC_WORDS.test(t)) { if (!names.length || fam === 'bank') procAbove = true; break; }   // on a bank statement any bank line above marks the bank's own block
        names.push({ t });
      }
      const near = [stream[k].t, stream[cityIdx].t, names[0] ? names[0].t : ''].join(' ');
      let score = 10;
      if (PROC_WORDS.test(near) || (procAbove && (!names.length || fam === 'bank'))) score -= 25;
      if (/^p\.?\s?o\.?\s+box/i.test(stream[k].t) && /(charlotte|pmb)/i.test(near)) score -= 20;
      const ctxAbove = aligned(k, stream[k].x, 3).map(j => stream[j].raw).join(' ');
      if (/Location|Bill to|Merchant Address|Address:|DBA/i.test(ctxAbove)) score += 8;
      if (names.some(n => BIZ_WORDS.test(n.t))) score += 5;
      if (names.length) score += 3;
      const below = stream.find(s => s.li > stream[i].li && Math.abs(s.x - stream[i].x) < 28);
      if (below && /^\(?\d{3}\)?[ .-]?\d{3}-\d{4}|^Customer Service/i.test(below.raw)) score -= names.length ? 12 : 6;   // processor/ISO header: phone right under the address
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

  // ───────────────────────── Bank statements ─────────────────────────
  // A merchant's business bank statement: card-processor deposits give the card volume, and debits to the
  // processor, POS software and equipment lessors, the bank, and cash-advance funders give the costs.
  const BANK_MARKERS = [
    /\b(beginning|opening|previous|starting|prior)\s+(ledger\s+|available\s+|statement\s+)?balance\b|\bbalance\s+(forward|last\s+statement|on\s+\d{1,2}\/\d{1,2})\b|^\s*last\s+statement\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s*\|?\s*[\d,]+[.\s]\d{2}\b/im,
    /\b(ending|closing|new)\s+(ledger\s+|available\s+|statement\s+)?balance\b|\bbalance\s+this\s+statement\b|^\s*this\s+statement\s+\d{1,2}\/\d{1,2}\/\d{2,4}\b/im,
    /\b(deposits?|credits?)\s*(and|&|\/)\s*(other\s+)?(credits?|additions?)\b|\btotal\s+(deposits|credits|additions)\b|^\s*(\d+\s+)?(customer\s+)?deposits?(\s*\(\s*\d+\s*\))?\s*(\|\s*\d+\s*)?\|\s*\+?\s*\$?[\d,]+\.\d{2}\b|\bdeposits\s+totaling\b|\b\d+\s+credits\s*\|\s*[\d,]+[.\s]\s?\d{2}\b/im,
    /\b(withdrawals?|debits?)\s*(and|&|\/)\s*(other\s+)?(debits?|subtractions?|withdrawals?)\b|\bchecks\s*(paid|\/\s*debits)\b|\belectronic\s+withdrawals\b|\btotal\s+(withdrawals|debits|subtractions)\b|\bwithdrawals\s+totaling\b|\b\d+\s+debits\s*\|\s*[\d,]+[.\s]\s?\d{2}\b|^\s*(atm\s+)?(withdrawals|purchases)\s*\|\s*-\s*\$?[\d,]+\.\d{2}/im,
    /\bdaily\s+(ending\s+|ledger\s+)?balances?\b|\bending\s+daily\s+balance\b|\b(minimum|average|avg)\s+(daily\s+|ledger\s+|collected\s+)?balance\b/i,
    /\bdate\b[^\n]{0,60}\b(credits?|deposits?)\b[^\n]{0,60}\b(debits?|withdrawals?)\b[^\n]{0,60}\bbalance\b|\bdate\b[^\n]{0,60}\b(debits?|withdrawals?)\b[^\n]{0,60}\b(credits?|deposits?)\b[^\n]{0,60}\bbalance\b/i,
  ];
  function isBankStatement(full) {
    const hit = BANK_MARKERS.map(re => re.test(full));
    return (hit[0] || hit[1]) && (hit.filter(Boolean).length >= 3 || hit[5]);
  }

  // Who a deposit or debit is from. kind: acquirer (its debits are fees), pf (payment facilitator that nets its
  // fees, so a plain debit is a refund or purchase), network (a plain debit is the merchant paying its own card bill)
  const BANK_SOURCES = [
    [/\bsquare\b|\bsq\s*\*|\bsq\d{6}\b/i, 'Square', 'pf'],
    [/\btoast\b/i, 'Toast', 'acquirer'],
    [/\bclover\b/i, 'Clover', 'acquirer'],
    [/\bstripe\b/i, 'Stripe', 'pf'],
    [/\bpaypal\b|\bbraintree\b/i, 'PayPal', 'pf'],
    [/\bshopify\b/i, 'Shopify', 'pf'],
    [/\btekmetric\s*pay\w*/i, 'Tekmetric Payments', 'pf'],
    [/\bheartland\s*(pymt|payment|pmt|pay|ps|merch\w*|mrch|sys\w*|txns?|dep\w*|fees?)\b|\bhps\s*(dep|fees?|txns?)\b/i, 'Heartland', 'acquirer'],
    [/\bworldpay\b|\bvantiv\b/i, 'Worldpay', 'acquirer'],
    [/\bglobal\s*pay(ments)?\b|\btsys\b|\btransfirst\b|\btotal\s*system/i, 'Global Payments / TSYS', 'acquirer'],
    [/\belavon\b/i, 'Elavon', 'acquirer'],
    [/\bfirst\s*data\b|\bfdms\b|\bfiserv\b|\bcardconnect\b|\bcardpointe\b|\bbankcard\b|\bbnkcd\b|\bbkcd\b/i, 'Fiserv / First Data', 'acquirer'],
    [/\bepx\b|\bnorth\s*american\s*proc/i, 'EPX', 'acquirer'],
    [/\bpaymentech\b|\bchase\s*merch/i, 'Chase Paymentech', 'acquirer'],
    [/\bpaysafe\b/i, 'Paysafe', 'acquirer'],
    [/\bpayroc\b/i, 'Payroc', 'acquirer'],
    [/\bnorth\s*american\s*bancard\b|\bcommerce\s*control\b/i, 'North', 'acquirer'],
    [/\bspoton\b/i, 'SpotOn', 'acquirer'],
    [/\bshift\s*4\b/i, 'Shift4', 'acquirer'],
    [/\bauthorize\.?net\b|\bauthnet\b/i, 'Authorize.net', 'acquirer'],
    [/\bmaverick\b/i, 'Maverick', 'acquirer'],
    [/\bintuit\b[^|]{0,30}\b(acct\s*fee|merch\w*|payments?|deposit|dep|disc\w*|fees?)\b|\bqb\s*payments\b|\bquickbooks\s*payments\b/i, 'QuickBooks Payments', 'acquirer'],
    [/\bevo\s*(payments|merch|snap)|\bpriority\s*(pay|tech)|\bpayarc\b|\bclearent\b|\bhelcim\b|\bpayanywhere\b|\bmerchant\s*one\b|\bcardknox\b|\bdejavoo\b|\bsterling\s*payment/i, 'Card processor', 'acquirer'],
    [/\bamex\b|\bamerican\s*express\b|\baxp\b/i, 'American Express', 'network'],
    [/\bdiscover\b/i, 'Discover', 'network'],
    [/\b(merch(ant)?|mrch)\s*(bankcard|bnkcd|bkcd|dep(osit)?|settle(ment)?|setl|stlmt|svcs?|services?|fees?|disc(ount)?)\b|\bbtot\b|\bcard\s*settle|\bmerch\s+\d{3,}\b[^|]{0,30}\b(deposit|billing|fees?|disc\w*)\b/i, 'Card processor', 'acquirer'],
  ];
  const bankSource = d => { for (const [re, name, kind] of BANK_SOURCES) if (re.test(d)) return { name, kind }; return null; };
  const MCA_FUNDERS = /\b(on\s*deck|ondeck|kabbage|rapid\s*(finance|advance|capital)|credibly|fundbox|clearco|clearbanc|libertas|yellowstone|forward\s*fin\w*|kapitus|fora\s*fin\w*|national\s*funding|mulligan|fundation|bluevine|can\s*capital|pearl\s*(capital|delta)|everest\s*bus\w*|ebf\s*hold\w*|greenbox|headway|lendio|fundkite|newtek|bizfund|biz2credit|iou\s*(central|fin\w*)|rok\s*fin\w*|reliant\s*fund\w*|vox\s*fund\w*|wynwood|parkview|capytal|fintap|smart\s*business\s*fund\w*|global\s*merchant\s*cash|merchant\s*cash|cash\s*advance|mca|par\s*funding|itria|expansion\s*capital|velocity\s*capital|fox\s*capital|mantis\s*fund\w*|cfg\s*merchant|world\s*business\s*lenders|swift\s*financial|funding\s*circle|breakout\s*capital|idea\s*financial|backd|elevate\s*fund\w*|kalamata|legend\s*fund\w*|ace\s*funding|family\s*business\s*fund\w*|lg\s*funding|seamless\s*capital|cloudfund|giggle\s*fin\w*|people\s*fund|webbank|capital\s*resource|cardiff|liftfund|accion|kiva|wayflyer|channel\s*partners|fundomate|1\s*west|quick\s*bridge|bitty\s*adv\w*|ein\s*cap(ital)?|eincap|byzfunder|rowan\s*adv\w*|lendini|spartan\s*cap\w*|ml\s*factors|mr\s*advance|sos\s*capital|specialty\s*capital|lionheart\s*cap\w*|emmy\s*cap\w*|nexgen\s*cap\w*|hop\s*capital|instagreen|uplyft|lendr|credibly|biz\s*fund\w*|fund\s*box|kabbage\s*(loan|pmt)?)\b/i;
  const CAPITAL_PROGRAMS = /\b(sq(uare)?\s*cap(ital)?|sq\s*cap\d+|(square|sq|toast|paypal|stripe|shopify|clover|spoton|amazon)\b[^|]{0,40}\b(loan\s*(pmt|payment|repay\w*)|capital\s*(rpmt|repay\w*|pmt|payment)|cap\s*(rpmt|repay\w*|pmt))|capital\s*(rpmt|repaymt|repayment)|sba\b[^|]{0,20}\bloan|eidl|toast\s*(cap(ital)?|loan)|paypal\s*(working\s*cap\w*|wc|loan|bus\w*\s*loan)|ppwc|shopify\s*cap(ital)?|stripe\s*(cap(ital)?|loan)|amazon\s*lending|clover\s*cap(ital)?|spoton\s*cap\w*|(sba|business|commercial\s*(bus\w*)?)\s*loan)\b/i;
  const GENERIC_FUNDER = /\b(funding|fundng|fnd|fndg)\b|\b(merchant|business)\s+(advance|funding)\b|\bcap(ital)?\s+(funding|advance)\b/i;
  const FUNDER_PAYMENT = /\b(daily|weekly|dly|wkly|pmt|payment|pymt|debit|remit\w*|ach)\b/i;
  const NOT_FUNDER = /\b(payroll|adp|gusto|paychex|intuit|tax|irs|401k|retirement|insurance|refund)\b/i;
  const SOFTWARE_FEES = /\b((toast|clover|square|sq|spoton|shift\s*4|heartland|skytab|harbortouch|lightspeed|shopify|stripe|paypal|ncr|aloha|revel|touchbistro|upserve|lavu|shopkeep|linga|epos\s*now|posist|mindbody|vagaro|clover\s*go)\b[^|]{0,30}\b(subscr\w*|software|saas|app|apps|plan|pos|monthly|service\s*plan|hardware)|app\s*market|toast\s*subscr\w*|tekmetric|shopmonkey|shop[-\s]?ware|mitchell\s*1|clover\s*(app|plan|software|service\s*plan|fees?)|lightspeed|revel\s*systems|touchbistro|upserve|lavu|shopkeep|stripe\s*billing|sq\s*subscr\w*|equip(ment)?\s*(lease|leasing|rent\w*|fin\w*)|terminal\s*(rent\w*|lease|leasing)|northern\s*leasing|timepayment|time\s*payment|leaf\s*(fin\w*|comm\w*|cap\w*)|first\s*data\s*global\s*leas\w*|fdgl|ctc\s*leasing|global\s*leasing|merchant\s*leasing|pos\s*lease)\b/i;
  const BANK_FEES = /\b(service\s*(charge|fee)s?|maint(enance)?\s*fee|monthly\s*(service\s*|maint\w*\s*|account\s*)?fee|account\s*(analysis\s*)?fee|analysis\s*(fee|charge|service)|nsf|non[-\s]?sufficient|insufficient\s*funds|overdraft|od\s*(fee|charge)|returned?\s*(deposit(ed)?\s*)?item\s*(fee|charge)|wire\s*(transfer\s*)?fee|(incoming|outgoing|domestic|intl|international)\s*wire\s*(transfer\s*)?(fee|charge)|atm\s*(fee|surcharge)|\batm\b[^|]{0,50}\bfee\b|stop\s*pay(ment)?|paper\s*statement\s*fee|cash\s*(handling|deposit|processing)\s*fee|cash\s*deposit\s*processing\s*fee|transactions?\s+fee|excess\s*(item|transaction|deposit)s?\s*fee|foreign\s*transaction\s*fee|foreign\s*atm|(atm|withdrawal|inquiry|transfer|xfer|deposit|item)\s+(fee|charge)|(od|overdraft|nsf)\s*(item\s*)?(fee|charge)|paid\s*item\s*fee|continuous\s*overdraft|extended\s*overdraft|item\s+returned\s+(fee|charge)|(svc|serv)\.?\s*(charge|chg|fee)s?)\b/i;
  // the bank's own fee even when the item it's charged on came from a processor ("OVERDRAFT ITEM FEE ... STRIPE TRANSFER")
  const STRONG_BANK_FEE = /\b(overdraft|od|nsf|non[-\s]?sufficient|insufficient\s+funds|returned\s+(deposit(ed)?\s+)?item|paid\s+item|item\s+returned)\b[^|]{0,30}\b(fee|charge|chg)\b|^\s*(monthly\s+)?(service|maintenance|maint)\s+(fee|charge)/i;
  // a customer's deposited check bouncing: the check amount comes back out, which is not a fee
  const RETURNED_DEPOSIT = /\b(deposit(ed)?\s+item\s+return\w*|return(ed)?\s+(deposit(ed)?\s+)?item|item\s+returned|returned\s+(check|chk)|refer\s+to\s+maker)\b/i;
  const BILLPAY_FEE = /\b(paymentus|pmntus|convenience|conv\.?\s*fee|invoice\s*cloud|ici\s*fee|doxo|billmatrix)\b/i;   // charged by a biller, not the bank
  const RETURNED_PAYMENT = /\b(rejected|returned|return\s+of|reversal|reversed|refund)\b|\(rejected\)/i;
  const MONEY_MOVE = /^\s*(outgoing|incoming|online|domestic|international|intl|book|fed)?\s*(wire|fedwire|wt)\b|\bwire\s+(trans\w*\s+)?(to|from)\b|\bzelle\b|\bvenmo\b|\bcash\s*app\b|\bonline\s+(banking\s+)?transfer\b|\btransfer\s+(to|from)\s/i;
  const BANK_FEE_WORDS = /\b(fees?|disc(ount|nt)?|mtot|interchange|assess\w*|monthly|pci|chg|charges?|dues|(monthly|annual|stmt|statement|pci|gateway|batch|txn|processing)fees?)\b/i;
  const CHARGEBACKS = /\b(charge\s*back|chargeback|chg\s*[bh]\s*c?k|chbk|cbk|dispute)\b/i;   // OCR reads "Chgbck" as "Chghck"
  const NOT_SALES = /\b(refund|reversal|revers\w*|rev|rebate|adj|adjustment|fee\s*adj\w*|subscr\w*|hdwr|hardware|rf|charge\s*back|chargeback|chg\s*[bh]\s*c?k|chbk|dispute)\b/i;

  const CARD_BILL = /\b((cr|credit)\s*(crd|card)|crd)\s*(pmt|payment|pymt|epay)|\bcard\s*(services|member\s*serv\w*)\s*(pmt|payment)|\bcredit\s*card\s*(bill|autopay)/i;
  const OWN_CARD_PURCHASE = /\b(debit\s*purchase|purchase\s*authorized|card\s*purchase|crd\s*purchase|recurring\s*(card\s*)?(purchase|payment)|pos\s*(db|debit|purchase|pur)|dbt\s*crd|checkcard|chk\s*card|visa\s*(debit|purchase)|point\s*of\s*sale\s*(debit|withdrawal|purchase))\b/i;
  // "Orig CO Name:Harbor Ridge Fnd ..." → "Harbor Ridge Fnd"; falls back to the matched word
  function fundName(desc, m) {
    const before = desc.slice(0, m.index).replace(/^.*(name|co|ach\s+(debit|credit|withdrawal|deposit)|des|from|to)\s*[:#]?\s*/i, '').split(/\s+/).filter(w => /^[a-z&'.-]+$/i.test(w)).slice(-3);
    return titleCase((before.join(' ') + ' ' + m[0]).trim().toUpperCase());
  }
  function classifyBankTx(desc, dir) {
    const moved = MONEY_MOVE.test(desc);   // a wire, Zelle or transfer names whoever sent it, not a processor
    let src = moved ? null : bankSource(desc);
    const generic = !NOT_FUNDER.test(desc) && GENERIC_FUNDER.exec(desc);
    // a card purchase is never a lender's debit; a rejected or returned payment coming back is not new funding
    let funder = dir === 'credit' && RETURNED_PAYMENT.test(desc) ? null
      : MCA_FUNDERS.exec(desc) || CAPITAL_PROGRAMS.exec(desc) || (generic && (dir === 'credit' || FUNDER_PAYMENT.test(desc)) ? generic : null);
    // paying a lender by debit card still counts ("Giggle Finance"), but a card purchase in a town named Cardiff doesn't
    if (funder && OWN_CARD_PURCHASE.test(desc) && (funder === generic || !/fin|fund|cap|lend|adv|loan/i.test(funder[0]))) funder = null;
    const funderName = () => (funder === generic ? fundName(desc, generic) : titleCase(funder[0].replace(/\s+/g, ' ').toUpperCase()));
    if (dir === 'credit') {
      if (funder) return { category: 'mca_funding', source: funderName() };
      if (src && !NOT_SALES.test(desc)) return { category: 'card_deposit', source: src.name };
      return { category: 'other_deposit', source: null };
    }
    if (CARD_BILL.test(desc)) return { category: 'other_debit', source: null };
    if (STRONG_BANK_FEE.test(desc)) return { category: 'misc_fee', source: null };
    if (RETURNED_DEPOSIT.test(desc)) return { category: 'other_debit', source: null };
    if (OWN_CARD_PURCHASE.test(desc)) src = null;   // the merchant bought something from a business that happens to use Clover, Square...
    if (CHARGEBACKS.test(desc) && !moved) return { category: 'chargeback', source: src && src.name };
    if (funder) return { category: 'mca_payment', source: funderName() };
    if (SOFTWARE_FEES.test(desc)) return { category: 'software_fee', source: src ? src.name : titleCase(SOFTWARE_FEES.exec(desc)[0].toUpperCase()) };
    if (src && (src.kind === 'acquirer' || BANK_FEE_WORDS.test(desc))) return { category: 'processing_fee', source: src.name };
    if (BANK_FEES.test(desc) && !BILLPAY_FEE.test(desc)) return { category: 'misc_fee', source: null };
    return { category: 'other_debit', source: null };
  }

  const TX_DATE = /^(?:(\d{3,6})(?:\s+|\s*[*^|]\s*)[*^]?\s*\|?\s*)?(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2})(?=\s|\||$)/i;
  const CREDIT_HEAD = /^(((customer|other|electronic|ach|mobile|branch|atm|remote)\s+)?(deposits?|credits?)|additions?|other\s+credits|deposits?\s*(and|&|\/)\s*(other\s+|misc\.?\s+)?(credits?|additions?)|credits?\s*(and|&|\/)\s*(other\s+|misc\.?\s+)?(deposits?|additions?)|electronic\s+(deposits|credits)|ach\s+(deposits|credits)|incoming\s+(transfers|wires))(\s*\(?continued\)?)?\s*:?$/i;
  const DEBIT_HEAD = /^(((card|other|electronic|ach|atm|debit\s+card|pos)\s+)?(withdrawals?|debits?)|subtractions?|checks(\s+(paid|cleared|in\s+(numerical|number|serial)\s+order|and\s+substitute\s+checks))?|electronic\s+(withdrawals|payments|debits)|other\s+(withdrawals|debits|subtractions)|withdrawals?\s*(and|&|\/)\s*(other\s+|misc\.?\s+)?(debits?|subtractions?)|debits?\s*(and|&|\/)\s*(other\s+|misc\.?\s+)?(withdrawals?|subtractions?|charges?)|checks\s*(and|&|\/)\s*(other\s+)?debits|(service\s+)?fees(\s+(and|&)\s+charges)?|service\s+charges|card\s+(purchases|transactions|activity)|atm\s*(&|and)?\s*debit\s+card(\s+withdrawals)?|purchases|payments|ach\s+debits)(\s*\(?continued\)?)?\s*:?$/i;
  const BALANCE_HEAD = /^(daily\s+(\w+\s+){0,2}balances?|ending\s+daily\s+balances?|(daily\s+)?balance\s+summary|balance\s+by\s+date|summary\s+of\s+checks\s+written|daily\s+balance\s+information)\b/i;
  const headText = t => t.replace(/[*_=~#>]+/g, ' ').replace(/(^|\s)[-–—](?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim();
  const HEAD_WORD = /^(deposits?|credits?|debits?|withdrawals?|checks|other|additions?|subtractions?|electronic|atm|fees|service|charges|daily|balances?)$/i;
  const headKind = segs => {
    for (const sg of segs) {
      const t = headText(sg.t);
      if (BALANCE_HEAD.test(t)) return 'balance';
      if (CREDIT_HEAD.test(t)) return 'credit';
      if (DEBIT_HEAD.test(t)) return 'debit';
    }
    // OCR reads the dashes around "- - - - OTHER DEBITS - - - -" as short junk words on both sides
    const w = segs.map(sg => sg.t).join(' ').split(/\s+/).filter(Boolean);
    const a = w.findIndex(x => HEAD_WORD.test(x));
    let b = a;
    while (b + 1 < w.length && HEAD_WORD.test(w[b + 1])) b++;
    const junk = a < 0 ? [] : w.slice(0, a).concat(w.slice(b + 1));
    if (a >= 2 && w.length - b - 1 >= 2 && /s$/i.test(w[b]) && junk.every(x => x.length <= 5 && !/\d/.test(x) && !HEAD_WORD.test(x))) {
      const t = w.slice(a, b + 1).join(' ');
      if (BALANCE_HEAD.test(t)) return 'balance';
      if (CREDIT_HEAD.test(t)) return 'credit';
      if (DEBIT_HEAD.test(t)) return 'debit';
    }
    return null;
  };
  const COLUMN_LINE = /^((post(ing)?|trans(action)?|eff(ective)?)\s+)?(date|description|amount|debits?|credits?|balance|deposits?|withdrawals?|check\s*(no\.?|number|nbr|#)|ref(erence)?\s*(no\.?|#)?|details?|activity\s+description)(\s+((post(ing)?|trans(action)?)\s+)?(date|description|amount|debits?|credits?|balance|deposits?|withdrawals?|check\s*(no\.?|number|nbr|#)|ref(erence)?\s*(no\.?|#)?|details?))*$/i;
  const DATE_ONLY = /^(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)$/;
  const COL_CREDIT = /^(deposits?|credits?|additions?|deposits?\s*\/\s*credits?|deposits?\s*(and|&)\s*(other\s+)?credits?|amount\s+credited)$/i;
  const COL_DEBIT = /^(withdrawals?|debits?|subtractions?|withdrawals?\s*\/\s*debits?|(checks|withdrawals?)\s*(and|&)\s*(other\s+)?debits?|amount\s+debited|charges?)$/i;
  const segRight = s => (s.x2 != null ? s.x2 : s.x);
  const fixMinus = t => t.replace(/(^|[\s|])-\s+(?=\$?\d[\d,]*\.\d{2}\b)/g, '$1-');   // "- 6.69" → "-6.69"
  const stripMoney = t => t.split(/\s+/).filter(w => !MONEY_TOKEN.test(w.replace(/^\$/, ''))).join(' ').replace(/\s*\|\s*/g, ' ').trim();

  // Transactions in reading order, with direction from the section heading, the column, or the sign
  function bankTransactions(doc) {
    const txs = [];
    const centered = {};   // pages whose rows print the date centered on a two- or three-line description
    let centeredAny = false, prevTx = null;
    let dir = null, cols = null, last = null, skip = false, sec = 0;
    let midDate = null, grid = false;   // "DESCRIPTION | DATE | AMOUNT" date column; "DATE AMOUNT DATE AMOUNT" deposit grid
    let pend = [];                      // description lines printed above the first row after a header
    for (let i = 0; i < doc.all.length; i++) {
      const l = doc.all[i];
      let segs = l.segs || [];
      const first = (segs[0] ? segs[0].t : l.text).trim();
      if (/^description$/i.test(first)) {
        const dh = segs.findIndex((sg, k) => k > 0 && /^(post(ing)?\s+|trans(action)?\s+)?date$/i.test(sg.t.trim()));
        if (dh > 0) { midDate = segs[dh].x; last = null; continue; }
      }
      if ((l.text.match(/\bamount\b/gi) || []).length >= 2 && (l.text.match(/\bdate\b/gi) || []).length >= 2 && !/balance|description/i.test(l.text)) { grid = true; last = null; continue; }
      // a Date | Balance | Date | Balance grid is a balance table, not transactions
      if (segs.length >= 4 && segs.every(sg => /^(date|balance|amount)$/i.test(sg.t.trim())) && segs.filter(sg => /balance/i.test(sg.t)).length >= 2) { skip = true; cols = null; last = null; continue; }
      const cred = segs.find(s => COL_CREDIT.test(s.t.trim())), deb = segs.find(s => COL_DEBIT.test(s.t.trim()));
      if (cred && deb) {
        const bal = segs.find(s => s !== cred && s !== deb && /balance/i.test(s.t));
        cols = { credit: segRight(cred), debit: segRight(deb), balance: bal ? segRight(bal) : null };
        skip = false; last = null; pend = []; continue;
      }
      let text = fixMinus(l.text).replace(/^((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?)\s*\|\s*(\d{1,2}\b)/i, '$1 $2')
        .replace(/^[A-Z0-9.]*[A-Z][A-Z0-9.]*?(?=\d{1,2}\/\d{1,2}\/\d{2,4}\b)/, '')   // printer margin codes glued onto the date ("6250TEXAS12/08/23")
        .replace(/(\d\.\d{2}-?)(?:SC|OD|NSF)\b/g, '$1');                          // "5.60-SC": a code after the amount
      // the posting date in its own column after the description: read the row as if the date came first
      if (midDate != null && !TX_DATE.test(text)) {
        // OCR of typewriter fonts: "87/25" or "a7/31" for 07/.., and "33 28" for 33.28 in the amount column
        const fixDate = t => { const m = /^([0-9a-z])(\d)\/(\d{2})$/i.exec(t.trim()); return m && !(+(m[1] + m[2]) >= 1 && +(m[1] + m[2]) <= 12) ? '0' + m[2] + '/' + m[3] : t.trim(); };
        const k = segs.findIndex((sg, j) => j > 0 && DATE_ONLY.test(fixDate(sg.t)) && Math.abs(sg.x - midDate) < 45);
        if (k > 0) {
          segs = [Object.assign({}, segs[k], { t: fixDate(segs[k].t) })].concat(segs.filter((_, j) => j !== k))
            .map((sg, j, all) => (j === all.length - 1 && j > 0 && /^\d{1,3}(?:,\d{3})*[\s;:]\s?\d{2}$/.test(sg.t.trim()) ? Object.assign({}, sg, { t: sg.t.trim().replace(/[\s;:]+(\d{2})$/, '.$1') }) : sg));
          text = fixMinus(segs.map(sg => sg.t).join(' | '));
        }
      }
      const date = TX_DATE.exec(text);
      if (!date) {
        const money = tokens(text).filter(t => t.k === 'money');
        let kind = money.length ? (BALANCE_HEAD.test(headText(first)) ? 'balance' : null) : headKind(segs);
        // a heading-like word lined up under the previous row's description is part of that description
        if (kind && last && last.descX != null && segs[0] && Math.abs(segs[0].x - last.descX) < 12) kind = null;
        if (kind === 'balance') { skip = true; cols = null; last = null; midDate = null; grid = false; continue; }
        if (kind) { dir = kind; sec++; skip = false; cols = null; last = null; midDate = null; grid = false; pend = []; continue; }
        if (/^(total|subtotal|ending|beginning|opening|closing|daily|page\b|continued|itemization|summary\s+of)/i.test(headText(segs.map(sg => sg.t).join(' ')).replace(/^[-–—|\s]+/, ''))) { last = null; continue; }
        if (!(last && l.page === last.page) && !skip && !money.length) {
          const words = stripMoney(segs.map(s => s.t).join(' '));
          if (COLUMN_LINE.test(words) || (/\bdate\b/i.test(words) && /\b(description|amount|balance|debits?|credits?)\b/i.test(words))) pend = [];
          else if (words) pend.push({ w: words, y: l.y, page: l.page });
        }
        // a wrapped description line, or the amount printed under a description
        if (last && l.page === last.page && !skip) {
          const words = stripMoney(segs.map(s => s.t).join(' '));
          if (words) { last.desc += ' ' + words; (last.cont = last.cont || []).push({ w: words, y: l.y }); }
          if (last.amount == null && money.length) setAmount(last, segs, money);
          if (words.length > 160) last = null;
        }
        continue;
      }
      if (skip) continue;
      const tx = { page: l.page, y: l.y, date: date[2], desc: '', amount: null, dir: null, sec, secDir: dir, descX: segs[1] ? segs[1].x : null };
      const rest = text.slice(date.index + date[0].length);
      tx.desc = stripMoney(rest.replace(/\s*\|\s*/g, ' '));
      const money = tokens(rest).filter(t => t.k === 'money');
      if (!tx.desc && !money.length) { last = null; continue; }                                   // a bare date label
      // a date-and-amount row whose description was printed on the line(s) above it. When the rows are two lines
      // tall with the date centered, the line just above belongs to this row and the one under the last row stays there.
      // the first row after a header: its top line was held back, since no row above could own it
      // (In other layouts a line there is the end of the previous page's last row.)
      if ((!last || last.page !== l.page) && pend.length && money.length) {
        const mine = pend.filter(c => c.page === l.page && c.y != null && l.y != null && Math.abs(c.y - l.y) <= 12);
        if (mine.length && (!tx.desc || centeredAny)) { tx.desc = mine.map(c => c.w).concat(tx.desc ? [tx.desc] : []).join(' '); tx.above = mine.length; tx.span = Math.max.apply(null, mine.map(c => Math.abs(c.y - l.y))); }
        else if (mine.length && prevTx && prevTx.page === l.page - 1) prevTx.desc += ' ' + mine.map(c => c.w).join(' ');
      }
      pend = [];
      // Once a page shows that layout, a row with text on the date line (three lines, date on the middle one) also
      // takes the line just above it.
      if (money.length && last && last.cont && last.cont.length && last.page === l.page && (!tx.desc || centered[l.page])) {
        let near = c => (c.y == null || l.y == null || last.y == null) ? !tx.desc : Math.abs(c.y - l.y) < Math.abs(c.y - last.y);
        // centered rows are symmetric: a row with N lines above its date has N below it
        if (last.above && last.y != null && l.y != null) {
          const keep = new Set(last.cont.filter(c => c.y != null && Math.abs(c.y - last.y) <= last.span + 3).slice(0, last.above));
          near = c => !keep.has(c);
        }
        const mine = last.cont.filter(near);
        if (mine.length && !tx.desc && l.y != null) centered[l.page] = centeredAny = true;
        if (mine.length && l.y != null && mine.every(c => c.y != null)) { tx.above = mine.length; tx.span = Math.max.apply(null, mine.map(c => Math.abs(c.y - l.y))); }
        if (mine.length) {
          tx.desc = mine.map(c => c.w).concat(tx.desc ? [tx.desc] : []).join(' ');
          last.cont = last.cont.filter(c => mine.indexOf(c) < 0);
          last.desc = [last.base].concat(last.cont.map(c => c.w)).join(' ').trim();
        }
      }
      if (/^(beginning|ending|opening|closing|previous|new|starting)\s+(ledger\s+|statement\s+)?balance\b|^balance\s+(forward|brought|carried)/i.test(tx.desc)) { last = null; continue; }
      // a deposit grid under a "DATE AMOUNT DATE AMOUNT" header: one transaction per pair
      if (grid && dir && !/[A-Za-z]{2}/.test(text)) {
        const cells = text.split(/[\s|]+/).filter(Boolean);
        const pairs = [];
        for (let k = 0; k < cells.length; k++) {
          if (!DATE_ONLY.test(cells[k]) || k + 1 >= cells.length || !MONEY_TOKEN.test(cells[k + 1].replace(/^\$/, ''))) continue;
          const ref = k > 0 && /^\d{2,6}\*?$/.test(cells[k - 1]) ? ' ' + cells[k - 1].replace('*', '') : '';
          pairs.push([cells[k], parseMoney(cells[k + 1]), ref]);
        }
        if (pairs.length >= 2 || (pairs.length === 1 && cells.length <= 3)) {
          pairs.forEach(([d, v, ref]) => { if (v != null && v > 0) txs.push({ page: l.page, y: l.y, date: d, desc: (dir === 'credit' ? 'Deposit' : 'Check') + ref, amount: Math.abs(v), dir, sec, secDir: dir, byCol: true, grid: true }); });
          last = null; continue;
        }
      }
      if (!/[A-Za-z]{2}/.test(tx.desc) && /\d{1,2}[\/-]\d{1,2}/.test(tx.desc)) { last = null; continue; }   // date / balance or check-number grids
      if (date[1] && !/[A-Za-z]{2}/.test(tx.desc)) tx.desc = ('Check ' + date[1] + ' ' + tx.desc).trim();          // "1052 ^ | 08/05 | 685.00" (check number first)
      if (money.length) setAmount(tx, segs.map(sg => ({ t: fixMinus(sg.t), x: sg.x, x2: sg.x2 })), money);
      tx.base = tx.desc;
      txs.push(tx); last = prevTx = tx;
    }
    function setAmount(tx, segs, money) {
      if (cols) {
        let best = null;
        segs.forEach(s => {
          const m = tokens(s.t).filter(t => t.k === 'money');
          if (!m.length) return;
          const r = segRight(s);
          const cand = [['credit', cols.credit], ['debit', cols.debit], ['balance', cols.balance]].filter(c => c[1] != null)
            .map(c => ({ col: c[0], d: Math.abs(r - c[1]) })).sort((a, b) => a.d - b.d)[0];
          if (cand && cand.col !== 'balance' && cand.d < 70 && !best) best = { v: m[m.length - 1].v, col: cand.col };
        });
        if (best) { tx.amount = Math.abs(best.v); tx.dir = best.col; tx.byCol = true; return; }
      }
      const v = money[0].v;
      tx.amount = Math.abs(v);
      tx.neg = v < 0;
      tx.dir = v < 0 ? 'debit' : (dir || 'credit');
    }
    // A minus sign always means a debit. In a section whose rows are signed (or with no section at all),
    // an unsigned amount is a credit — this also undoes description lines that merely look like headings.
    const signed = new Set(txs.filter(t => t.neg).map(t => t.sec));
    txs.forEach(t => {
      if (t.byCol || t.amount == null) return;
      t.dir = t.neg ? 'debit' : (t.secDir === 'debit' && !signed.has(t.sec) ? 'debit' : 'credit');
    });
    // a "Checks Cleared" grid often repeats checks already listed in the register
    const key = t => t.dir + '|' + t.amount.toFixed(2) + '|' + String(t.date).replace(/[\/-]\d{2,4}$/, '').replace(/\b0(\d)/g, '$1');
    const listed = new Set(txs.filter(t => !t.grid && t.amount != null).map(key));
    return txs.filter(t => t.amount != null && t.amount > 0 && t.dir && !(t.grid && listed.has(key(t))));
  }

  const BANK_NAMES = [
    [/jpmorgan\s*chase|chase\s*bank|\bchase\b/i, 'Chase'], [/bank\s*of\s*america/i, 'Bank of America'], [/wells\s*fargo/i, 'Wells Fargo'],
    [/\btruist\b/i, 'Truist'], [/\bpnc\b/i, 'PNC'], [/u\.?\s?s\.?\s*bank\b/i, 'U.S. Bank'], [/citibank|\bciti\b/i, 'Citibank'],
    [/capital\s*one/i, 'Capital One'], [/\btd\s*bank\b/i, 'TD Bank'], [/\bregions\b/i, 'Regions'], [/fifth\s*third/i, 'Fifth Third'],
    [/keybank/i, 'KeyBank'], [/huntington/i, 'Huntington'], [/\bm\s*&\s*t\b/i, 'M&T Bank'], [/citizens\s*bank/i, 'Citizens'],
    [/\bbmo\b/i, 'BMO'], [/frost\s*bank/i, 'Frost'], [/navy\s*federal/i, 'Navy Federal'],
  ];
  function bankName(doc) {
    const head = doc.all.filter(l => l.page === 0).slice(0, 25).map(l => l.text).join('\n');
    for (const [re, name] of BANK_NAMES) if (re.test(head)) return name;
    const m = /\b((?:[A-Z][A-Za-z&.']+[ \t]+){1,4}(?:Bank|BANK|Credit Union|CREDIT UNION|Federal Credit Union|FEDERAL CREDIT UNION))\b/.exec(head.replace(/^\d.*$/gm, ''));
    return m ? titleCase(m[1].replace(/\s+(OF|of)$/, '').trim()) : null;
  }

  // Statement periods printed on the statement ("03/01/2026 - 03/31/2026", "July 9, 2026 through August 12, 2026").
  // Returns how many months they cover, or 0 when none is printed. A range that contains another one (year to date) is left out.
  const MONTHS_AT = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  function statementMonths(full) {
    const D1 = '(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{2,4})', D2 = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})';
    const SEP = '\\s*(?:-|–|—|to|thru|through)\\s*';
    const toDay = (y, m, d) => { y = +y; if (y < 100) y += 2000; const t = Date.UTC(y, m, +d); return isNaN(t) || m < 0 || m > 11 || +d < 1 || +d > 31 ? null : Math.round(t / 864e5); };
    const ranges = [];
    const add = (a, b) => { if (a != null && b != null && b - a >= 20 && b - a <= 190 && !ranges.some(r => r[0] === a && r[1] === b)) ranges.push([a, b]); };
    let m;
    const re1 = new RegExp(D1 + SEP + D1, 'gi');
    while ((m = re1.exec(full))) add(toDay(m[3], +m[1] - 1, m[2]), toDay(m[6], +m[4] - 1, m[5]));
    const re2 = new RegExp(D2 + SEP + D2, 'gi');
    while ((m = re2.exec(full))) add(toDay(m[3], MONTHS_AT[m[1].toLowerCase()], m[2]), toDay(m[6], MONTHS_AT[m[4].toLowerCase()], m[5]));
    const kept = ranges.filter(r => !ranges.some(o => o !== r && o[0] >= r[0] && o[1] <= r[1]));
    // periods a day or two apart describe the same statement
    const uniq = kept.filter((r, i) => !kept.slice(0, i).some(o => Math.abs(o[1] - r[1]) <= 3));
    return uniq.reduce((a, r) => a + Math.max(1, Math.round((r[1] - r[0] + 1) / 30.44)), 0);
  }

  function parseBankStatement(doc, result) {
    result.family = 'bank';
    result.document_type = 'bank_statement';
    result.processor = bankName(doc);
    const txs = bankTransactions(doc).map(t => Object.assign(t, classifyBankTx(t.desc, t.dir)));
    txs.forEach(t => { if (t.category === 'misc_fee' && !t.source) t.source = result.processor || 'The bank'; });
    // a payment rejected or returned and credited back is no cost: drop both sides
    txs.filter(t => t.dir === 'credit' && RETURNED_PAYMENT.test(t.desc)).forEach(cr => {
      const db = txs.find(t => t.dir === 'debit' && !t.reversed && Math.abs(t.amount - cr.amount) < 0.005 && /mca_payment|processing_fee|software_fee|misc_fee/.test(t.category));
      if (db) {
        if (db.category === 'mca_payment') result.warnings.push('A $' + db.amount.toFixed(2) + ' payment to ' + (db.source || 'a lender') + ' was returned unpaid, so it isn’t counted — but the merchant still owes that lender.');
        db.reversed = true; db.category = 'other_debit';
      }
    });
    const mer = extractMerchant(doc, 'bank');
    result.merchant_name = mer.name; result.legal_name = mer.legal_name; result.address = mer.address;
    // PayPal Business Loan: the same PayPal debit amount on a fixed schedule (purchases through PayPal vary)
    const pp = {};
    txs.filter(t => t.dir === 'debit' && t.category === 'other_debit' && /\bpaypal\b/i.test(t.desc) && !/inst\s*xfer|purchase|\bpos\b/i.test(t.desc) && t.amount >= 100)
      .forEach(t => (pp[t.amount.toFixed(2)] = pp[t.amount.toFixed(2)] || []).push(t));
    Object.values(pp).filter(list => list.length >= 2).forEach(list => list.forEach(t => { t.category = 'mca_payment'; t.source = 'PayPal (recurring loan payment)'; }));
    // Settlements some processors send under the merchant's own name ("SAMPLE BISTRO/1234567890 F0000…"): credits almost
    // every business day, of varying amounts, whose originator is the account holder itself
    const own = (result.merchant_name || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(llc|inc|corp|co|ltd|dba|the)\b/g, ' ').split(/\s+/).filter(Boolean).slice(0, 2).join(' ');
    if (own.length >= 6) {
      const mine = txs.filter(t => t.dir === 'credit' && t.category === 'other_deposit' && !MONEY_MOVE.test(t.desc) && !/\b(deposit|transfer|xfer|refund|return|loan)\b/i.test(t.desc.split(/[\/#]/)[0]) &&
        t.desc.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().startsWith(own));
      const days = new Set(mine.map(t => t.date)), amounts = new Set(mine.map(t => t.amount));
      if (days.size >= 8 && amounts.size >= days.size * 0.8) {
        mine.forEach(t => { t.category = 'card_deposit'; t.source = 'Settlements under the business’s name'; });
        result.warnings.push('Card settlements here arrive under the business’s own name, not a processor’s (' + mine.length + ' near-daily credits). They were counted as card deposits — confirm with the merchant.');
      }
    }
    // Statements covered: each has one beginning-balance line with an amount
    const begins = new Set(doc.all.filter(l => /^(beginning|opening|previous|starting)\s+(ledger\s+|statement\s+)?balance/i.test(l.text))
      .map(l => (tokens(l.text).find(t => t.k === 'money') || {}).v).filter(v => v != null));
    const months = Math.max(1, statementMonths(doc.full) || begins.size);
    const group = cat => {
      const list = txs.filter(t => t.category === cat);
      const by = {};
      list.forEach(t => { const k = t.source || 'Other'; (by[k] = by[k] || { name: k, total: 0, count: 0 }).total += t.amount; by[k].count++; });
      return { total: r2(list.reduce((a, t) => a + t.amount, 0)), count: list.length, sources: Object.values(by).map(x => Object.assign(x, { total: r2(x.total) })).sort((a, b) => b.total - a.total) };
    };
    const bank = {
      months,
      card_deposits: group('card_deposit'), processing_fees: group('processing_fee'), software_fees: group('software_fee'),
      misc_fees: group('misc_fee'), mca_payments: group('mca_payment'), mca_funding: group('mca_funding'), chargebacks: group('chargeback'),
      credits_total: r2(txs.filter(t => t.dir === 'credit').reduce((a, t) => a + t.amount, 0)),
      debits_total: r2(txs.filter(t => t.dir === 'debit').reduce((a, t) => a + t.amount, 0)),
      possible_mca: [], transactions_read: txs.length,
    };
    // Unnamed cash advances: the same amount to the same payee on many days
    const rep = {};
    txs.filter(t => t.category === 'other_debit').forEach(t => {
      const key = t.desc.toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\b(ACH|DEBIT|PMT|PAYMENT|WEB|CCD|PPD|ID|DES|INDN|CO|ENTRY|ORIG|NAME|DESCR|SEC|TRACE)\b/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
      if (!key || /PAYROLL|GUSTO|ADP|PAYCHEX|RENT|IRS|TAX|TRANSFER|XFER|ZELLE|CHECK|INSURANCE|UTILIT|ELECTRIC|WATER|GAS\b/.test(t.desc.toUpperCase())) return;
      const k = key + '|' + t.amount.toFixed(2);
      (rep[k] = rep[k] || { name: titleCase(key), amount: t.amount, count: 0 }).count++;
    });
    bank.possible_mca = Object.values(rep).filter(x => x.count >= 8 * months || (x.count >= 4 * months && x.amount >= 100)).map(x => Object.assign(x, { total: r2(x.amount * x.count) }));
    result.bank = bank;
    const per = v => r2(v / months);
    if (bank.card_deposits.count) { result.volume = per(bank.card_deposits.total); result.evidence.volume = bank.card_deposits.count + ' card-processor deposits' + (months > 1 ? ' over ' + months + ' statements' : ''); }
    result.total_fees = per(bank.processing_fees.total + bank.software_fees.total);
    result.evidence.total_fees = 'processing fees + software & equipment debits';
    result.transactions = null;

    const per1 = /([A-Z][a-z]+\.? \d{1,2}, \d{4})\s*(?:through|thru|to|-|–)\s*([A-Z][a-z]+\.? \d{1,2}, \d{4})/.exec(doc.full) || /(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:through|thru|to|-|–)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(doc.full);
    if (per1) result.statement_period = per1[1] + ' – ' + per1[2];

    // Cross-check against the statement's own deposit total when it prints one
    const dep = valueAfterLabel(doc, /^(total\s+)?(deposits?|credits?)\s*(and|&|\/)\s*(other\s+)?(credits?|additions?)\b|^total\s+(deposits|credits|additions)\b/i, { nextLine: false })[0];
    const w = result.warnings;
    w.push('Read from a bank statement: volume is the card-processor deposits' + (months > 1 ? ' (monthly average of ' + months + ' statements)' : '') + '. Bank statements don’t show the number of card transactions — enter it from the processing statement or the POS.');
    if (!bank.card_deposits.count) w.push('No card-processor deposits were found on this bank statement.');
    else if (!bank.processing_fees.count) w.push('No separate processing-fee debits were found, so the processor probably takes its fees out of each deposit. The deposits are then net of fees and actual card sales were higher — use the processing statement for exact fees.');
    if (dep && bank.credits_total && Math.abs(dep.value - bank.credits_total) > Math.max(1, dep.value * 0.02) && months === 1) w.push('Only part of the deposits could be read (' + '$' + bank.credits_total.toFixed(2) + ' of $' + dep.value.toFixed(2) + '). Check the numbers against the statement.');
    if (bank.mca_payments.count) w.push('Cash advance / loan payments found: $' + per(bank.mca_payments.total).toFixed(2) + ' a month to ' + bank.mca_payments.sources.map(x => x.name).join(', ') + '.');
    bank.possible_mca.forEach(x => w.push('Repeating debit to ' + x.name + ' (' + x.count + ' × $' + x.amount.toFixed(2) + ') may be a cash advance.'));
    if (!result.merchant_name) w.push('Could not find the account holder’s business name.');
    return result;
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
    result.document_type = 'processing_statement';
    if (isBankStatement(doc.full)) return parseBankStatement(doc, result);
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
    buildPageLines, buildPageLinesFromOcr, ocrQuality, normalizeOcrWord, tokens, parseMoney, parseStatement, detectFamily, isBankStatement, classifyBankTx, _statementMonths: statementMonths,
    _bankTransactions: pages => bankTransactions(makeDoc(pages)).map(t => Object.assign(t, classifyBankTx(t.desc, t.dir))),
    loadTable, normName, matchProgram, similarity, computeMarkup, defaultProgram, programOptions, bucketLabel, titleCase: titleCaseKeep,
    DEFAULT_ASSUMPTIONS, DEFAULT_PROGRAMS
  };
});
