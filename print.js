/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 *
 * Built-in print for the PDF viewer, laid out like the familiar Acrobat print window:
 * printer / copies / grayscale, pages to print (all, current, ranges, odd/even, reverse),
 * Page Sizing & Handling (Size: fit / actual / shrink / custom scale · Poster tiling · Multiple pages per sheet
 * with page order · Booklet: fold-and-staple or cut-and-pin with any number of pages per side),
 * both-sided printing, orientation, comments & forms, and a live preview with page browsing.
 */
(() => {
  'use strict';
  const V = window.FRZViewer;
  if (!V || !window.pdfjsLib) return;
  const PK = 'frz-print-default'; // '' = ask, 'system' = quick print, 'frz' = this dialog
  const getPref = () => { try { return localStorage.getItem(PK) || ''; } catch (e) { return ''; } };
  const setPref = v => { try { v ? localStorage.setItem(PK, v) : localStorage.removeItem(PK); } catch (e) { } const s = document.getElementById('setPrintDefault'); if (s) s.value = v; const d = document.getElementById('prDefault'); if (d) d.value = v; };
  const PAPER = { A4: [595.28, 841.89], A3: [841.89, 1190.55], A5: [419.53, 595.28], Letter: [612, 792], Legal: [612, 1008], Tabloid: [792, 1224] };
  const GRID = { 1: [1, 1], 2: [2, 1], 4: [2, 2], 6: [3, 2], 8: [4, 2], 9: [3, 3], 12: [4, 3], 16: [4, 4] }; // [long, short]
  const MM = 72 / 25.4;
  const IN = 72;

  const css = document.createElement('style');
  css.textContent = `
  .frz-print-dialog{width:min(980px,calc(100vw - 16px));max-height:calc(100dvh - 16px);overflow:auto;padding:0;border:1px solid var(--gold-line);border-radius:12px;background:var(--surface);color:var(--text)}
  .frz-print-dialog::backdrop{background:rgba(3,5,8,.7)}
  .frz-print-dialog [hidden]{display:none!important}
  .frz-print-dialog .pr-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);z-index:2}
  .frz-print-dialog .pr-head h2{margin:0;font:600 20px var(--font-display);flex:1}
  .frz-print-dialog .pr-head .sub{font-size:12px;color:var(--text-muted)}
  .frz-print-dialog .pr-body{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:12px;padding:12px 16px}
  .frz-print-dialog .pr-left{display:flex;flex-direction:column;gap:10px;min-width:0}
  .frz-print-dialog .pr-right{position:sticky;top:60px;align-self:start;border:1px solid var(--border);border-radius:10px;padding:10px;background:var(--surface-2);min-width:0}
  .frz-print-dialog .pr-box{border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--surface)}
  .frz-print-dialog .pr-box>h3{margin:0 0 8px;font:600 13px var(--font-body);color:var(--text)}
  .frz-print-dialog .row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:6px 0}
  .frz-print-dialog label{font-size:13px;display:flex;gap:6px;align-items:center}
  .frz-print-dialog select,.frz-print-dialog input[type=text],.frz-print-dialog input[type=number]{background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 8px;font:500 13px var(--font-body);min-height:32px;max-width:100%}
  .frz-print-dialog input[type=number]{width:72px}
  .frz-print-dialog button{font:600 13px var(--font-body);border-radius:8px;padding:7px 14px;cursor:pointer;min-height:34px;border:1px solid var(--border);background:var(--surface-2);color:var(--text)}
  .frz-print-dialog button:disabled{opacity:.55;cursor:default}
  .frz-print-dialog button.primary{background:var(--gold);color:#1a1508;border-color:var(--gold)}
  .frz-print-dialog .hint{font-size:12px;color:var(--text-muted);line-height:1.5;margin:4px 0}
  .frz-print-dialog .seg{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:8px}
  .frz-print-dialog .seg button{padding:9px 4px}
  .frz-print-dialog .seg button[aria-pressed=true]{background:var(--gold-soft,rgba(212,175,55,.18));border-color:var(--gold);box-shadow:0 0 0 1px var(--gold) inset}
  .frz-print-dialog .sub-panel{border-top:1px solid var(--border-soft);padding-top:6px}
  .frz-print-dialog details summary{cursor:pointer;font:600 12.5px var(--font-body);color:var(--text-muted);margin:4px 0}
  .frz-print-dialog .pv-meta{display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:6px}
  .frz-print-dialog .pv-stage{display:flex;align-items:center;justify-content:center;min-height:300px;background:var(--surface);border:1px solid var(--border-soft);border-radius:8px;padding:8px}
  .frz-print-dialog .pv-stage canvas{max-width:100%;height:auto;background:#fff;box-shadow:0 1px 6px rgba(0,0,0,.35)}
  .frz-print-dialog .pv-nav{display:flex;align-items:center;gap:8px;margin-top:10px}
  .frz-print-dialog .pv-nav input[type=range]{flex:1;min-width:0}
  .frz-print-dialog .pv-nav button{padding:4px 10px;min-height:30px}
  .frz-print-dialog .pv-count{text-align:center;font-size:12.5px;margin-top:4px}
  .frz-print-dialog .sum{font-size:12px;line-height:1.5;color:var(--text-muted);max-height:96px;overflow:auto;white-space:pre-wrap;margin-top:8px}
  .frz-print-dialog .pr-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 16px;border-top:1px solid var(--border);position:sticky;bottom:0;background:var(--surface);z-index:2}
  .frz-print-dialog .pr-foot .grow{flex:1;min-width:120px}
  .frz-print-dialog .pr-foot .msg{font-size:12px;color:var(--text-muted);min-height:16px}
  .frz-print-dialog select{min-width:0;max-width:100%;text-overflow:ellipsis}
  .frz-print-dialog label{flex-wrap:wrap;min-width:0}
  @media(max-width:760px){.frz-print-dialog{margin:0;width:100vw;max-width:100vw;height:100dvh;max-height:100dvh;border-radius:0}.frz-print-dialog .pr-head{flex-wrap:wrap}.frz-print-dialog .pr-head .sub{order:3;flex-basis:100%}.frz-print-dialog select,.frz-print-dialog input[type=text]{width:100%}.frz-print-dialog #prPrinter{width:100%}}
  @media(max-width:820px){.frz-print-dialog .pr-body{grid-template-columns:1fr}.frz-print-dialog .pr-right{position:static;order:-1}.frz-print-dialog .pv-stage{min-height:200px}}
  .frz-print-ask{width:min(440px,calc(100vw - 28px));padding:20px;border:1px solid var(--gold-line);border-radius:14px;background:var(--surface);color:var(--text)}
  .frz-print-ask::backdrop{background:rgba(3,5,8,.7)}
  .frz-print-ask h2{margin:0 0 8px;font:600 20px var(--font-display)}
  .frz-print-ask p{font-size:14px;line-height:1.55;color:var(--text-muted)}
  .frz-print-ask .row{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:14px}
  .frz-print-ask button{font:600 13px var(--font-body);border-radius:9px;padding:9px 14px;cursor:pointer;border:1px solid var(--border);background:var(--surface-2);color:var(--text)}
  .frz-print-ask button.primary{background:var(--gold);color:#1a1508;border-color:var(--gold)}
  #frzPrintRoot{display:none}
  @media print{
    body>*:not(#frzPrintRoot){display:none!important}
    dialog{display:none!important}
    html,body{height:auto!important;overflow:visible!important;background:#fff!important}
    #frzPrintRoot{display:block!important}
    #frzPrintRoot .frz-sheet{break-after:page;page-break-after:always;overflow:hidden}
    #frzPrintRoot .frz-sheet:last-child{break-after:auto;page-break-after:auto}
    #frzPrintRoot img{display:block;width:100%;height:100%}
  }`;
  document.head.appendChild(css);

  /* ---------- helpers ---------- */
  function parseRange(str, n) {
    const out = [];
    for (const part of String(str).split(',').map(s => s.trim()).filter(Boolean)) {
      const m = part.match(/^(\d*)\s*(?:-\s*(\d*))?$/); if (!m || (m[1] === '' && m[2] === undefined)) throw new Error('Cannot read “' + part + '”. Use something like 1-5, 8, 11-13');
      const dash = part.includes('-');
      let a = m[1] === '' ? 1 : +m[1], b = dash ? (m[2] === '' || m[2] === undefined ? n : +m[2]) : a;
      if (a < 1 || b < 1 || a > n || b > n) throw new Error('Page numbers must be between 1 and ' + n + '.');
      if (a <= b) for (let i = a; i <= b; i++) out.push(i - 1); else for (let i = a; i >= b; i--) out.push(i - 1);
    }
    if (!out.length) throw new Error('Enter at least one page.');
    return out;
  }
  const label = (P, i) => i == null ? 'blank' : String(P[i] + 1);
  const isBooklet = k => k === 'fold' || k === 'cut';

  /* ---------- imposition: returns {sides:[cells[]], sheets:[[w,h]], tiles:[tile|null], cols, rows, per, kind} ---------- */
  function impose(P, o, pd) {
    const n = P.length, kind = o.layout; let k = 1;
    if (kind === 'multi' || kind === 'cut') k = +o.k; if (kind === 'fold') k = 2;
    const mk = (landscape, dim) => {
      if (o.paper === 'same') { const a = Math.max(dim[0], dim[1]), b = Math.min(dim[0], dim[1]); return landscape ? [a, b] : [b, a]; }
      const p = PAPER[o.paper] || PAPER.A4; return landscape ? [Math.max(...p), Math.min(...p)] : [Math.min(...p), Math.max(...p)];
    };
    if (kind === 'single' || kind === 'poster') {
      const sides = [], sheets = [], tiles = [];
      for (let i = 0; i < n; i++) {
        const dim = pd[P[i]]; const land = o.orient === 'landscape' ? true : o.orient === 'portrait' ? false : dim[0] > dim[1];
        const sheet = o.paper === 'same' && o.orient === 'auto' ? [dim[0], dim[1]] : mk(land, dim);
        if (kind === 'single') { sides.push([i]); sheets.push(sheet); tiles.push(null); continue; }
        const s = Math.max(0.1, o.tileScale / 100) , m = o.margin * MM, ov = o.overlap * MM, rw = sheet[0] - 2 * m, rh = sheet[1] - 2 * m;
        const W = dim[0] * s, H = dim[1] * s;
        const nx = W <= rw + 0.5 ? 1 : Math.ceil((W - ov) / (rw - ov)), ny = H <= rh + 0.5 ? 1 : Math.ceil((H - ov) / (rh - ov));
        for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) { sides.push([i]); sheets.push(sheet); tiles.push({ tx, ty, nx, ny }); }
      }
      return { sides, sheets, tiles, cols: 1, rows: 1, per: 1, kind, sheet: sheets[0] };
    }
    let [long, short] = GRID[k] || GRID[4];
    let landscape;
    if (o.orient === 'landscape') landscape = true; else if (o.orient === 'portrait') landscape = false;
    else landscape = kind === 'fold' ? true : (o.paper === 'same' ? pd[P[0]][0] > pd[P[0]][1] : (long > short));
    const sheet = mk(landscape, pd[P[0]]);
    const cols = landscape ? long : short, rows = landscape ? short : long;
    const per = cols * rows; const sides = [];
    if (kind === 'multi') {
      const slot = j => { let r, c; if (o.order === 'hr') { r = Math.floor(j / cols); c = cols - 1 - (j % cols); } else if (o.order === 'v') { c = Math.floor(j / rows); r = j % rows; } else if (o.order === 'vr') { c = cols - 1 - Math.floor(j / rows); r = j % rows; } else { r = Math.floor(j / cols); c = j % cols; } return r * cols + c; };
      for (let i = 0; i < n; i += per) { const c = new Array(per).fill(null); for (let j = 0; j < per; j++) c[slot(j)] = i + j < n ? i + j : null; sides.push(c); }
    } else if (kind === 'fold') {
      const m = Math.ceil(n / 4) * 4, at = i => (i >= 0 && i < n ? i : null), flipCols = (o.flip === 'long') === !landscape;
      for (let s = 0; s < m / 4; s++) {
        let a = [at(m - 1 - 2 * s), at(2 * s)], b = flipCols ? [at(2 * s + 1), at(m - 2 - 2 * s)] : [at(m - 2 - 2 * s), at(2 * s + 1)];
        if (o.binding === 'right') { a = [a[1], a[0]]; b = [b[1], b[0]]; }
        sides.push(a); sides.push(b);
      }
    } else { // cut & pin: leaf j of a sheet carries pages 2j (front) and 2j+1 (back, mirrored across the flip axis)
      const flipCols = (o.flip === 'long') === !landscape;
      const mirror = c => { const r = Math.floor(c / cols), q = c % cols; return flipCols ? r * cols + (cols - 1 - q) : (rows - 1 - r) * cols + q; };
      const sheetsN = Math.ceil(n / (2 * per));
      for (let s = 0; s < sheetsN; s++) {
        const f = new Array(per).fill(null), b = new Array(per).fill(null);
        for (let j = 0; j < per; j++) { const a = s * 2 * per + 2 * j, c = a + 1; f[j] = a < n ? a : null; b[mirror(j)] = c < n ? c : null; }
        sides.push(f, b);
      }
    }
    return { sides, sheets: sides.map(() => sheet), tiles: sides.map(() => null), cols, rows, per, kind, sheet };
  }

  /* ---------- placing a page inside its cell ---------- */
  function cellRects(L, o, sheet) {
    const [W, H] = sheet, m = o.margin * MM, g = o.gap * MM;
    const cw = (W - 2 * m - g * (L.cols - 1)) / L.cols, ch = (H - 2 * m - g * (L.rows - 1)) / L.rows; const out = [];
    for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) out.push({ x: m + c * (cw + g), y: m + r * (ch + g), w: cw, h: ch });
    return out;
  }
  /* returns the drawn rectangle on the sheet (top-left origin), the scale, and the part of the page (top-left, points) that is visible */
  function place(pw, ph, R, pad, o, per, tile) {
    const rw = R.w - 2 * pad, rh = R.h - 2 * pad;
    if (tile) { const s = Math.max(0.1, o.tileScale / 100), ov = o.overlap * MM; const x0 = tile.tx * (rw - ov) / s, y0 = tile.ty * (rh - ov) / s; const x1 = Math.min(pw, x0 + rw / s), y1 = Math.min(ph, y0 + rh / s); return { x: R.x + pad, y: R.y + pad, w: (x1 - x0) * s, h: (y1 - y0) * s, s, x0, y0, x1, y1 }; }
    const fitS = Math.min(rw / pw, rh / ph); let s;
    if (per > 1 || o.scaleMode === 'fit') s = fitS; else if (o.scaleMode === 'shrink') s = Math.min(1, fitS); else if (o.scaleMode === 'actual') s = 1; else s = Math.max(0.05, (o.scalePct || 100) / 100);
    let w = pw * s, h = ph * s, x = R.x + (R.w - w) / 2, y = R.y + (R.h - h) / 2, x0 = 0, y0 = 0, x1 = pw, y1 = ph;
    if (w > rw + 0.01) { const cut = (w - rw) / 2 / s; x0 = cut; x1 = pw - cut; x = R.x + pad; w = rw; }
    if (h > rh + 0.01) { const cut = (h - rh) / 2 / s; y0 = cut; y1 = ph - cut; y = R.y + pad; h = rh; }
    return { x, y, w, h, s, x0, y0, x1, y1 };
  }
  const ovRect = (f, r) => { const x = f.x + (r.x - f.x0) * f.s, y = f.y + (r.y - f.y0) * f.s, w = r.w * f.s, h = r.h * f.s; const X0 = Math.max(x, f.x), Y0 = Math.max(y, f.y), X1 = Math.min(x + w, f.x + f.w), Y1 = Math.min(y + h, f.y + f.h); return X1 > X0 && Y1 > Y0 ? { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 } : null; };
  const annsOf = (t, ent, o) => (t.ann[ent.id] || []).filter(a => o.markups || a.k === 'rd');
  function postFx(cv, o) {
    if (!o.gray && !o.ink) return; const cx = cv.getContext('2d'), d = cx.getImageData(0, 0, cv.width, cv.height), a = d.data;
    for (let i = 0; i < a.length; i += 4) {
      let r = a[i], g = a[i + 1], b = a[i + 2];
      if (o.gray) { r = g = b = 0.299 * r + 0.587 * g + 0.114 * b; }
      if (o.ink) { r = 255 - (255 - r) * 0.62; g = 255 - (255 - g) * 0.62; b = 255 - (255 - b) * 0.62; }
      a[i] = r; a[i + 1] = g; a[i + 2] = b;
    }
    cx.putImageData(d, 0, 0);
  }
  /* ---------- drawing a sheet side onto a canvas ---------- */
  async function renderSide(t, P, L, o, cells, dpi, sideIdx) {
    const sheet = L.sheets[sideIdx], tile = L.tiles[sideIdx];
    const [W, H] = sheet, k = dpi / 72, cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(H * k);
    const cx = cv.getContext('2d', { alpha: false, willReadFrequently: !!(o.gray || o.ink) }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    const rects = cellRects(L, o, sheet), pad = L.per > 1 ? 2 * MM : 0, pdims = L.pd || {};
    if (o.guides && L.per > 1) { cx.save(); cx.setLineDash([6 * k, 5 * k]); cx.strokeStyle = '#888'; cx.lineWidth = Math.max(1, .6 * k); rects.forEach(R => cx.strokeRect(R.x * k, R.y * k, R.w * k, R.h * k)); cx.restore(); }
    for (let c = 0; c < cells.length; c++) {
      if (cells[c] == null) continue; const pi = P[cells[c]], ent = t.order[pi], page = ent.src >= 0 ? await t.pdf.getPage(ent.src + 1) : null, v1 = page ? page.getViewport({ scale: 1 }) : { width: ent.w, height: ent.h };
      const f = place(v1.width, v1.height, rects[c], pad, o, L.per, tile);
      const tw = Math.max(1, Math.round(f.w * k)), th = Math.max(1, Math.round(f.h * k));
      const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th;
      const tc = tmp.getContext('2d', { alpha: false }); tc.fillStyle = '#fff'; tc.fillRect(0, 0, tw, th);
      if (page) await page.render({ canvasContext: tc, viewport: page.getViewport({ scale: f.s * k, offsetX: -f.x0 * f.s * k, offsetY: -f.y0 * f.s * k }) }).promise;
      annsOf(t, ent, o).forEach(a => a.r.forEach(r => { const q = ovRect(f, r); if (!q) return; tc.fillStyle = a.k === 'rd' ? '#000' : 'rgba(255,222,0,.4)'; tc.fillRect((q.x - f.x) * k, (q.y - f.y) * k, q.w * k, q.h * k); }));
      cx.drawImage(tmp, f.x * k, f.y * k, f.w * k, f.h * k);
      if (o.borders) { cx.strokeStyle = '#999'; cx.lineWidth = Math.max(1, .5 * k); cx.strokeRect(f.x * k, f.y * k, f.w * k, f.h * k); }
      if (tile && o.cutMarks) { cx.strokeStyle = '#444'; cx.lineWidth = Math.max(1, .5 * k); const m = o.margin * MM, L1 = Math.min(m * .8, 8 * MM); [[m, m], [W - m, m], [m, H - m], [W - m, H - m]].forEach(([px, py]) => { cx.beginPath(); cx.moveTo((px - (px < W / 2 ? 1 : -1) * L1) * k, py * k); cx.lineTo(px * k, py * k); cx.moveTo(px * k, (py - (py < H / 2 ? 1 : -1) * L1) * k); cx.lineTo(px * k, py * k); cx.stroke(); }); }
    }
    postFx(cv, o);
    return cv;
  }

  /* ---------- reading the form ---------- */
  function readOpts(dlg) {
    const g = id => dlg.querySelector('#' + id), num = (id, d) => { const v = parseFloat(g(id).value); return Number.isFinite(v) ? v : d; };
    const t = V.active(); if (!t) throw new Error('Open a PDF first.');
    const D = window.frzDesktop && window.frzDesktop.listPrinters, direct = !!(D && g('prPrinter').value);
    const sel = dlg.querySelector('input[name=prPages]:checked').value;
    let P;
    if (sel === 'all') P = [...Array(t.n).keys()]; else if (sel === 'cur') P = [Math.min(t.n, Math.max(1, V.currentPage())) - 1]; else P = parseRange(g('prRange').value, t.n);
    const sub = g('prSubset').value; if (sub === 'odd') P = P.filter(i => (i + 1) % 2 === 1); else if (sub === 'even') P = P.filter(i => (i + 1) % 2 === 0);
    if (g('prReverse').checked) P = P.slice().reverse();
    if (!P.length) throw new Error('No pages match the choices under “Pages to Print”.');
    const mode = dlg._mode || 'size', layout = mode === 'size' ? 'single' : mode === 'multi' ? 'multi' : mode === 'poster' ? 'poster' : (dlg._bookType || 'fold');
    const kk = layout === 'cut' ? g('prKb').value : g('prKm').value;
    if (g('prTest').checked) P = P.slice(0, Math.max(2, layout === 'single' || layout === 'poster' ? 2 : 2 * (layout === 'fold' ? 2 : +kk)));
    const booklet = isBooklet(layout), bsub = booklet ? g('prBsub').value : 'both';
    const sides = booklet && bsub !== 'both' ? 'one' : (g('prBoth').checked || booklet) ? g('prSides2').value : 'one';
    const scaleMode = dlg.querySelector('input[name=prScale]:checked').value;
    return {
      t, P, layout, k: kk, order: g('prOrder').value, binding: g('prBinding').value, bsub, sheetFrom: Math.max(1, Math.round(num('prFrom', 1))), sheetTo: Math.round(num('prTo', 0)) || 0,
      sides, flip: g('prFlip').value, rev: g('prRev').checked, scaleMode, scalePct: Math.min(400, Math.max(5, num('prScalePct', 100))),
      paper: g('prPaperSrc').checked && layout === 'single' ? 'same' : g('prPaper').value, orient: dlg.querySelector('input[name=prOr]:checked').value,
      margin: layout === 'single' ? 0 : Math.max(0, num('prMargin', 8)), gap: Math.max(0, num('prGap', 4)), tileScale: Math.min(800, Math.max(10, num('prTile', 200))), overlap: Math.max(0, num('prOverlap', 5)), cutMarks: g('prCutMarks').checked,
      guides: g('prGuides').checked, borders: layout === 'multi' || layout === 'cut' || layout === 'fold' ? g('prBorders').checked : false, dpi: 300,
      gray: g('prGray').checked && !direct, grayPrinter: g('prGray').checked, ink: g('prInk').checked && !direct, inkPrinter: g('prInk').checked, markups: g('prMark').value !== 'doc',
      copies: Math.max(1, Math.min(99, Math.round(num('prCopies', 1)))), direct
    };
  }
  async function dims(t) { const d = []; for (const e of t.order) { if (e.src < 0) { d.push([e.w, e.h]); continue; } const p = await t.pdf.getPage(e.src + 1), v = p.getViewport({ scale: 1 }); e.w = v.width; e.h = v.height; d.push([v.width, v.height]); } return d; }
  function describe(P, L, o) {
    const lines = []; const dbl = isBooklet(L.kind);
    const phys = dbl ? L.sides.length / 2 : L.sides.length;
    if (L.kind === 'poster') lines.push(`${P.length} page${P.length === 1 ? '' : 's'} → ${L.sides.length} sheet${L.sides.length === 1 ? '' : 's'} to join together (${o.tileScale}% size, ${o.overlap} mm overlap)`);
    else lines.push(`${P.length} page${P.length === 1 ? '' : 's'} → ${L.sides.length} printed side${L.sides.length === 1 ? '' : 's'}` + (dbl ? ` on ${phys} sheet${phys === 1 ? '' : 's'} (print double-sided)` : '') + (L.per > 1 ? ` · ${L.cols}×${L.rows} per side` : '') + ` · ${Math.round(L.sheet[0] / MM)}×${Math.round(L.sheet[1] / MM)} mm`);
    if (L.kind !== 'single' && L.kind !== 'poster') { L.sides.slice(0, 12).forEach((c, i) => lines.push((dbl ? `Sheet ${Math.floor(i / 2) + 1} ${i % 2 ? 'back ' : 'front'}` : `Side ${i + 1}`) + ': ' + c.map(x => label(P, x)).join(', '))); if (L.sides.length > 12) lines.push('…'); }
    return lines.join('\n');
  }

  /* ---------- actions ---------- */
  let root = null, pageStyle = null;
  function cleanup() { root && root.remove(); pageStyle && pageStyle.remove(); root = pageStyle = null; }
  window.addEventListener('afterprint', () => setTimeout(cleanup, 400));
  async function printSheets(urls, L, say, after) {
    cleanup(); root = document.createElement('div'); root.id = 'frzPrintRoot';
    const wmm = (L.sheet[0] / MM).toFixed(2), hmm = (L.sheet[1] / MM).toFixed(2);
    pageStyle = document.createElement('style'); pageStyle.textContent = `@media print{@page{size:${wmm}mm ${hmm}mm;margin:0}#frzPrintRoot .frz-sheet{width:${wmm}mm;height:${hmm}mm}}`; document.head.appendChild(pageStyle);
    for (const url of urls) { const d = document.createElement('div'); d.className = 'frz-sheet'; const im = new Image(); im.src = url; await im.decode().catch(() => { }); d.appendChild(im); root.appendChild(d); }
    document.body.appendChild(root); await new Promise(r => setTimeout(r, 150)); if (after) { const res = await after(); cleanup(); return res; } say('Opening the print dialog…'); window.print(); say('');
  }
  const sideOrder = (L, o, part) => {
    let ord = L.sides.map((_, i) => i);
    if (isBooklet(L.kind) && (o.sheetFrom > 1 || o.sheetTo)) ord = ord.filter(i => { const sh = Math.floor(i / 2) + 1; return sh >= o.sheetFrom && (!o.sheetTo || sh <= o.sheetTo); });
    if (part === 'front') ord = ord.filter(i => i % 2 === 0); else if (part === 'back') { ord = ord.filter(i => i % 2 === 1); if (o.rev) ord.reverse(); }
    return ord;
  };
  const wantsCopies = (o, part) => o.copies > 1 && !o.direct && (part || 'all') === 'all';
  async function build(dlg, say, part) {
    const o = readOpts(dlg); const pd = await dims(o.t); const L = impose(o.P, o, pd); const cvs = [], ord = sideOrder(L, o, part || 'all');
    for (const i of ord) { say(`Preparing side ${cvs.length + 1} of ${ord.length}…`); cvs.push((await renderSide(o.t, o.P, L, o, L.sides[i], o.dpi, i)).toDataURL('image/jpeg', 0.95)); }
    if (wantsCopies(o, part)) { const base = cvs.slice(); for (let c = 1; c < o.copies; c++) cvs.push(...base); }
    return { o, L, cvs };
  }
  async function buildPdf(dlg, say, part) {
    const o = readOpts(dlg), t = o.t, pd = await dims(t), L = impose(o.P, o, pd), { PDFDocument, rgb } = PDFLib;
    let src = null; if (!t.encrypted) { try { src = await PDFDocument.load(await V.bytes(t), { updateMetadata: false }); } catch (e) { src = null; } }
    const out = await PDFDocument.create(), pad = L.per > 1 ? 2 * MM : 0;
    const ord = sideOrder(L, o, part || 'all'); let done = 0;
    for (const si of ord) {
      say(`Building side ${++done} of ${ord.length}…`); const sheet = L.sheets[si], tile = L.tiles[si], rects = cellRects(L, o, sheet), page = out.addPage(sheet);
      const cells = L.sides[si];
      if (o.guides && L.per > 1) rects.forEach(R => page.drawRectangle({ x: R.x, y: sheet[1] - R.y - R.h, width: R.w, height: R.h, borderColor: rgb(.55, .55, .55), borderWidth: .5, borderDashArray: [5, 4] }));
      for (let c = 0; c < cells.length; c++) {
        if (cells[c] == null) continue; const pi = o.P[cells[c]], f = place(pd[pi][0], pd[pi][1], rects[c], pad, o, L.per, tile), y = sheet[1] - f.y - f.h;
        const ent = t.order[pi], anns = annsOf(t, ent, o), srcPage = src && ent.src >= 0 ? src.getPage(ent.src) : null;
        const vector = srcPage && srcPage.getRotation().angle === 0 && !anns.some(a => a.k === 'rd') && !o.gray && !o.ink && Math.abs(srcPage.getWidth() - pd[pi][0]) < 1 && Math.abs(srcPage.getHeight() - pd[pi][1]) < 1;
        const overlay = () => anns.forEach(a => a.r.forEach(r => { const q = ovRect(f, r); if (!q) return; page.drawRectangle({ x: q.x, y: sheet[1] - q.y - q.h, width: q.w, height: q.h, color: a.k === 'rd' ? rgb(0, 0, 0) : rgb(1, .87, 0), opacity: a.k === 'rd' ? 1 : .4 }); }));
        if (ent.src < 0) overlay();
        else if (vector) {
          const full = f.x0 < 0.01 && f.y0 < 0.01 && f.x1 > pd[pi][0] - 0.01 && f.y1 > pd[pi][1] - 0.01, mb = srcPage.getMediaBox();
          const emb = full ? await out.embedPage(srcPage) : await out.embedPage(srcPage, { left: mb.x + f.x0, right: mb.x + f.x1, bottom: mb.y + (pd[pi][1] - f.y1), top: mb.y + (pd[pi][1] - f.y0) });
          page.drawPage(emb, { x: f.x, y, width: f.w, height: f.h }); overlay();
        } else {
          const k = Math.max(1, 300 / 72), pg = await t.pdf.getPage(ent.src + 1), cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(f.w * k)); cv.height = Math.max(1, Math.round(f.h * k));
          const cx = cv.getContext('2d', { alpha: false, willReadFrequently: !!(o.gray || o.ink) }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
          await pg.render({ canvasContext: cx, viewport: pg.getViewport({ scale: f.s * k, offsetX: -f.x0 * f.s * k, offsetY: -f.y0 * f.s * k }) }).promise;
          anns.forEach(a => a.r.forEach(r => { const q = ovRect(f, r); if (!q) return; cx.fillStyle = a.k === 'rd' ? '#000' : 'rgba(255,222,0,.4)'; cx.fillRect((q.x - f.x) * k, (q.y - f.y) * k, q.w * k, q.h * k); }));
          postFx(cv, o);
          const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95)), img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer())); page.drawImage(img, { x: f.x, y, width: f.w, height: f.h });
        }
        if (o.borders) page.drawRectangle({ x: f.x, y, width: f.w, height: f.h, borderColor: rgb(.6, .6, .6), borderWidth: .5 });
        if (tile && o.cutMarks) { const m = o.margin * MM, l = Math.min(m * .8, 8 * MM), W = sheet[0], H = sheet[1]; [[m, m, -1, -1], [W - m, m, 1, -1], [m, H - m, -1, 1], [W - m, H - m, 1, 1]].forEach(([px, py, sx, sy]) => { page.drawLine({ start: { x: px + sx * l, y: py }, end: { x: px, y: py }, thickness: .5, color: rgb(.3, .3, .3) }); page.drawLine({ start: { x: px, y: py + sy * l }, end: { x: px, y: py }, thickness: .5, color: rgb(.3, .3, .3) }); }); }
      }
    }
    if (wantsCopies(o, part)) { if (o.sides !== 'one' && out.getPageCount() % 2) out.addPage(L.sheet); const idx = [...Array(out.getPageCount()).keys()]; for (let c = 1; c < o.copies; c++) (await out.copyPages(out, idx)).forEach(p => out.addPage(p)); }
    if (o.sides === 'auto' && (part || 'all') === 'all') { try { const { PDFName } = PDFLib; out.catalog.set(PDFName.of('ViewerPreferences'), out.context.obj({ Duplex: PDFName.of(o.flip === 'short' ? 'DuplexFlipShortEdge' : 'DuplexFlipLongEdge') })); } catch (e) { } }
    const bytes = await out.save({ useObjectStreams: true });
    return { L, o, bytes, name: window.frzName ? window.frzName(t.name, o.layout === 'single' ? 'print' : o.layout === 'fold' ? 'booklet' : o.layout === 'cut' ? 'cutpinbooklet' : o.layout === 'poster' ? 'poster' : o.k + 'perpage', 'pdf') : t.name.replace(/\.pdf$/i, '') + '-bookletfrz.pdf', encrypted: !src };
  }
  function saveBytes(bytes, name) { const u = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); }
  async function downloadPdf(dlg, say) { const r = await buildPdf(dlg, say); saveBytes(r.bytes, r.name); }
  /* Print the PDF itself (vector, full quality) through the browser's PDF viewer in a hidden frame. */
  function printPdfBytes(bytes, name, say) {
    return new Promise(res => {
      const u = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), f = document.createElement('iframe');
      f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1; f.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none'; f.src = u;
      let done = false; const fail = () => { if (done) return; done = true; saveBytes(bytes, name); say('This browser could not print directly, so the PDF was saved. Open it and print from there — quality is unchanged.'); res(false); };
      f.onload = () => setTimeout(() => { if (done) return; try { f.contentWindow.focus(); say('Opening the print dialog…'); f.contentWindow.print(); done = true; try { window.focus(); (document.getElementById('vwScroll') || document.body).focus(); } catch (e2) { } say(''); res(true); } catch (e) { fail(); } }, 500);
      f.onerror = fail; document.body.appendChild(f); setTimeout(() => { f.remove(); URL.revokeObjectURL(u); }, 10 * 60 * 1000);
    });
  }

  /* ---------- quick print (the system Ctrl+P dialog) ---------- */
  async function quickPrint(say) {
    const t = V.active(); if (!t) return; say = say || V.say;
    const marked = Object.values(t.ann || {}).some(l => l.length) || t.order.length !== t.pdf.numPages || t.order.some((e, i) => e.src !== i);
    if (!marked && !t.encrypted && !window.frzDesktop) { say('Preparing…'); const ok = await printPdfBytes(await V.bytes(t), t.name, say); if (ok) return; }
    const pd = await dims(t), P = [...Array(t.n).keys()];
    const o = { layout: 'single', k: 1, paper: 'same', orient: 'auto', margin: 0, gap: 0, guides: false, borders: false, scaleMode: 'fit', markups: true, tileScale: 100, overlap: 0 };
    const L = impose(P, o, pd); const cvs = [];
    for (let i = 0; i < L.sides.length; i++) { say(`Preparing page ${i + 1} of ${L.sides.length}…`); cvs.push((await renderSide(t, P, L, o, L.sides[i], 300, i)).toDataURL('image/jpeg', 0.95)); }
    await printSheets(cvs, L, say);
  }
  function askDefault() {
    return new Promise(res => {
      if (getPref()) return res();
      const d = document.createElement('dialog'); d.className = 'frz-print-ask'; d.setAttribute('aria-labelledby', 'prAskT');
      d.innerHTML = '<h2 id="prAskT">Use this as your default print?</h2><p>Make the standard print dialog (Ctrl+P) the default whenever you print from the viewer. You can change this any time in <b>Settings → Print in the PDF viewer</b>, or at the top of the print window.</p><div class="row"><button type="button" id="a1">Just this once</button><button type="button" class="primary" id="a2">Yes, make it my default</button></div>';
      document.body.appendChild(d); d.showModal();
      d.querySelector('#a1').onclick = () => { d.close(); d.remove(); res(); };
      d.querySelector('#a2').onclick = () => { setPref('system'); d.close(); d.remove(); res(); };
      d.addEventListener('cancel', () => { d.remove(); res(); });
    });
  }

  /* ---------- dialog ---------- */
  function openDialog() {
    const t = V.active(); if (!t) return;
    const dlg = document.createElement('dialog'); dlg.className = 'frz-print-dialog'; dlg.setAttribute('aria-labelledby', 'prT');
    const esc = s => String(s).replace(/[<&>"]/g, '');
    dlg.innerHTML = `
      <div class="pr-head"><h2 id="prT">Print</h2><span class="sub">${esc(t.name)} · ${t.n} page${t.n === 1 ? '' : 's'}</span>
        <button type="button" class="primary" id="prQuick" title="Skip these settings and use your normal print dialog">Print using default (Ctrl+P) options</button>
        <button type="button" id="prClose" aria-label="Close">✕</button></div>
      <div class="pr-body">
       <div class="pr-left">
        <section class="pr-box">
          <div class="row"><label>Printer: <select id="prPrinter"><option value="">System print window (pick the printer there)</option></select></label>
            <button type="button" id="prProps">Properties</button><button type="button" id="prAdv">Advanced</button></div>
          <div class="row"><label>Copies: <input type="number" id="prCopies" min="1" max="99" value="1"></label>
            <label><input type="checkbox" id="prGray"> Print in grayscale (black and white)</label>
            <label><input type="checkbox" id="prInk"> Save ink/toner</label></div>
          <div id="prDrv" hidden><div class="row"><label>Paper tray <select id="prTray"></select></label><label>Paper type <select id="prMType"></select></label><label>Print quality <select id="prQual"></select></label></div></div>
          <p class="hint" id="prDeskNote" hidden></p>
          <p class="hint" id="prWebNote" hidden>In a web browser the job goes to your browser’s print window, where you choose the printer, tray and paper type. The desktop app can print straight to the printer from here.</p>
          <div id="prAdvPanel" hidden class="sub-panel">
            <div class="row"><label>Paper size <select id="prPaper"><option selected>A4</option><option>A3</option><option>A5</option><option>Letter</option><option>Legal</option><option>Tabloid</option></select></label>
              <label>Margin (mm) <input type="number" id="prMargin" min="0" max="40" value="8"></label><label>Gap (mm) <input type="number" id="prGap" min="0" max="30" value="4"></label></div>
            <div class="row"><label><input type="checkbox" id="prGuides" checked> Cutting guides (several pages per sheet)</label></div>
            <div class="row"><label>When I press Print or Ctrl+P in the viewer
              <select id="prDefault"><option value="">Ask me</option><option value="frz">Always open this window</option><option value="system">Always use the default Ctrl+P print</option></select></label></div>
            <p class="hint">Pages stay sharp: text and drawings are printed as they are in the PDF, not as pictures (except when you choose grayscale, save ink, or redactions are present).</p>
          </div>
        </section>
        <section class="pr-box"><h3>Pages to Print</h3>
          <div class="row"><label><input type="radio" name="prPages" value="all" checked> All</label>
            <label><input type="radio" name="prPages" value="cur"> Current</label>
            <label><input type="radio" name="prPages" value="custom"> Pages</label>
            <input type="text" id="prRange" placeholder="e.g. 1-5, 8, 11-13" aria-label="Pages to print"></div>
          <details><summary>More Options</summary><div class="row"><label>Subset <select id="prSubset"><option value="all">All pages in range</option><option value="odd">Odd pages only</option><option value="even">Even pages only</option></select></label>
            <label><input type="checkbox" id="prReverse"> Reverse pages</label></div></details>
        </section>
        <section class="pr-box"><h3>Page Sizing &amp; Handling</h3>
          <div class="seg" role="group" aria-label="Page sizing">
            <button type="button" data-mode="size" aria-pressed="true">Size</button><button type="button" data-mode="poster" aria-pressed="false">Poster</button>
            <button type="button" data-mode="multi" aria-pressed="false">Multiple</button><button type="button" data-mode="booklet" aria-pressed="false">Booklet</button></div>
          <div class="sub-panel" data-panel="size">
            <div class="row"><label><input type="radio" name="prScale" value="fit"> Fit</label><label><input type="radio" name="prScale" value="actual"> Actual size</label></div>
            <div class="row"><label><input type="radio" name="prScale" value="shrink" checked> Shrink oversized pages</label>
              <label><input type="radio" name="prScale" value="custom"> Custom Scale: <input type="number" id="prScalePct" min="5" max="400" value="100" disabled> %</label></div>
            <div class="row"><label><input type="checkbox" id="prPaperSrc"> Choose paper source by PDF page size</label></div>
          </div>
          <div class="sub-panel" data-panel="poster" hidden>
            <div class="row"><label>Tile scale <input type="number" id="prTile" min="10" max="800" value="200"> %</label><label>Overlap <input type="number" id="prOverlap" min="0" max="30" value="5"> mm</label>
              <label><input type="checkbox" id="prCutMarks" checked> Cut marks</label></div>
            <p class="hint">Enlarges each page over several sheets. Print them, trim along the cut marks and join the sheets to make a poster.</p>
          </div>
          <div class="sub-panel" data-panel="multi" hidden>
            <div class="row"><label>Pages per sheet <select id="prKm"><option>2</option><option selected>4</option><option>6</option><option>8</option><option>9</option><option>12</option><option>16</option></select></label>
              <label>Page order <select id="prOrder"><option value="h">Horizontal</option><option value="hr">Horizontal reversed</option><option value="v">Vertical</option><option value="vr">Vertical reversed</option></select></label></div>
            <div class="row"><label><input type="checkbox" id="prBorders"> Print page border</label></div>
          </div>
          <div class="sub-panel" data-panel="booklet" hidden>
            <div class="row"><label><input type="radio" name="prBook" value="fold" checked> Fold &amp; staple (2 pages per side)</label>
              <label><input type="radio" name="prBook" value="cut"> Cut &amp; pin: <select id="prKb"><option>2</option><option selected>4</option><option>6</option><option>8</option><option>9</option><option>12</option><option>16</option></select> pages per side</label></div>
            <div class="row"><label>Booklet subset <select id="prBsub"><option value="both">Both sides</option><option value="front">Front side only</option><option value="back">Back side only</option></select></label>
              <label>Binding <select id="prBinding"><option value="left">Left</option><option value="right">Right</option></select></label></div>
            <div class="row"><label>Sheets from <input type="number" id="prFrom" min="1" value="1"> to <input type="number" id="prTo" min="0" placeholder="all"></label></div>
            <p class="hint" id="prHelp"></p>
          </div>
        </section>
        <section class="pr-box">
          <label><input type="checkbox" id="prBoth"> Print on both sides of paper</label>
          <div class="row" id="prBothOpts" hidden><label>The paper turns on the <select id="prFlip"><option value="short">short edge</option><option value="long">long edge</option></select></label>
            <label><select id="prSides2" aria-label="Who turns the paper"><option value="auto">The printer prints both sides</option><option value="manual">I turn the paper over myself</option></select></label>
            <label id="prRevWrap" hidden><input type="checkbox" id="prRev"> Reverse the order of the back sides</label></div>
          <p class="hint" id="prSidesHelp"></p>
          <div class="row"><strong style="font-size:13px">Orientation:</strong><label><input type="radio" name="prOr" value="auto" checked> Auto</label><label><input type="radio" name="prOr" value="portrait"> Portrait</label><label><input type="radio" name="prOr" value="landscape"> Landscape</label></div>
        </section>
        <section class="pr-box"><h3>Comments &amp; Forms</h3>
          <div class="row"><select id="prMark" aria-label="Comments and forms"><option value="doc+marks">Document and Markups</option><option value="doc">Document</option></select></div>
          <p class="hint">“Document and Markups” prints your highlights. Redactions are always printed.</p>
        </section>
       </div>
       <aside class="pr-right" aria-label="Print preview">
        <div class="pv-meta"><span id="pvScale">Scale: —</span><span id="pvSize"></span></div>
        <div class="pv-stage" id="pvStage" aria-live="polite"></div>
        <div class="pv-nav"><button type="button" id="pvPrev" aria-label="Previous page">&lt;</button><input type="range" id="pvRange" min="1" max="1" value="1" aria-label="Preview page"><button type="button" id="pvNext" aria-label="Next page">&gt;</button></div>
        <div class="pv-count" id="pvCount"></div>
        <div class="sum" id="prSum" aria-live="polite"></div>
       </aside>
      </div>
      <div class="pr-foot">
        <button type="button" id="prSetup">Page Setup…</button>
        <span class="grow"><span class="msg" role="status" aria-live="polite" id="prMsg"></span></span>
        <label title="Print only the first sheet to check how it comes out"><input type="checkbox" id="prTest"> Test first sheet only</label>
        <button type="button" id="prPdf">Save as PDF</button>
        <button type="button" id="prPrint2" hidden>Now print the back sides</button>
        <button type="button" class="primary" id="prPrint">Print</button>
        <button type="button" id="prCancel">Cancel</button>
      </div>`;
    document.body.appendChild(dlg); dlg.showModal();
    const g = id => dlg.querySelector('#' + id), say = m => { g('prMsg').textContent = m || ''; };
    dlg._mode = 'size'; dlg._bookType = 'fold';
    g('prDefault').value = getPref(); g('prDefault').onchange = e => setPref(e.target.value);
    const HELP = { fold: 'Print double-sided, stack the sheets, fold in half and staple the middle.', cut: 'Print double-sided. Every piece you cut out has page 1 on the front and page 2 on the back, and so on. Stack the pieces in order (top-left to bottom-right, sheet by sheet) and pin.' };
    let timer = 0, pvIdx = 0, flipTouched = false;
    const schedule = ms => { clearTimeout(timer); timer = setTimeout(drawPreview, ms == null ? 180 : ms); };
    async function drawPreview() {
      try {
        const o = readOpts(dlg), pd = await dims(o.t), L = impose(o.P, o, pd), total = L.sides.length;
        pvIdx = Math.min(Math.max(0, pvIdx), total - 1); const rg = g('pvRange'); rg.max = total; rg.value = pvIdx + 1; rg.disabled = total < 2; g('pvPrev').disabled = pvIdx === 0; g('pvNext').disabled = pvIdx >= total - 1;
        const sheet = L.sheets[pvIdx]; const dpi = Math.min(150, 460 / (Math.max(sheet[0], sheet[1]) / 72));
        const cv = await renderSide(o.t, o.P, L, o, L.sides[pvIdx], dpi, pvIdx);
        const stage = g('pvStage'); stage.textContent = ''; cv.style.width = Math.round(Math.min(300, sheet[0] > sheet[1] ? 300 : 230)) + 'px'; stage.appendChild(cv);
        const ci = L.sides[pvIdx].findIndex(x => x != null); let sc = null;
        if (ci >= 0) { const pdim = pd[o.P[L.sides[pvIdx][ci]]], f = place(pdim[0], pdim[1], cellRects(L, o, sheet)[ci], L.per > 1 ? 2 * MM : 0, o, L.per, L.tiles[pvIdx]); sc = f.s; }
        g('pvScale').textContent = 'Scale: ' + (sc == null ? '—' : Math.round(sc * 100) + '%'); g('pvSize').textContent = (sheet[0] / IN).toFixed(2) + ' x ' + (sheet[1] / IN).toFixed(2) + ' Inches';
        g('pvCount').textContent = `Page ${pvIdx + 1} of ${total} (${o.P.length})`; g('prSum').textContent = describe(o.P, L, o); say('');
      } catch (e) { g('prSum').textContent = e.message || String(e); g('pvStage').textContent = ''; g('pvCount').textContent = ''; }
    }
    const refresh = () => {
      const mode = dlg._mode, booklet = mode === 'booklet'; dlg._bookType = dlg.querySelector('input[name=prBook]:checked').value;
      dlg.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      dlg.querySelectorAll('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== mode; });
      g('prKb').disabled = dlg._bookType !== 'cut'; g('prHelp').textContent = HELP[dlg._bookType];
      g('prScalePct').disabled = dlg.querySelector('input[name=prScale]:checked').value !== 'custom';
      const both = g('prBoth'); if (booklet) { both.checked = true; both.disabled = true; } else both.disabled = false;
      if (!flipTouched && dlg._flipFor !== (booklet ? 'b' : 'n')) { g('prFlip').value = booklet ? 'short' : 'long'; dlg._flipFor = booklet ? 'b' : 'n'; }
      const bsub = booklet ? g('prBsub').value : 'both', sidesOn = both.checked && !(booklet && bsub !== 'both'); g('prBothOpts').hidden = !both.checked || (booklet && bsub !== 'both');
      const manual = sidesOn && g('prSides2').value === 'manual'; g('prRevWrap').hidden = !manual; g('prPrint').textContent = manual ? 'Print the front sides' : 'Print'; if (!manual) g('prPrint2').hidden = true;
      g('prSidesHelp').textContent = !both.checked ? '' : !sidesOn ? 'Only one side of each sheet is printed — turn the paper over and print the other side yourself.' : g('prSides2').value === 'auto' ? (booklet ? 'The printer prints both sides on its own. If page 2 does not end up behind page 1, switch the edge above and use “Test first sheet only”.' : 'Both sides of each sheet, using your printer’s two-sided mode.') : 'Step 1 prints every front side. Put the pile back in the tray turned over (along the chosen edge), then press “Now print the back sides”. If the backs come out in the wrong order, tick “Reverse the order of the back sides”.';
      schedule();
    };
    dlg.addEventListener('input', refresh); dlg.addEventListener('change', refresh);
    dlg.querySelectorAll('.seg button').forEach(b => b.onclick = () => { dlg._mode = b.dataset.mode; pvIdx = 0; refresh(); });
    g('pvPrev').onclick = () => { pvIdx = Math.max(0, pvIdx - 1); schedule(20); }; g('pvNext').onclick = () => { pvIdx++; schedule(20); };
    g('pvRange').oninput = e => { e.stopPropagation(); pvIdx = +e.target.value - 1; schedule(30); };
    g('prAdv').onclick = () => { const p = g('prAdvPanel'); p.hidden = !p.hidden; };
    g('prSetup').onclick = () => { g('prAdvPanel').hidden = false; g('prPaper').focus(); g('prPaper').scrollIntoView({ block: 'center' }); };
    const close = () => { dlg.close(); dlg.remove(); };
    g('prClose').onclick = close; g('prCancel').onclick = close; dlg.addEventListener('close', () => dlg.remove());
    const busy = on => dlg.querySelectorAll('button').forEach(b => { if (b.id !== 'prClose' && b.id !== 'prCancel') b.disabled = on; });
    g('prQuick').onclick = async () => { busy(true); try { await askDefault(); dlg.close(); await quickPrint(V.say); } catch (e) { say('Could not print: ' + (e.message || e)); dlg.showModal(); } busy(false); };
    /* ---- desktop: printer list and driver options ---- */
    const D = window.frzDesktop && window.frzDesktop.listPrinters ? window.frzDesktop : null;
    let drv = { direct: false, qualityKey: '' };
    const fill = (sel, list, first) => { sel.textContent = ''; const o0 = document.createElement('option'); o0.value = ''; o0.textContent = first; sel.appendChild(o0); (list || []).filter(c => !(first === 'Automatic' && /^auto$/i.test(c.value))).forEach(c => { const o = document.createElement('option'); o.value = c.value; o.textContent = c.value + (c.def ? ' (printer default)' : ''); sel.appendChild(o); }); sel.disabled = !(list || []).length && !/^Print/.test(first); };
    async function loadDriver() {
      const name = g('prPrinter').value; g('prDrv').hidden = true; g('prDeskNote').hidden = false;
      if (!name) { g('prDeskNote').textContent = 'With no printer chosen, your system print window opens so you can set tray, paper type and quality there.'; refresh(); return; }
      drv = await D.printerOptions(name).catch(() => ({ direct: false })); drv.qualityKey = drv.qualityKey || '';
      fill(g('prTray'), drv.tray, 'Automatic'); fill(g('prMType'), drv.mediaType, 'Printer default');
      const q = g('prQual'); q.textContent = ''; [['', 'Printer default']].concat(drv.quality && drv.quality.length ? drv.quality.map(c => [c.value, c.value]) : [['level:draft', 'Draft'], ['level:normal', 'Normal'], ['level:best', 'Best']]).forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; q.appendChild(o); });
      g('prDrv').hidden = !drv.direct; g('prDeskNote').textContent = drv.direct ? 'Your printer’s own trays, paper types and quality modes are listed. The PDF is sent as it is, so text stays sharp.' : 'This printer’s tray, paper type and quality can only be changed in the system print window. Choose “System print window” to set them.';
      try { localStorage.setItem('frz-print-printer', name); } catch (e) { }
      refresh();
    }
    g('prProps').onclick = () => { if (D && g('prPrinter').value && drv.direct) g('prDrv').hidden = !g('prDrv').hidden; else { const n = D ? g('prDeskNote') : g('prWebNote'); n.hidden = false; n.scrollIntoView({ block: 'nearest' }); } };
    if (D) {
      D.listPrinters().then(list => { list.forEach(p => { const o = document.createElement('option'); o.value = p.name; o.textContent = p.displayName + (p.isDefault ? ' (default)' : ''); g('prPrinter').appendChild(o); }); let last = ''; try { last = localStorage.getItem('frz-print-printer') || ''; } catch (e) { } const pick = list.find(p => p.name === last) || list.find(p => p.isDefault); if (pick) g('prPrinter').value = pick.name; loadDriver(); }).catch(() => { });
      g('prPrinter').onchange = loadDriver;
    } else g('prWebNote').hidden = false;
    g('prFlip').value = 'short'; try { const f = localStorage.getItem('frz-print-flip2'); if (f) { g('prFlip').value = f; flipTouched = true; } } catch (e) { }
    g('prFlip').addEventListener('change', () => { flipTouched = true; try { localStorage.setItem('frz-print-flip2', g('prFlip').value); } catch (e) { } });
    refresh();

    async function doPrint(part) {
      const o = readOpts(dlg); say('Preparing…');
      const duplex = o.sides === 'auto' ? o.flip : 'one', name = D ? g('prPrinter').value : '';
      if (D && name) {
        const qv = g('prQual').value, base = { printer: name, copies: o.copies, sides: duplex, color: !o.grayPrinter, title: o.t.name };
        const opts = { ...base, tray: g('prTray').value, mediaType: g('prMType').value, quality: qv.startsWith('level:') ? '' : qv, qualityKey: drv.qualityKey, qualityLevel: qv.startsWith('level:') ? qv.slice(6) : (o.inkPrinter && !qv ? 'draft' : '') };
        const r = await buildPdf(dlg, say, part); let res = await D.printPdf(r.bytes, opts);
        if (!res.ok && (res.unsupported || /ENOENT|not found|lp:/i.test(res.message || ''))) {
          const b = await build(dlg, say, part);
          res = await printSheets(b.cvs, b.L, say, () => D.printPage({ ...base, landscape: b.L.sheet[0] > b.L.sheet[1], widthMm: b.L.sheet[0] / MM, heightMm: b.L.sheet[1] / MM }));
        }
        say(res.message || (res.ok ? 'Sent to the printer.' : 'Printing failed.')); return !!res.ok;
      }
      if (D) { const b = await build(dlg, say, part); dlg.close(); await printSheets(b.cvs, b.L, V.say); return true; }
      const r = await buildPdf(dlg, say, part); const ok = await printPdfBytes(r.bytes, r.name, say); if (ok && !(o.sides === 'manual' && part === 'front')) dlg.close(); return ok;
    }
    g('prPrint').onclick = async () => {
      busy(true);
      try {
        const o = readOpts(dlg); const part = o.bsub === 'front' ? 'front' : o.bsub === 'back' ? 'back' : (o.sides === 'manual' ? 'front' : 'all');
        const ok = await doPrint(part);
        if (ok && o.sides === 'manual' && part === 'front') { g('prPrint2').hidden = false; say(g('prMsg').textContent + ' Now turn the pile over, put it back in the tray, then press “Now print the back sides”.'); }
      } catch (e) { say(e.message || String(e)); }
      busy(false);
    };
    g('prPrint2').onclick = async () => { busy(true); try { if (await doPrint('back')) g('prPrint2').hidden = true; } catch (e) { say(e.message || String(e)); } busy(false); };
    g('prPdf').onclick = async () => { busy(true); try { await downloadPdf(dlg, say); say('Saved. Pages keep their original sharpness.'); } catch (e) { say('Could not build the PDF: ' + (e.message || e)); } busy(false); };
  }

  /* ---------- entry points ---------- */
  function onPrint() { if (!V.active()) return; if (getPref() === 'system') quickPrint(V.say); else openDialog(); }
  V.onPrint = onPrint;
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p' && document.body.classList.contains('viewer-open') && V.active()) { e.preventDefault(); onPrint(); }
  }, true);
  const btn = document.getElementById('vwPrint'); if (btn) btn.onclick = () => openDialog();
  const bq = document.getElementById('vwQuickPrint'); if (bq) bq.onclick = async () => { try { await askDefault(); await quickPrint(V.say); } catch (e) { V.say('Could not print: ' + (e.message || e)); } };
  const sd = document.getElementById('setPrintDefault'); if (sd) { sd.value = getPref(); sd.onchange = () => setPref(sd.value); }
})();
