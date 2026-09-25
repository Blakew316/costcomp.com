/* ═══════════════════════════════════════════════════════════════
   scan.js — "Scan Statement" feature for the cost comparison page.
   Reads a merchant statement (PDF or photos), lets the agent review
   the numbers, fills the comparison, and shows the current processor's
   markup against the Appendix G interchange schedule.
   Engines:  on-device (PDF.js text + ScanCore parser, instant, free)
             AI (/api/scan-statement Netlify Function, photos & scans)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/';
  const API = '/api/scan-statement';
  const UPLOAD_BUDGET = 4200000;   // raw bytes; base64 inflates ~33% and Netlify accepts ~6 MB
  const AI_TIMEOUT_MS = 58000;

  const state = { scan: null, overrides: {}, table: null, signature: '' };
  let pdfjsPromise = null, tablePromise = null, aiPromise = null;

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

  // Build the upload for the AI reader within the request budget
  async function buildUpload(files, pdfReads) {
    const out = [];
    let used = 0;
    const push = async (name, type, blob) => { used += blob.size; out.push({ name, media_type: type, data: await blobToBase64(blob) }); };
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
        let jpg = await imageToJpeg(f, 2000, 0.8);
        if (jpg.size > UPLOAD_BUDGET - used) jpg = await imageToJpeg(f, 1400, 0.65);
        if (jpg.size > UPLOAD_BUDGET - used) throw Object.assign(new Error('Too many pages to upload at once. Try fewer photos.'), { code: 'too_large' });
        await push(f.name, 'image/jpeg', jpg);
      }
    }
    return out;
  }

  async function callAi(upload) {
    const ctl = new AbortController();
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
    } finally { clearTimeout(t); }
  }

  // ───────────── Scan orchestration ─────────────
  function assess(r) {
    const missing = [];
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
      evidence: {}
    });
  }

  async function scanFiles(fileList, opts) {
    opts = opts || {};
    const files = Array.from(fileList || []).filter(f => isPdf(f) || isImage(f));
    if (!files.length) { showError('Choose a PDF statement or photos of the statement pages.'); return; }
    showProgress('Reading statement…', files.length > 1 ? files.length + ' files' : files[0].name);
    const aiReady = aiAvailable();
    loadTable().catch(() => null);
    let dev = null, pdfReads = [];
    try {
      const pdfs = files.filter(isPdf);
      if (pdfs.length) {
        pdfReads = await Promise.all(pdfs.map(readPdf));
        const pages = [].concat.apply([], pdfReads.map(r => r.pages));
        dev = ScanCore.parseStatement(pages, { table: await loadTable().catch(() => null) });
      }
    } catch (err) {
      console.warn('On-device read failed', err);
    }
    const hasImages = files.some(f => !isPdf(f));
    const devUsable = dev && dev.textChars >= 80 && !hasImages;
    const check = devUsable ? assess(dev) : { needsAi: true, missing: [] };
    const useAi = opts.forceAi || check.needsAi;
    if (!useAi) { showReview(dev, files, { canRecheck: await aiReady }); return; }

    if (!(await aiReady)) {
      if (devUsable) {
        dev.warnings.unshift('Some details could not be read automatically — please fill in any highlighted fields.');
        showReview(dev, files, { canRecheck: false });
      } else {
        showError(hasImages
          ? 'Reading photos needs the AI reader, which is not set up on this site yet. Upload the statement PDF instead, or enter the numbers by hand.'
          : 'This PDF is a scanned image with no readable text. The AI reader can read it once it is set up on this site — until then, enter the numbers by hand.', { files });
      }
      return;
    }
    showProgress('Analyzing statement with AI…', 'Reading every page — this usually takes 15–40 seconds.');
    try {
      const upload = await buildUpload(files, pdfReads);
      const ai = fromAi(await callAi(upload));
      showReview(merge(ai, devUsable ? dev : null), files, { canRecheck: false });
    } catch (err) {
      console.warn('AI read failed', err);
      if (devUsable) {
        dev.warnings.unshift('AI reader unavailable (' + err.message + ') — showing on-device results.');
        showReview(dev, files, { canRecheck: false });
      } else showError(err.message || 'Could not read this statement.', { files });
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
    if (overlay) { overlay.remove(); overlay = null; }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay && !overlay.dataset.busy) closeModal(); });

  function showProgress(msg, sub) {
    const m = openModal('<h2 id="scanTitle" style="text-align:center">Scan Statement</h2><div class="scan-progress"><div class="scan-spinner"></div><div class="scan-progress-msg">' + esc(msg) + '</div><div class="scan-progress-sub">' + esc(sub || '') + '</div></div>');
    overlay.dataset.busy = '1';
    return m;
  }
  function showError(msg, opts) {
    opts = opts || {};
    const m = openModal('<h2 id="scanTitle">Scan Statement</h2><div class="scan-error" style="margin-top:0.75rem">' + esc(msg) + '</div>' +
      '<div class="scan-actions"><button type="button" data-act="manual">Enter Manually</button><button type="button" class="primary" data-act="retry">Choose Another File</button></div>');
    m.querySelector('[data-act="manual"]').onclick = closeModal;
    m.querySelector('[data-act="retry"]').onclick = () => { closeModal(); pickFiles(); };
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
    const src = r.source === 'ai' ? '<span class="scan-badge ai">Read by AI</span>' : '<span class="scan-badge">Read on-device</span>';
    const sub = [r.processor, r.statement_period, files.length === 1 ? files[0].name : files.length + ' files'].filter(Boolean).map(esc).join(' · ');
    const m = openModal(
      '<h2 id="scanTitle">Review Scanned Statement</h2>' +
      '<div class="scan-sub">' + src + '<span>' + sub + '</span></div>' +
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
      mixHtml +
      (warnings.length ? '<div class="scan-warn"><ul>' + warnings.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul></div>' : '') +
      '<div class="scan-actions">' + (opts.canRecheck ? '<button type="button" data-act="ai">Double-check with AI</button>' : '') +
      '<span class="spacer"></span><button type="button" data-act="cancel">Cancel</button><button type="button" class="primary" data-act="apply">Apply &amp; Generate Analysis</button></div>'
    );
    const inputs = { name: $('#scanName', m), addr: $('#scanAddr', m), vol: $('#scanVol', m), txn: $('#scanTxn', m), fees: $('#scanFees', m) };
    const altBtn = m.querySelector('[data-use]');
    if (altBtn) altBtn.onclick = () => { inputs.name.value = altBtn.dataset.use; inputs.name.classList.remove('missing'); };
    const update = () => {
      const V = num(inputs.vol.value), T = num(inputs.txn.value), F = num(inputs.fees.value);
      $('#scanEff', m).textContent = V > 0 && F != null ? pct(F / V * 100) : '—';
      $('#scanAvg', m).textContent = V > 0 && T > 0 ? money(V / T) : '—';
      const mk = state.table && V > 0 && F != null ? ScanCore.computeMarkup({ table: state.table, volume: V, transactions: T || 0, fees: F, cardMix: r.card_mix, lines: r.interchange_lines, assumptions: assumptions() }) : null;
      $('#scanMarkup', m).textContent = mk ? money(mk.markup) + '/mo' : '—';
      $('#scanMarkupSub', m).textContent = mk ? pct(mk.markupPct) + ' of volume · ' + (mk.mode === 'itemized' ? 'itemized' : 'estimated') : 'vs. Appendix G cost';
    };
    Object.values(inputs).forEach(i => i.addEventListener('input', () => { i.classList.remove('missing'); update(); }));
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

  // ───────────── Entry points ─────────────
  let input = null;
  function pickFiles() {
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,.pdf,image/*';
      input.multiple = true;
      input.style.display = 'none';
      input.addEventListener('change', () => { const f = Array.from(input.files || []); input.value = ''; if (f.length) scanFiles(f); });
      document.body.appendChild(input);
    }
    input.click();
  }

  function init() {
    // Assumption defaults used by the markup card (editable like every other field)
    const A = ScanCore.DEFAULT_ASSUMPTIONS;
    if (D.assessPct == null) D.assessPct = A.assessPct;
    if (D.assessItem == null) D.assessItem = A.assessItem;
    if (D.amexRate == null) D.amexRate = A.amexRate;
    if (D.amexItem == null) D.amexItem = A.amexItem;
    const btn = document.getElementById('scanBtn');
    if (btn) btn.addEventListener('click', pickFiles);
    // Drag & drop a statement anywhere on the page (desktop)
    const drop = document.createElement('div');
    drop.className = 'scan-drop'; drop.textContent = 'Drop the merchant statement to scan it';
    document.body.appendChild(drop);
    let depth = 0;
    const hasFiles = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') >= 0;
    window.addEventListener('dragenter', e => { if (!hasFiles(e)) return; depth++; drop.classList.add('show'); });
    window.addEventListener('dragleave', e => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('show'); });
    window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; drop.classList.remove('show'); scanFiles(e.dataTransfer.files); });
  }

  window.ScanUI = { scanFiles, pickFiles, refresh, _state: state };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
