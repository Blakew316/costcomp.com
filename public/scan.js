/* ═══════════════════════════════════════════════════════════════
   scan.js — "Scan Statement" feature for the cost comparison page.
   Reads a merchant statement (PDF or photos), lets the agent review
   the numbers, fills the comparison, and shows the current processor's
   markup against the Appendix G interchange schedule.
   Engines:  on-device (PDF.js text + ScanCore parser, instant, free)
             on-device OCR (Tesseract.js) for photos and scanned PDFs
             AI (/api/scan-statement Netlify Function), preferred for photos when configured
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/';
  const TESS = {
    script: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
    langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'
  };
  const OCR_LONG_EDGE = 2400;      // ~300 dpi for a letter page
  const OCR_MAX_PAGES = 12;
  const OCR_START_TIMEOUT_MS = 120000;
  const MAX_AI_FILES = 20;        // the function's per-request limit
  const API = '/api/scan-statement';
  const UPLOAD_BUDGET = 4200000;   // raw bytes; base64 inflates ~33% and Netlify accepts ~6 MB
  const AI_TIMEOUT_MS = 58000;

  const state = { scan: null, overrides: {}, table: null, signature: '' };
  let pdfjsPromise = null, tablePromise = null, aiPromise = null, tessPromise = null;

  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (v, dec) => (v == null || !isFinite(v) ? '—' : fmt$(Number(v), dec == null ? 2 : dec));
  const pct = (v, dec) => (v == null || !isFinite(v) ? '—' : Number(v).toFixed(dec == null ? 2 : dec) + '%');
  const num = s => { const n = parseFloat(String(s == null ? '' : s).replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : null; };

  // ───────────── Loaders ─────────────
  function loadPdfjs() {
    if (!pdfjsPromise) {
      pdfjsPromise = import(PDFJS + 'pdf.min.mjs').then(lib => {
        lib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs';
        return lib;
      }).catch(err => { pdfjsPromise = null; throw err; });
    }
    return pdfjsPromise;
  }
  function loadTable() {
    if (!tablePromise) {
      tablePromise = fetch('data/appendix-g.json?v=20260925').then(r => { if (!r.ok) throw new Error('Appendix G not found'); return r.json(); })
        .then(json => (state.table = ScanCore.loadTable(json)))
        .catch(err => { tablePromise = null; throw err; });
    }
    return tablePromise;
  }
  // Is the AI reader deployed and configured on this site?
  function aiAvailable() {
    if (!aiPromise) {
      if (location.protocol === 'file:') return (aiPromise = Promise.resolve(false));
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 6000);
      aiPromise = fetch(API, { signal: ctl.signal, cache: 'no-store' })
        .then(r => (r.ok && /json/.test(r.headers.get('content-type') || '') ? r.json() : { configured: false }))
        .then(j => Boolean(j && j.configured))
        .catch(() => false)
        .finally(() => clearTimeout(t));
    }
    return aiPromise;
  }

  // ───────────── File handling ─────────────
  const isPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const isImage = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name);

  async function readPdf(file) {
    const lib = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await lib.getDocument({ data, verbosity: 0 }).promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      pages.push(ScanCore.buildPageLines(tc.items.map(i => ({ str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, h: Math.abs(i.transform[3]) || i.height })), vp.width));
    }
    return { file, pdf, pages };
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  function canvasToJpeg(canvas, quality) {
    return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', quality));
  }
  async function imageToJpeg(file, maxDim, quality) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('Could not open ' + file.name)); i.src = url; });
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return canvasToJpeg(c, quality);
    } finally { URL.revokeObjectURL(url); }
  }
  async function pdfPageToJpeg(pdf, n, width, quality) {
    const page = await pdf.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: width / vp1.width });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return canvasToJpeg(c, quality);
  }

  // ───────────── On-device OCR (photos & scanned PDFs) ─────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src; el.async = true;
      el.onload = resolve; el.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(el);
    });
  }
  function loadTesseract() {
    if (!tessPromise) {
      tessPromise = (window.Tesseract ? Promise.resolve() : loadScript(TESS.script)).then(() => window.Tesseract)
        .catch(err => { tessPromise = null; throw err; });
    }
    return tessPromise;
  }
  async function createOcrWorker(onProgress) {
    const T = await loadTesseract();
    // Tesseract.js never settles createWorker when the language download or init fails, so race it
    let failStart;
    const startFailed = new Promise((resolve, reject) => { failStart = reject; });
    startFailed.catch(() => null);
    const timer = setTimeout(() => failStart(new Error('the reader did not finish loading; check the connection and try again')), OCR_START_TIMEOUT_MS);
    const created = T.createWorker('eng', 1, {
      workerPath: TESS.workerPath, corePath: TESS.corePath, langPath: TESS.langPath,
      logger: m => { if (onProgress && m && m.status === 'recognizing text') onProgress(m.progress || 0); },
      errorHandler: err => failStart(err instanceof Error ? err : new Error(String(err)))
    });
    try {
      const worker = await Promise.race([created, startFailed]);
      // Sparse-text mode finds table cells and shaded rows that page layout analysis skips
      await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1', user_defined_dpi: '300' });
      return worker;
    } catch (err) {
      created.then(w => w.terminate()).catch(() => null);
      throw err;
    } finally { clearTimeout(timer); }
  }
  function decodeImage(file) {
    const url = URL.createObjectURL(file);
    return new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve({ img: i, url });
      i.onerror = () => { URL.revokeObjectURL(url); reject(Object.assign(new Error('This browser could not open ' + file.name + (/\.hei[cf]$/i.test(file.name) ? ' (HEIC photo). Save it as JPEG, or use Safari.' : '.')), { code: 'decode' })); };
      i.src = url;
    });
  }
  // Scale to ~300 dpi and convert to "brightest channel" gray: colored highlight rows turn light, ink stays dark
  function ocrCanvas(source, w, h) {
    const scale = Math.min(3, OCR_LONG_EDGE / Math.max(w, h));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, c.width, c.height);
    const im = ctx.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.max(d[i], d[i + 1], d[i + 2]); d[i] = d[i + 1] = d[i + 2] = v; }
    ctx.putImageData(im, 0, 0);
    return c;
  }
  async function pdfPageCanvas(pdf, n) {
    const page = await pdf.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = OCR_LONG_EDGE / Math.max(vp1.width, vp1.height);
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return ocrCanvas(c, c.width, c.height);
  }
  function rotateCanvas(src, deg) {
    const c = document.createElement('canvas');
    const quarter = deg % 180 !== 0;
    c.width = quarter ? src.height : src.width; c.height = quarter ? src.width : src.height;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  }
  async function recognizePage(worker, canvas) {
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const lines = [];
    (data.blocks || []).forEach(b => (b.paragraphs || []).forEach(p => (p.lines || []).forEach(l => lines.push({
      baseline: l.baseline, words: (l.words || []).map(w => ({ t: w.text, b: w.bbox, c: w.confidence }))
    }))));
    const ocr = { width: canvas.width, height: canvas.height, conf: data.confidence, lines };
    ocr.quality = ScanCore.ocrQuality(ocr);
    return ocr;
  }
  // OCR one page; if it reads like noise, the page is probably upside down (scanners) or sideways (photos)
  const weakRead = q => q.all >= 20 && q.ratio < 0.5;
  async function ocrPage(worker, canvas, onRotate) {
    let best = await recognizePage(worker, canvas);
    if (!weakRead(best.quality)) return best;
    for (const deg of [180, 90, 270]) {
      if (onRotate) onRotate();
      const r = await recognizePage(worker, rotateCanvas(canvas, deg));
      if (r.quality.good > Math.max(10, best.quality.good * 1.5)) best = r;
      if (!weakRead(best.quality) && best.quality.good >= 25) break;
    }
    return best;
  }
  const pageChars = pg => (pg ? pg.lines.reduce((a, l) => a + l.text.replace(/[\s|]/g, '').length, 0) : 0);
  // Read photos and scanned PDF pages on this device
  async function ocrFiles(files, pdfReads, live, onStatus) {
    const jobs = [];
    files.forEach(f => {
      if (isPdf(f)) {
        const read = pdfReads.find(r => r.file === f);
        if (!read) return;
        for (let p = 1; p <= read.pdf.numPages; p++) {
          // Pages that already carry text are used as-is; only image pages are OCR'd
          const pg = read.pages[p - 1];
          jobs.push(pageChars(pg) >= 80 ? { text: pg } : { pdf: read.pdf, page: p });
        }
      } else jobs.push({ file: f });
    });
    const textJobs = jobs.filter(j => j.text).length;
    const total = Math.min(jobs.length - textJobs, OCR_MAX_PAGES);
    let current = 0, rotating = false;
    onStatus(0, total, 0);
    const worker = total ? await createOcrWorker(p => onStatus(current, total, p, rotating)) : null;
    const pages = [];
    try {
      let n = 0;
      for (const job of jobs) {
        if (!live()) break;
        if (job.text) { pages.push(job.text); continue; }
        if (n >= total) continue;
        current = ++n; rotating = false;
        onStatus(current, total, 0);
        let canvas;
        if (job.pdf) canvas = await pdfPageCanvas(job.pdf, job.page);
        else {
          const { img, url } = await decodeImage(job.file);
          try { canvas = ocrCanvas(img, img.naturalWidth, img.naturalHeight); } finally { URL.revokeObjectURL(url); }
        }
        const ocr = await ocrPage(worker, canvas, () => { rotating = true; onStatus(current, total, 0, true); });
        pages.push(ScanCore.buildPageLinesFromOcr(ocr));
      }
    } finally { if (worker) worker.terminate().catch(() => null); }
    const r = ScanCore.parseStatement(pages, { table: await loadTable().catch(() => null) });
    r.source = 'ocr';
    // statement vocabulary, to tell an unreadable statement from a photo of something else
    const words = pages.map(pg => pg.lines.map(l => l.text).join(' ')).join(' ').match(/\b(merchant|statement|visa|mastercard|discover|amex|deposits?|interchange|fees|chargebacks?|batch|processing)\b/gi) || [];
    r.vocab = new Set(words.map(w => w.toLowerCase().replace(/s$/, ''))).size;
    if (jobs.length - textJobs > OCR_MAX_PAGES) r.warnings.push('Only the first ' + OCR_MAX_PAGES + ' pages were read.');
    return r;
  }
  function looksLikeStatement(r) {
    return Boolean(r && (r.volume > 0 || r.total_fees > 0 || (r.card_mix || []).length || (r.family && r.family !== 'generic')));
  }

  // Build the upload for the AI reader within the request budget
  const tooLarge = () => Object.assign(new Error('Too many pages to upload at once. Try fewer photos.'), { code: 'too_large' });
  async function buildUpload(files, pdfReads) {
    const out = [];
    let used = 0;
    const push = async (name, type, blob) => {
      if (out.length >= MAX_AI_FILES) throw tooLarge();
      used += blob.size; out.push({ name, media_type: type, data: await blobToBase64(blob) });
    };
    let photosLeft = files.filter(f => !isPdf(f) && isImage(f)).length;
    for (const f of files) {
      if (isPdf(f)) {
        const read = pdfReads.find(r => r.file === f);
        if (f.size <= UPLOAD_BUDGET - used) { await push(f.name, 'application/pdf', f); continue; }
        if (!read) throw new Error('Could not open ' + f.name);
        // Large (usually scanned) PDF: send page images instead
        for (let p = 1; p <= Math.min(read.pdf.numPages, 12); p++) {
          let jpg = await pdfPageToJpeg(read.pdf, p, 1500, 0.72);
          if (jpg.size > UPLOAD_BUDGET - used) jpg = await pdfPageToJpeg(read.pdf, p, 1100, 0.6);
          if (jpg.size > UPLOAD_BUDGET - used) break;
          await push(f.name + ' p' + p, 'image/jpeg', jpg);
        }
      } else if (isImage(f)) {
        // share what's left of the budget evenly across the remaining photos
        const target = (UPLOAD_BUDGET - used) / Math.max(1, photosLeft);
        let jpg = null;
        for (const [dim, q] of [[2000, 0.8], [1700, 0.74], [1400, 0.66], [1150, 0.6]]) {
          jpg = await imageToJpeg(f, dim, q);
          if (jpg.size <= target) break;
        }
        if (jpg.size > UPLOAD_BUDGET - used) throw tooLarge();
        photosLeft--;
        await push(f.name, 'image/jpeg', jpg);
      }
    }
    return out;
  }

  let aiRequest = null;   // the in-flight AI call, so Cancel can stop it
  async function callAi(upload) {
    const ctl = new AbortController();
    aiRequest = ctl;
    const t = setTimeout(() => ctl.abort(), AI_TIMEOUT_MS);
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ files: upload }), signal: ctl.signal });
      let body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      if (!res.ok || !body || !body.ok) {
        const code = body && body.code || (res.status === 404 ? 'not_deployed' : 'http_' + res.status);
        if (code === 'not_configured' || code === 'not_deployed') aiPromise = Promise.resolve(false);
        throw Object.assign(new Error(body && body.error || 'The AI reader is unavailable (' + res.status + ').'), { code });
      }
      return body.result;
    } catch (err) {
      if (err.name === 'AbortError') throw Object.assign(new Error('The AI reader took too long. Try uploading just the summary pages.'), { code: 'timeout' });
      throw err;
    } finally { clearTimeout(t); if (aiRequest === ctl) aiRequest = null; }
  }

  // ───────────── Scan orchestration ─────────────
  function assess(r) {
    const missing = [];
    if (r.document_type === 'bank_statement') {
      if (!(r.volume > 0)) missing.push('volume');
      return { missing, plausible: true, needsAi: missing.length > 0 || (!r.merchant_name && !r.address) };
    }
    if (!(r.volume > 0)) missing.push('volume');
    if (!(r.total_fees > 0)) missing.push('fees');
    if (!(r.transactions > 0)) missing.push('transactions');
    const eff = r.volume > 0 && r.total_fees > 0 ? r.total_fees / r.volume : null;
    const plausible = eff == null || (eff > 0.004 && eff < 0.12);
    const needsAi = missing.length > 0 || !plausible || (!r.merchant_name && !r.address);
    return { missing, plausible, needsAi };
  }
  function merge(ai, dev) {
    if (!dev) return ai;
    const out = Object.assign({}, ai);
    ['merchant_name', 'legal_name', 'address', 'mid', 'processor', 'statement_period', 'volume', 'transactions', 'total_fees'].forEach(k => { if (out[k] == null || out[k] === '') out[k] = dev[k]; });
    if (!out.card_mix || !out.card_mix.length) out.card_mix = dev.card_mix;
    if (!out.interchange_lines || !out.interchange_lines.length) out.interchange_lines = dev.interchange_lines;
    // Only show the on-device "Found:" line where both readers agree on the value
    out.evidence = {};
    const ev = dev.evidence || {};
    ['volume', 'transactions', 'total_fees'].forEach(k => { if (ev[k] && dev[k] != null && out[k] != null && Math.abs(dev[k] - out[k]) < 0.01) out.evidence[k] = ev[k]; });
    return out;
  }
  function fromAi(r) {
    // map AI field names onto the on-device result shape
    return Object.assign({}, r, {
      interchange_lines: (r.interchange_lines || []).map(l => ({ name: l.name, brand: l.brand, type: l.type, volume: l.volume, count: l.count, fee: l.fee, rate: l.rate_pct, item: l.per_item, pc: null })),
      warnings: (r.notes || []).slice(),
      evidence: {},
      bank: r.document_type === 'bank_statement' && r.bank ? Object.assign({}, r.bank, { months: Math.max(1, r.bank.months_covered || 1) }) : null
    });
  }

  let scanSeq = 0;   // bumped by every new scan and by Cancel, so a stale scan never reopens a window
  // Why a PDF would not open, in words an agent can act on
  function pdfOpenError(file, err) {
    const why = err && err.name === 'PasswordException' ? 'it is password-protected. Open it, save or print it as a new PDF without a password, and try again'
      : err && err.name === 'InvalidPDFException' ? 'the file is damaged or is not really a PDF'
      : 'the PDF reader could not start (' + (err && err.message || 'unknown error') + ')';
    return 'Could not open ' + file.name + ': ' + why + '.';
  }

  async function scanFiles(fileList, opts) {
    opts = opts || {};
    const my = ++scanSeq, live = () => my === scanSeq;
    const files = Array.from(fileList || []).filter(f => isPdf(f) || isImage(f));
    if (!files.length) { showError('Choose a PDF statement or photos of the statement pages.'); return; }
    const images = files.filter(f => !isPdf(f));
    showProgress(images.length ? 'Preparing ' + (images.length === 1 ? 'photo' : images.length + ' photos') + '…' : 'Reading statement…', files.length > 1 ? files.length + ' files' : files[0].name);
    const aiReady = aiAvailable();
    loadTable().catch(() => null);
    let dev = null, pdfReads = [];
    const pdfErrors = [];
    const pdfs = files.filter(isPdf);
    if (pdfs.length) {
      const settled = await Promise.all(pdfs.map(f => readPdf(f).catch(err => { console.warn('Could not open', f.name, err); pdfErrors.push(pdfOpenError(f, err)); return null; })));
      pdfReads = settled.filter(Boolean);
      if (pdfReads.length) dev = ScanCore.parseStatement([].concat.apply([], pdfReads.map(r => r.pages)), { table: await loadTable().catch(() => null) });
    }
    if (!live()) return;
    // 1) Text PDFs: the on-device reader is instant and exact when it finds everything
    const devUsable = dev && dev.textChars >= 80 && !images.length && !pdfErrors.length;
    if (devUsable && !opts.forceAi && !assess(dev).needsAi) {
      const canRecheck = await aiReady;
      if (live()) showReview(dev, files, { canRecheck });
      return;
    }

    // 2) AI reader (preferred for photos, scans, and incomplete reads) when this site has it
    let aiError = null, uploaded = false;
    if (await aiReady) {
      if (!live()) return;
      showProgress('Analyzing ' + (images.length ? (images.length === 1 ? 'photo' : images.length + ' photos') : 'statement') + ' with AI…', 'Reading every page — this usually takes 15–40 seconds.');
      try {
        const upload = await buildUpload(files, pdfReads);
        if (!live()) return;
        uploaded = true;
        const raw = await callAi(upload);
        if (!live()) return;
        if (raw && raw.is_statement === false) { showNotStatement(files, (raw.notes || []).join(' ')); return; }
        showReview(merge(fromAi(raw), devUsable ? dev : null), files, { canRecheck: false });
        return;
      } catch (err) {
        console.warn('AI read failed', err);
        aiError = err;
      }
      if (!live()) return;
    }
    const aiNote = aiError ? ' (AI reader unavailable: ' + aiError.message + ')' : '';
    // A PDF that would not open: say why instead of guessing
    if (pdfErrors.length && !pdfReads.length && !images.length) { showError(pdfErrors.join(' ') + aiNote, { files }); return; }
    // An incomplete text read, unless some pages are scanned images the OCR can add to
    const imagePages = pdfReads.some(r => r.pages.some(pg => pageChars(pg) < 80));
    const showDev = () => {
      dev.warnings.unshift(aiError ? 'AI reader unavailable (' + aiError.message + ') — showing on-device results.' : 'Some details could not be read automatically — please fill in any highlighted fields.');
      showReview(dev, files, { canRecheck: false });
    };
    if (devUsable && !imagePages) { showDev(); return; }

    // 3) On-device OCR for photos and scanned PDFs (text pages are reused as they are)
    const kind = images.length ? 'photo' : 'page';
    const where = uploaded ? 'Reading on this device instead.' : (images.length ? 'Photos' : 'Pages') + ' are read in your browser — nothing is uploaded.';
    try {
      const r = await ocrFiles(files, pdfReads, live, (i, n, p, rotating) => {
        if (!live()) return;
        const msg = i === 0 ? 'Loading the on-device reader…' : rotating ? kind[0].toUpperCase() + kind.slice(1) + ' ' + i + ' looks rotated — turning it upright…' : 'Reading ' + kind + ' ' + i + ' of ' + n + ' on this device… ' + Math.round(p * 100) + '%';
        setProgress(msg, i === 0 ? 'First use downloads about 3 MB; after that it works offline.' : where);
      });
      if (!live()) return;
      pdfErrors.forEach(e => r.warnings.push(e));
      if (!looksLikeStatement(r)) {
        if (devUsable) { showDev(); return; }
        if (r.vocab >= 2) showError('This looks like a statement, but the totals could not be read on this device. ' + (images.length ? 'Retake the photos flat, in focus, and well lit, with the summary page included' : 'The scan is too low-resolution; rescan it at 200 dpi or higher') + ' — or enter the numbers manually.' + aiNote, { files });
        else showNotStatement(files, (pdfErrors.join(' ') + aiNote).trim());
        return;
      }
      r.warnings.unshift('Read from ' + (images.length ? 'photos' : 'a scanned PDF') + ' on this device. Compare the numbers with the ' + (images.length ? 'photos' : 'statement') + ' before applying' + aiNote + '.');
      showReview(r, files, { canRecheck: false });
    } catch (err) {
      console.warn('On-device OCR failed', err);
      if (!live()) return;
      if (devUsable) { showDev(); return; }
      showError((aiError ? aiError.message + ' ' : '') + (err.code === 'decode' ? err.message : 'The on-device reader could not read these ' + kind + 's (' + err.message + ').'), { files });
    }
  }

  // ───────────── Modal UI ─────────────
  let overlay = null, lastFocus = null;
  function openModal(html) {
    closeModal();
    lastFocus = document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'scan-overlay';
    overlay.innerHTML = '<div class="scan-modal" role="dialog" aria-modal="true" aria-labelledby="scanTitle">' + html + '</div>';
    overlay.addEventListener('mousedown', e => { if (e.target === overlay && !overlay.dataset.busy) closeModal(); });
    document.body.appendChild(overlay);
    return overlay.firstChild;
  }
  function closeModal() {
    if (overlay) { (overlay._urls || []).forEach(u => URL.revokeObjectURL(u)); overlay.remove(); overlay = null; }
    const lb = document.querySelector('.scan-lightbox'); if (lb) lb.remove();
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const lb = document.querySelector('.scan-lightbox');
    if (lb) { lb.remove(); return; }
    if (overlay && !overlay.dataset.busy) closeModal();
  });
  // Full-size photo on top of the review window, to check numbers against the page
  function showPhoto(url, n) {
    const lb = document.createElement('div');
    lb.className = 'scan-lightbox';
    lb.innerHTML = '<div class="scan-lightbox-bar"><span>Page ' + n + '</span><button type="button" aria-label="Close photo">&times;</button></div><img alt="Statement page ' + n + '">';
    lb.querySelector('img').src = url;
    lb.addEventListener('click', e => { if (e.target === lb || e.target.closest('button')) lb.remove(); });
    document.body.appendChild(lb);
  }

  function showProgress(msg, sub) {
    const m = openModal('<h2 id="scanTitle" style="text-align:center">Scan Statement</h2><div class="scan-progress"><div class="scan-spinner"></div><div class="scan-progress-msg" role="status">' + esc(msg) + '</div><div class="scan-progress-sub">' + esc(sub || '') + '</div></div>' +
      '<div class="scan-actions scan-actions-center"><button type="button" data-act="stop">Cancel</button></div>');
    overlay.dataset.busy = '1';
    m.querySelector('[data-act="stop"]').onclick = () => { scanSeq++; if (aiRequest) aiRequest.abort(); closeModal(); };
    return m;
  }
  function setProgress(msg, sub) {
    const m = overlay && overlay.querySelector('.scan-progress-msg');
    if (!m) return;
    m.textContent = msg;
    const s2 = overlay.querySelector('.scan-progress-sub'); if (s2 && sub != null) s2.textContent = sub;
  }
  function showError(msg, opts) {
    opts = opts || {};
    const m = openModal('<h2 id="scanTitle">Scan Statement</h2><div class="scan-error" style="margin-top:0.75rem">' + esc(msg) + '</div>' +
      '<div class="scan-actions"><button type="button" data-act="manual">Enter Manually</button><button type="button" class="primary" data-act="retry">Try Again</button></div>');
    m.querySelector('[data-act="manual"]').onclick = closeModal;
    const photos = (opts.files || []).some(f => !isPdf(f));
    m.querySelector('[data-act="retry"]').onclick = () => (photos && tray.length ? openTray() : openChooser());
  }
  function showNotStatement(files, note) {
    const photos = files.some(f => !isPdf(f));
    const m = openModal('<h2 id="scanTitle">Scan Statement</h2><div class="scan-error" style="margin-top:0.75rem"><strong>This doesn\u2019t look like a merchant processing statement.</strong><br>' +
      (note ? esc(note) + '<br>' : '') +
      (photos ? 'Make sure each photo shows a full statement page — flat, in focus, and well lit — with the summary page included.' : 'Choose the merchant\u2019s card-processing statement.') + '</div>' +
      '<div class="scan-actions"><button type="button" data-act="manual">Enter Manually</button><button type="button" class="primary" data-act="retry">Try Again</button></div>');
    m.querySelector('[data-act="manual"]').onclick = closeModal;
    m.querySelector('[data-act="retry"]').onclick = () => (photos ? openTray() : openChooser());
  }

  const BRAND = { visa: 'Visa', mastercard: 'Mastercard', discover: 'Discover', amex: 'American Express', pin_debit: 'PIN Debit', ebt: 'EBT', other: 'Other', visa_mc_discover: 'Visa / MC / Discover' };
  function showReview(r, files, opts) {
    const name = r.merchant_name ? ScanCore.titleCase(r.merchant_name) : '';
    const legal = r.legal_name && r.legal_name !== r.merchant_name ? ScanCore.titleCase(r.legal_name) : '';
    const warnings = (r.warnings || []).slice();
    const eff0 = r.volume > 0 && r.total_fees > 0 ? r.total_fees / r.volume : null;
    if (eff0 != null && (eff0 < 0.004 || eff0 > 0.12)) warnings.push('The effective rate (' + pct(eff0 * 100) + ') looks unusual — double-check the volume and fees.');
    const ev = r.evidence || {};
    const field = (id, label, value, opts2) => {
      opts2 = opts2 || {};
      const missing = value == null || value === '';
      return '<div class="scan-field' + (opts2.full ? ' full' : '') + '"><label for="' + id + '">' + label + '</label>' +
        '<input id="' + id + '" type="text" inputmode="' + (opts2.inputmode || 'text') + '" autocomplete="off" value="' + esc(missing ? '' : value) + '"' + (missing ? ' class="missing" placeholder="Not found — enter it"' : '') + '>' +
        (opts2.evidence ? '<div class="scan-evidence" title="' + esc(opts2.evidence) + '">Found: ' + esc(opts2.evidence) + '</div>' : '') + (opts2.extra || '') + '</div>';
    };
    const mix = (r.card_mix || []).filter(x => x.volume > 0);
    const mixHtml = mix.length ? '<details class="scan-mix"><summary>Card mix found (' + mix.length + ' card types' + ((r.interchange_lines || []).length ? ', ' + r.interchange_lines.length + ' interchange programs' : '') + ')</summary>' +
      '<div class="table-container" style="margin-top:0.4rem"><table><thead><tr><th>Card</th><th style="text-align:right">Volume</th><th style="text-align:right">Txns</th></tr></thead><tbody>' +
      mix.map(x => '<tr><td>' + esc((BRAND[x.brand] || x.brand) + (x.type && x.type !== 'unknown' && x.brand !== 'pin_debit' && x.brand !== 'ebt' ? ' ' + x.type : '')) + '</td><td class="num">' + money(x.volume) + '</td><td class="num">' + (x.count != null ? Number(x.count).toLocaleString('en-US') : '—') + '</td></tr>').join('') +
      '</tbody></table></div></details>' : '';
    // Bank statement: card deposits and each cost category, per month; checked categories make up the fees
    const bank = r.document_type === 'bank_statement' && r.bank ? r.bank : null;
    const BANK_ROWS = [
      ['processing_fees', 'Processing fees', true], ['software_fees', 'POS software & equipment', true],
      ['misc_fees', 'Bank fees', false], ['mca_payments', 'Cash advance / loan payments', false]
    ];
    const perMonth = v => (bank ? (v || 0) / (bank.months || 1) : 0);
    const who = g => (g && g.sources && g.sources.length ? g.sources.slice(0, 3).map(x => esc(x.name)).join(', ') + (g.sources.length > 3 ? ' +' + (g.sources.length - 3) : '') : '');
    const bankHtml = bank ? '<div class="scan-bank"><div class="scan-bank-title">From the bank statement' + (bank.months > 1 ? ' (monthly average of ' + bank.months + ' statements)' : ', per month') + '</div>' +
      '<div class="table-container"><table><tbody>' +
      '<tr><td>Card-processor deposits</td><td class="num">' + money(perMonth(bank.card_deposits.total)) + '</td><td class="scan-bank-who">' + (bank.card_deposits.count || 0) + ' deposits' + (who(bank.card_deposits) ? ' · ' + who(bank.card_deposits) : '') + '</td></tr>' +
      BANK_ROWS.map(([k, label, on]) => { const g = bank[k] || { total: 0, count: 0 }; return '<tr><td><label><input type="checkbox" data-bank="' + k + '"' + (on ? ' checked' : '') + '> ' + label + '</label></td><td class="num">' + money(perMonth(g.total)) + '</td><td class="scan-bank-who">' + (g.count ? g.count + ' · ' : '') + who(g) + '</td></tr>'; }).join('') +
      (bank.chargebacks && bank.chargebacks.count ? '<tr><td>Chargebacks</td><td class="num">' + money(perMonth(bank.chargebacks.total)) + '</td><td class="scan-bank-who">' + bank.chargebacks.count + '</td></tr>' : '') +
      '</tbody></table></div><div class="scan-bank-note">Checked rows add up to Total Monthly Fees.</div></div>' : '';
    const src = r.source === 'ai' ? '<span class="scan-badge ai">Read by AI</span>'
      : r.source === 'ocr' ? '<span class="scan-badge ocr">Read from ' + (files.some(f => !isPdf(f)) ? 'photos' : 'scan') + ' on-device</span>'
      : '<span class="scan-badge">Read on-device</span>';
    const photoFiles = files.filter(f => !isPdf(f));
    const thumbs = photoFiles.length ? '<div class="scan-thumbs" aria-label="Statement photos">' + photoFiles.map((f, i) =>
      '<a href="#" data-photo="' + i + '" title="Open page ' + (i + 1) + ' to compare"><img alt="Page ' + (i + 1) + '" data-thumb="' + i + '"><span>' + (i + 1) + '</span></a>').join('') + '<span class="scan-thumbs-hint">Tap a page to compare</span></div>' : '';
    const sub = [r.processor, r.statement_period, files.length === 1 ? files[0].name : files.length + ' files'].filter(Boolean).map(esc).join(' · ');
    const kindBadge = bank ? '<span class="scan-badge bank">Bank statement</span>' : '';
    const m = openModal(
      '<h2 id="scanTitle">Review Scanned Statement</h2>' +
      '<div class="scan-sub">' + src + kindBadge + '<span>' + sub + '</span></div>' + thumbs +
      '<div class="scan-fields">' +
      field('scanName', 'Merchant', name, { full: true, extra: legal ? '<div class="scan-alt">Legal name: ' + esc(legal) + ' · <button type="button" data-use="' + esc(legal) + '">use this</button></div>' : '' }) +
      field('scanAddr', 'Address', r.address || '', { full: true }) +
      field('scanVol', 'Monthly Card Volume', r.volume != null ? r.volume.toFixed(2) : '', { inputmode: 'decimal', evidence: ev.volume }) +
      field('scanTxn', '# of Transactions', r.transactions != null ? String(r.transactions) : '', { inputmode: 'numeric', evidence: ev.transactions }) +
      field('scanFees', 'Total Monthly Fees', r.total_fees != null ? r.total_fees.toFixed(2) : '', { inputmode: 'decimal', evidence: ev.total_fees, full: false }) +
      '</div>' +
      '<div class="scan-summary"><div class="kpi"><div class="kpi-label">Effective Rate</div><div class="kpi-value" id="scanEff">—</div></div>' +
      '<div class="kpi"><div class="kpi-label">Average Ticket</div><div class="kpi-value" id="scanAvg">—</div></div>' +
      '<div class="kpi"><div class="kpi-label">Processor Markup</div><div class="kpi-value" id="scanMarkup">—</div><div class="kpi-sub" id="scanMarkupSub">vs. Appendix G cost</div></div></div>' +
      bankHtml + mixHtml +
      (warnings.length ? '<div class="scan-warn"><ul>' + warnings.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div>' : '') +
      '<div class="scan-actions">' + (opts.canRecheck ? '<button type="button" data-act="ai">Double-check with AI</button>' : '') +
      '<span class="spacer"></span><button type="button" data-act="cancel">Cancel</button><button type="button" class="primary" data-act="apply">Apply &amp; Generate Analysis</button></div>'
    );
    const inputs = { name: $('#scanName', m), addr: $('#scanAddr', m), vol: $('#scanVol', m), txn: $('#scanTxn', m), fees: $('#scanFees', m) };
    if (photoFiles.length) {
      const urls = photoFiles.map(f => URL.createObjectURL(f));
      m.querySelectorAll('img[data-thumb]').forEach(img => { img.src = urls[+img.dataset.thumb]; });
      m.querySelectorAll('a[data-photo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); showPhoto(urls[+a.dataset.photo], +a.dataset.photo + 1); }));
      overlay.dataset.urls = '1';
      overlay._urls = urls;
    }
    const altBtn = m.querySelector('[data-use]');
    if (altBtn) altBtn.onclick = () => { inputs.name.value = altBtn.dataset.use; inputs.name.classList.remove('missing'); };
    const update = () => {
      const V = num(inputs.vol.value), T = num(inputs.txn.value), F = num(inputs.fees.value);
      $('#scanEff', m).textContent = V > 0 && F != null ? pct(F / V * 100) : '—';
      $('#scanAvg', m).textContent = V > 0 && T > 0 ? money(V / T) : '—';
      // per-transaction interchange is part of the wholesale cost, so the markup waits for a transaction count
      const mk = state.table && V > 0 && F != null && T > 0 ? ScanCore.computeMarkup({ table: state.table, volume: V, transactions: T, fees: F, cardMix: r.card_mix, lines: r.interchange_lines, assumptions: assumptions() }) : null;
      $('#scanMarkup', m).textContent = mk ? money(mk.markup) + '/mo' : '—';
      $('#scanMarkupSub', m).textContent = mk ? pct(mk.markupPct) + ' of volume · ' + (mk.mode === 'itemized' ? 'itemized' : 'estimated') : V > 0 && F != null && !(T > 0) ? 'Enter # of transactions' : 'vs. Appendix G cost';
    };
    Object.values(inputs).forEach(i => i.addEventListener('input', () => { i.classList.remove('missing'); update(); }));
    m.querySelectorAll('input[data-bank]').forEach(cb => cb.addEventListener('change', () => {
      const sum = Array.from(m.querySelectorAll('input[data-bank]:checked')).reduce((a, c) => a + perMonth((bank[c.dataset.bank] || {}).total), 0);
      inputs.fees.value = (Math.round(sum * 100) / 100).toFixed(2); inputs.fees.classList.remove('missing'); update();
    }));
    loadTable().then(update).catch(update);
    update();
    m.querySelector('[data-act="cancel"]').onclick = closeModal;
    const aiBtn = m.querySelector('[data-act="ai"]');
    if (aiBtn) aiBtn.onclick = () => scanFiles(files, { forceAi: true });
    m.querySelector('[data-act="apply"]').onclick = () => {
      apply(r, { name: inputs.name.value.trim(), address: inputs.addr.value.trim(), volume: num(inputs.vol.value), transactions: num(inputs.txn.value), fees: num(inputs.fees.value) });
    };
    setTimeout(() => { const first = Object.values(inputs).find(i => i.classList.contains('missing')); (first || m.querySelector('[data-act="apply"]')).focus(); }, 30);
  }

  // ───────────── Apply to the comparison ─────────────
  function apply(r, v) {
    D.merchantName = v.name || '';
    D.address = v.address || '';
    if (v.volume != null) D.volume = Math.round(v.volume * 100) / 100;
    if (v.transactions != null) D.transactions = Math.round(v.transactions);
    if (v.fees != null) D.statementFees = Math.round(v.fees * 100) / 100;
    state.scan = { source: r.source, processor: r.processor, period: r.statement_period, card_mix: r.card_mix || [], interchange_lines: r.interchange_lines || [] };
    tray.length = 0;
    state.overrides = {};
    state.signature = '';
    closeModal();
    buildMarkupCard();
    recalcAll();
    switchTab('overview');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll('#tab-overview .merchant-info, #tab-overview .kpi-grid .kpi, #tab-overview .savings-card').forEach(el => {
      el.classList.remove('scan-flash'); void el.offsetWidth; el.classList.add('scan-flash');
    });
    toast('Cost analysis generated' + (D.merchantName ? ' for ' + D.merchantName : '') + ' — review the Overview and Proposal tabs.');
  }

  function toast(msg) {
    const old = $('.scan-toast'); if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'scan-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5200);
  }

  // ───────────── Markup vs. Appendix G (Overview card) ─────────────
  function assumptions() {
    return { assessPct: D.assessPct, assessItem: D.assessItem, amexRate: D.amexRate, amexItem: D.amexItem };
  }
  function markupInput() {
    return { table: state.table, volume: D.volume, transactions: D.transactions, fees: D.statementFees, cardMix: state.scan.card_mix, lines: state.scan.interchange_lines, overrides: state.overrides, assumptions: assumptions() };
  }
  function cardEl() { return document.getElementById('markupCard'); }

  function buildMarkupCard() {
    let card = cardEl();
    if (!card) {
      card = document.createElement('div');
      card.className = 'card';
      card.id = 'markupCard';
      const anchor = document.querySelector('#tab-overview .savings-grid');
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    }
    card.innerHTML =
      '<div class="markup-head"><div class="card-title">Current Processor Markup vs. Appendix G Wholesale Cost<span class="markup-mode" id="mkMode"></span></div>' +
      '<button type="button" class="markup-close" title="Hide markup analysis" aria-label="Hide markup analysis">&times;</button></div>' +
      '<div class="markup-kpis">' +
      '<div class="kpi"><div class="kpi-label">Current Monthly Fees</div><div class="kpi-value" id="mkFees">—</div><div class="kpi-sub" id="mkFeesPct"></div></div>' +
      '<div class="kpi"><div class="kpi-label">True Wholesale Cost</div><div class="kpi-value" id="mkTrue">—</div><div class="kpi-sub" id="mkTruePct"></div></div>' +
      '<div class="kpi"><div class="kpi-label">Processor Markup</div><div class="kpi-value" id="mkMarkup">—</div><div class="kpi-sub" id="mkMarkupPct"></div></div>' +
      '<div class="kpi"><div class="kpi-label">Annual Markup</div><div class="kpi-value" id="mkAnnual">—</div><div class="kpi-sub" id="mkShare"></div></div>' +
      '</div>' +
      '<div class="markup-table-wrap"><table><thead><tr><th>Card Type / Program</th><th style="text-align:right">Volume</th><th style="text-align:right">Txns</th><th>Appendix G Program</th><th style="text-align:right">Wholesale Cost</th></tr></thead><tbody id="mkBody"></tbody>' +
      '<tfoot><tr style="border-top:2px solid var(--border-color);background:var(--bg-section)"><td colspan="4" style="padding:0.55rem 0.8rem;font-weight:700">Interchange (Appendix G)</td><td class="num" id="mkIc" style="padding:0.55rem 0.8rem;font-weight:700">—</td></tr>' +
      '<tr style="background:var(--bg-section)"><td colspan="4" style="padding:0.45rem 0.8rem">American Express (est.)</td><td class="num" id="mkAmex" style="padding:0.45rem 0.8rem">—</td></tr>' +
      '<tr style="background:var(--bg-section)"><td colspan="4" style="padding:0.45rem 0.8rem">Card brand assessments (est.)</td><td class="num" id="mkAssess" style="padding:0.45rem 0.8rem">—</td></tr>' +
      '<tr style="background:var(--bg-section)"><td colspan="4" style="padding:0.55rem 0.8rem;font-weight:700">True Wholesale Cost</td><td class="num" id="mkTrue2" style="padding:0.55rem 0.8rem;font-weight:700">—</td></tr></tfoot></table></div>' +
      '<div class="markup-notes" id="mkNotes"></div>' +
      '<div class="markup-notes">Assumptions (tap to edit): card brand assessments <span class="editable" data-field="assessPct" data-type="pct" onclick="editField(this)">0.14%</span> of volume + ' +
      '<span class="editable" data-field="assessItem" data-type="dollar" onclick="editField(this)">$0.02</span> per transaction; American Express is not in Appendix G and is estimated at ' +
      '<span class="editable" data-field="amexRate" data-type="pct" onclick="editField(this)">1.6%</span> + <span class="editable" data-field="amexItem" data-type="dollar" onclick="editField(this)">$0.10</span>.</div>';
    card.querySelector('.markup-close').onclick = () => { state.scan = null; card.style.display = 'none'; };
    card.style.display = '';
  }

  function programLabel(p) { return p ? p.pc + ' ' + (p.name || 'Program ' + p.pc) + ' · ' + p.rate + '% + $' + p.item.toFixed(2) : '—'; }

  function renderMarkupRows(mk) {
    const body = document.getElementById('mkBody');
    body.innerHTML = mk.rows.map((row, i) => {
      let prog;
      if (row.kind === 'bucket') {
        const opts = ScanCore.programOptions(state.table, row.programBrand, row.programType);
        prog = '<select class="ic-text-input" data-row="' + i + '" data-key="' + esc(row.key) + '" aria-label="Appendix G program for ' + esc(row.label) + '">' +
          opts.map(p => '<option value="' + esc(p.pc) + '"' + (row.program && p.pc === row.program.pc && p.name === row.program.name ? ' selected' : '') + '>' + esc(programLabel(p)) + '</option>').join('') + '</select>';
      } else if (row.kind === 'line') {
        prog = esc(programLabel(row.program)) + (row.method === 'fuzzy' ? ' <span title="Matched by name and rate" style="color:var(--text-muted)">(matched)</span>' : '');
      } else prog = '<span style="color:var(--text-muted)">' + esc(row.note || '') + '</span>';
      const sub = row.kind === 'line' && row.charged != null ? '<div class="kpi-sub">charged ' + money(row.charged) + '</div>' : (row.kind === 'bucket' && row.note ? '<div class="kpi-sub">' + esc(row.note) + '</div>' : '');
      return '<tr><td style="white-space:normal;min-width:150px">' + esc(row.label) + sub + '</td><td class="num">' + money(row.volume) + '</td><td class="num">' + Number(row.count || 0).toLocaleString('en-US') + '</td><td style="white-space:normal">' + prog + '</td><td class="num" data-cost="' + i + '">' + money(row.cost) + '</td></tr>';
    }).join('');
    body.querySelectorAll('select[data-key]').forEach(sel => sel.addEventListener('change', () => { state.overrides[sel.dataset.key] = sel.value; refresh(); }));
  }

  function refresh() {
    const card = cardEl();
    if (!card) return;
    if (!state.scan || !(D.volume > 0) || !state.table) { card.style.display = 'none'; if (state.scan && !state.table) loadTable().then(refresh).catch(() => null); return; }
    card.style.display = '';
    const mk = ScanCore.computeMarkup(markupInput());
    const sig = mk.mode + '|' + mk.rows.map(r => r.kind + r.label).join('|');
    if (sig !== state.signature) { renderMarkupRows(mk); state.signature = sig; }
    else mk.rows.forEach((row, i) => { const c = card.querySelector('[data-cost="' + i + '"]'); if (c) c.textContent = money(row.cost); });
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('mkMode', mk.mode === 'itemized' ? 'Itemized interchange' : mk.mixAssumed ? 'Estimated · assumed card mix' : 'Estimated from card mix');
    set('mkFees', money(mk.fees)); set('mkFeesPct', pct(mk.feesPct) + ' effective rate');
    set('mkTrue', money(mk.trueCost)); set('mkTruePct', pct(mk.trueCostPct) + ' of volume');
    set('mkMarkup', money(mk.markup)); set('mkMarkupPct', pct(mk.markupPct) + ' of volume (' + Math.round(mk.markupPct * 100) + ' bps)');
    set('mkAnnual', money(mk.markup * 12)); set('mkShare', mk.fees > 0 ? Math.round(mk.markupShare) + '% of current fees' : '');
    set('mkIc', money(mk.interchange)); set('mkAmex', money(mk.amex)); set('mkAssess', money(mk.assessments)); set('mkTrue2', money(mk.trueCost));
    const notes = [];
    if (mk.mode === 'itemized') notes.push('Interchange priced line-by-line from the ' + mk.linesMatched + ' programs itemized on the statement, using Appendix G rates.');
    else notes.push('The statement does not itemize interchange, so each card type is priced with the Appendix G program selected in the table — change a program to match the merchant’s cards.');
    if (mk.mixAssumed) notes.push('No card-type breakdown was found on the statement; a 60% credit / 40% debit Visa mix is assumed.');
    if (mk.interchangePadding != null && Math.abs(mk.interchangePadding) >= 1) notes.push('Interchange billed on the statement is ' + money(Math.abs(mk.interchangePadding)) + (mk.interchangePadding > 0 ? ' above' : ' below') + ' Appendix G for the same programs' + (mk.interchangePadding > 0 ? ' — the processor is marking up interchange.' : '.'));
    if (mk.markup < 0) notes.push('Estimated wholesale cost is higher than this statement’s fees. Business, commercial, or keyed transactions cost more than the default programs — select programs that match the merchant.');
    document.getElementById('mkNotes').textContent = notes.join(' ');
  }

  // ───────────── Entry points: choose PDF or photos ─────────────
  const ICON = {
    pdf: '<svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>',
    photos: '<svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>',
    camera: '<svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></svg>'
  };
  ICON.resume = ICON.photos;
  const touch = () => window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const tray = [];   // photos collected for one statement, in page order

  const inputs = {};
  let pickFresh = false;   // photos chosen from the start screen begin a new set; the tray's Add buttons append
  function picker(kind, fresh) {
    pickFresh = Boolean(fresh);
    if (!inputs[kind]) {
      const el = document.createElement('input');
      el.type = 'file';
      el.style.display = 'none';
      if (kind === 'pdf') { el.accept = 'application/pdf,.pdf'; el.multiple = true; }
      if (kind === 'photos') { el.accept = 'image/*'; el.multiple = true; }
      if (kind === 'camera') { el.accept = 'image/*'; el.setAttribute('capture', 'environment'); }
      el.addEventListener('change', () => {
        const f = Array.from(el.files || []); el.value = '';
        if (!f.length) return;
        if (kind === 'pdf') { scanFiles(f); return; }
        if (pickFresh) tray.length = 0;
        const pdfsPicked = f.filter(isPdf);
        addToTray(f);
        if (!tray.length && pdfsPicked.length) { scanFiles(pdfsPicked); return; }   // a PDF picked under "photos"
        openTray();
      });
      document.body.appendChild(el);
      inputs[kind] = el;
    }
    inputs[kind].click();
  }

  function openChooser() {
    const opt = (kind, title, desc, cls) => '<button type="button" class="scan-option' + (cls ? ' ' + cls : '') + '" data-pick="' + kind + '">' + ICON[kind] +
      '<span><strong>' + title + '</strong><small>' + desc + '</small></span></button>';
    const m = openModal('<h2 id="scanTitle">Scan Statement</h2>' +
      '<div class="scan-sub">Read the merchant\u2019s processing statement or bank statement to fill in this comparison.</div>' +
      '<div class="scan-options">' +
      (tray.length ? opt('resume', 'Continue with ' + tray.length + (tray.length === 1 ? ' photo' : ' photos'), 'Pick up the photos you already added.') : '') +
      opt('pdf', 'PDF Statement', 'Upload the statement PDF the merchant downloaded or emailed.') +
      opt('photos', 'Statement Photos', 'Upload photos of each page \u2014 select all the pages at once.') +
      (touch() ? opt('camera', 'Take Photos', 'Use the camera to photograph each page.') : '') +
      '</div>' +
      '<div class="scan-tip">' + (touch() ? 'Photograph pages flat and in good light, with the summary page first.' : 'Tip: you can also drag a PDF or photos onto this page.') + '</div>' +
      '<div class="scan-actions"><button type="button" data-act="cancel">Cancel</button></div>');
    m.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => (b.dataset.pick === 'resume' ? openTray() : picker(b.dataset.pick, true))));
    m.querySelector('[data-act="cancel"]').onclick = closeModal;
    setTimeout(() => { const b = m.querySelector('[data-pick]'); if (b) b.focus(); }, 30);
  }

  function addToTray(files) {
    files.filter(isImage).forEach(f => {
      if (!tray.some(t => t.name === f.name && t.size === f.size && t.lastModified === f.lastModified)) tray.push(f);
    });
  }
  function openTray() {
    if (!tray.length) { openChooser(); return; }
    const n = tray.length;
    const m = openModal('<h2 id="scanTitle">Statement Photos</h2>' +
      '<div class="scan-sub">' + n + (n === 1 ? ' page' : ' pages') + ' \u00b7 put the summary page (page 1) first</div>' +
      '<div class="scan-tray">' + tray.map((f, i) =>
        '<figure class="scan-page"><div class="scan-page-img"><img alt="Page ' + (i + 1) + '" data-i="' + i + '"></div>' +
        '<figcaption>Page ' + (i + 1) + '</figcaption>' +
        '<div class="scan-page-tools"><button type="button" data-move="-1" data-i="' + i + '" aria-label="Move page ' + (i + 1) + ' earlier"' + (i === 0 ? ' disabled' : '') + '>&#8249;</button>' +
        '<button type="button" data-remove="' + i + '" aria-label="Remove page ' + (i + 1) + '">&times;</button>' +
        '<button type="button" data-move="1" data-i="' + i + '" aria-label="Move page ' + (i + 1) + ' later"' + (i === n - 1 ? ' disabled' : '') + '>&#8250;</button></div></figure>').join('') +
      '<div class="scan-add-col"><button type="button" class="scan-add" data-add="photos">' + ICON.photos + '<span>Add photos</span></button>' +
      (touch() ? '<button type="button" class="scan-add" data-add="camera">' + ICON.camera + '<span>Take photo</span></button>' : '') + '</div></div>' +
      '<div class="scan-tip">Include every page that shows totals or fees. Retake pages that are blurry or cut off.</div>' +
      '<div class="scan-actions"><button type="button" data-act="clear">Start Over</button><span class="spacer"></span><button type="button" data-act="cancel">Cancel</button>' +
      '<button type="button" class="primary" data-act="read">Read ' + n + (n === 1 ? ' Page' : ' Pages') + '</button></div>');
    const urls = tray.map(f => URL.createObjectURL(f));
    overlay._urls = urls;
    m.querySelectorAll('img[data-i]').forEach(img => {
      img.onerror = () => { img.replaceWith(Object.assign(document.createElement('span'), { className: 'scan-page-noimg', textContent: tray[+img.dataset.i].name })); };
      img.src = urls[+img.dataset.i];
    });
    m.querySelectorAll('[data-move]').forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.i, j = i + (+b.dataset.move);
      if (j < 0 || j >= tray.length) return;
      const t = tray[i]; tray[i] = tray[j]; tray[j] = t; openTray();
    }));
    m.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => { tray.splice(+b.dataset.remove, 1); tray.length ? openTray() : openChooser(); }));
    m.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => picker(b.dataset.add, false)));
    m.querySelector('[data-act="clear"]').onclick = () => { tray.length = 0; openChooser(); };
    m.querySelector('[data-act="cancel"]').onclick = closeModal;
    m.querySelector('[data-act="read"]').onclick = () => scanFiles(tray.slice());
    setTimeout(() => m.querySelector('[data-act="read"]').focus(), 30);
  }
  // Kept for callers that just want a file dialog
  function pickFiles() { openChooser(); }

  function init() {
    // Assumption defaults used by the markup card (editable like every other field)
    const A = ScanCore.DEFAULT_ASSUMPTIONS;
    if (D.assessPct == null) D.assessPct = A.assessPct;
    if (D.assessItem == null) D.assessItem = A.assessItem;
    if (D.amexRate == null) D.amexRate = A.amexRate;
    if (D.amexItem == null) D.amexItem = A.amexItem;
    const btn = document.getElementById('scanBtn');
    if (btn) btn.addEventListener('click', openChooser);
    // Drag & drop a statement anywhere on the page (desktop)
    const drop = document.createElement('div');
    drop.className = 'scan-drop'; drop.textContent = 'Drop the statement PDF or photos to scan them';
    document.body.appendChild(drop);
    let depth = 0;
    const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0;
    window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; depth++; drop.classList.add('show'); });
    window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('show'); });
    window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', e => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth = 0; drop.classList.remove('show');
      if (overlay && overlay.dataset.busy) { toast('Finish or cancel the current scan first.'); return; }
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length && files.every(isImage)) {   // photos: review page order first
        if (!(overlay && overlay.querySelector('.scan-tray'))) tray.length = 0;   // a new set unless the tray is open
        addToTray(files); openTray();
      } else scanFiles(files);
    });
  }

  window.ScanUI = { scanFiles, pickFiles, openChooser, openTray, addToTray, refresh, _state: state, _tray: tray };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
