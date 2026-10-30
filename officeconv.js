/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations (https://github.com/frz-generations).
 * Created by FRZ Generations as an open-source application, following government open-source guidelines.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 */
/* Layout-preserving Word / Excel / PowerPoint → PDF engines (browser only, real vector text, no flattening).
   Part 1: shared helpers + Word (.docx). Parts 2 and 3 (Excel, PowerPoint) are appended below. */
(() => {
  'use strict';
  const PDFLib = window.PDFLib, JSZip = window.JSZip;
  const { rgb, degrees, StandardFonts: SF } = PDFLib || {};

  /* ---------- tiny XML helpers (namespace-agnostic) ---------- */
  const parseXml = text => { const d = new DOMParser().parseFromString(text, 'application/xml'); if (d.querySelector('parsererror')) throw new Error('The file contains invalid XML.'); return d; };
  const kids = (el, name) => { const out = []; if (!el) return out; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (!name || c.localName === name) out.push(c); return out; };
  const first = (el, name) => { if (!el) return null; for (let c = el.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c; return null; };
  const attr = (el, name) => { if (!el) return null; for (const a of el.attributes) if (a.localName === name) return a.value; return null; };
  const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clean = s => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f​﻿]/g, '').replace(/ /g, ' ');
  const hexColor = (h, fb = null) => { if (!h || h === 'auto' || !/^[0-9a-f]{6}$/i.test(h)) return fb; return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };
  const rgbOf = c => c ? rgb(c[0], c[1], c[2]) : rgb(0, 0, 0);
  const HL = { yellow: 'FFFF00', green: '00FF00', cyan: '00FFFF', magenta: 'FF00FF', blue: '0000FF', red: 'FF0000', darkBlue: '000080', darkCyan: '008080', darkGreen: '008000', darkMagenta: '800080', darkRed: '800000', darkYellow: '808000', darkGray: '808080', lightGray: 'C0C0C0', black: '000000', white: 'FFFFFF' };

  /* ---------- fonts: real Helvetica/Times/Courier for Latin text, Noto (incl. Malayalam) for everything else ---------- */
  const famKind = f => !f ? 'sans' : /sans/i.test(f) ? 'sans' : /mono|courier|consolas|menlo|monaco|lucida console/i.test(f) ? 'mono' : /times|georgia|cambria|garamond|palatino|book antiqua|bookman|century|serif|minion|baskerville|constantia|didot|rockwell/i.test(f) ? 'serif' : 'sans';
  function wrapFont(stdFont, uni, skew) {
    const cache = new Map();
    const ok = ch => { let v = cache.get(ch); if (v === undefined) { try { stdFont.encodeText(ch); v = true; } catch (e) { v = false; } cache.set(ch, v); } return v; };
    const runs = text => { const out = []; let cur = null; for (const ch of String(text)) { const s = ok(ch); if (cur && cur.std === s) cur.t += ch; else { cur = { std: s, t: ch }; out.push(cur); } } return out; };
    return {
      widthOfTextAtSize(text, size) { let w = 0; for (const r of runs(text)) w += r.std ? stdFont.widthOfTextAtSize(r.t, size) : uni.widthOfTextAtSize(r.t, size); return w; },
      draw(page, text, o) { let x = o.x; for (const r of runs(text)) { if (r.std) page.drawText(r.t, { ...o, x, font: stdFont }); else uni.draw(page, r.t, skew ? { ...o, x, xSkew: degrees(12) } : { ...o, x }); x += r.std ? stdFont.widthOfTextAtSize(r.t, o.size || 12) : uni.widthOfTextAtSize(r.t, o.size || 12); } }
    };
  }
  async function makeFonts(pdf, loadUniFonts) {
    const uni = await loadUniFonts(pdf);
    const set = {};
    const fams = { sans: [SF.Helvetica, SF.HelveticaBold, SF.HelveticaOblique, SF.HelveticaBoldOblique], serif: [SF.TimesRoman, SF.TimesRomanBold, SF.TimesRomanItalic, SF.TimesRomanBoldItalic], mono: [SF.Courier, SF.CourierBold, SF.CourierOblique, SF.CourierBoldOblique] };
    for (const [k, names] of Object.entries(fams)) { const embedded = []; for (const n of names) embedded.push(await pdf.embedFont(n)); set[k] = embedded; }
    const cache = new Map();
    return {
      get(family, bold, italic) {
        const kind = famKind(family), key = kind + (bold ? 'b' : '') + (italic ? 'i' : '');
        let f = cache.get(key);
        if (!f) { f = wrapFont(set[kind][(bold ? 1 : 0) + (italic ? 2 : 0)], bold ? uni.bold : uni.regular, italic); cache.set(key, f); }
        return f;
      }
    };
  }

  /* ---------- images ---------- */
  async function toPngBytes(bytes, mime) {
    const blob = new Blob([bytes], { type: mime || 'image/png' });
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    const out = await new Promise(r => c.toBlob(r, 'image/png'));
    return new Uint8Array(await out.arrayBuffer());
  }
  async function embedImage(pdf, bytes, name, cache) {
    if (cache && cache.has(name)) return cache.get(name);
    let img = null;
    try {
      const ext = (name.split('.').pop() || '').toLowerCase();
      if (ext === 'png') img = await pdf.embedPng(bytes);
      else if (ext === 'jpg' || ext === 'jpeg') img = await pdf.embedJpg(bytes);
      else if (/^(gif|bmp|webp|tif|tiff)$/.test(ext)) img = await pdf.embedPng(await toPngBytes(bytes, 'image/' + ext));
      else if (bytes[0] === 0x89 && bytes[1] === 0x50) img = await pdf.embedPng(bytes);
      else if (bytes[0] === 0xff && bytes[1] === 0xd8) img = await pdf.embedJpg(bytes);
    } catch (e) { try { img = await pdf.embedPng(await toPngBytes(bytes)); } catch (e2) { img = null; } }
    if (cache) cache.set(name, img);
    return img;
  }
  const relsOf = async (zip, partPath) => {
    const dir = partPath.replace(/[^/]*$/, ''), file = partPath.slice(dir.length);
    const rf = zip.file(`${dir}_rels/${file}.rels`); const map = {};
    if (!rf) return map;
    const doc = parseXml(await rf.async('text'));
    for (const r of kids(doc.documentElement, 'Relationship')) {
      let t = r.getAttribute('Target') || '';
      if (r.getAttribute('TargetMode') === 'External') { map[r.getAttribute('Id')] = { target: t, type: r.getAttribute('Type'), external: true }; continue; }
      if (t.startsWith('/')) t = t.slice(1); else { const parts = (dir + t).split('/'); const st = []; for (const p of parts) { if (p === '..') st.pop(); else if (p && p !== '.') st.push(p); } t = st.join('/'); }
      map[r.getAttribute('Id')] = { target: t, type: r.getAttribute('Type') };
    }
    return map;
  };

  /* =====================================================================
     WORD (.docx)
     ===================================================================== */
  const EMU = 12700, TW = 20;
  const onOff = el => { if (!el) return undefined; const v = attr(el, 'val'); return !(v === '0' || v === 'false' || v === 'off'); };
  function parseRPr(el) {
    const o = {}; if (!el) return o;
    for (const c of kids(el)) {
      switch (c.localName) {
        case 'b': o.b = onOff(c); break;
        case 'i': o.i = onOff(c); break;
        case 'strike': case 'dstrike': o.strike = onOff(c); break;
        case 'caps': o.caps = onOff(c); break;
        case 'smallCaps': o.smallCaps = onOff(c); break;
        case 'u': o.u = (attr(c, 'val') || 'single') !== 'none'; break;
        case 'color': { const v = attr(c, 'val'); o.color = v === 'auto' ? 'auto' : v; break; }
        case 'sz': o.sz = num(attr(c, 'val')) / 2; break;
        case 'highlight': o.hl = attr(c, 'val'); break;
        case 'shd': { const f = attr(c, 'fill'); if (f && f !== 'auto') o.shd = f; break; }
        case 'vertAlign': o.va = attr(c, 'val'); break;
        case 'rFonts': { const f = attr(c, 'ascii') || attr(c, 'hAnsi') || attr(c, 'cs') || attr(c, 'eastAsia'); if (f) o.font = f; else { const th = attr(c, 'asciiTheme') || attr(c, 'hAnsiTheme'); if (th) o.font = /^major/i.test(th) ? '@major' : '@minor'; } break; }
        case 'rStyle': o.rStyle = attr(c, 'val'); break;
        case 'vanish': o.vanish = onOff(c); break;
      }
    }
    return o;
  }
  const parseBorder = el => { if (!el) return undefined; const v = attr(el, 'val'); if (!v || v === 'nil' || v === 'none') return null; return { sz: num(attr(el, 'sz'), 4) / 8, color: hexColor(attr(el, 'color'), [0, 0, 0]), space: num(attr(el, 'space'), 0) }; };
  function parsePPr(el) {
    const o = {}; if (!el) return o;
    for (const c of kids(el)) {
      switch (c.localName) {
        case 'jc': o.jc = attr(c, 'val'); break;
        case 'ind': { o.ind = {}; for (const k of ['left', 'start', 'right', 'end', 'firstLine', 'hanging']) { const v = attr(c, k); if (v != null) o.ind[k === 'start' ? 'left' : k === 'end' ? 'right' : k] = num(v) / TW; } break; }
        case 'spacing': { o.sp = {}; const b = attr(c, 'before'), a = attr(c, 'after'), l = attr(c, 'line'); if (b != null) o.sp.before = num(b) / TW; if (a != null) o.sp.after = num(a) / TW; if (attr(c, 'beforeAutospacing') === '1') o.sp.before = 14; if (attr(c, 'afterAutospacing') === '1') o.sp.after = 14; if (l != null) { o.sp.line = num(l); o.sp.rule = attr(c, 'lineRule') || 'auto'; } break; }
        case 'keepNext': o.keepNext = onOff(c); break;
        case 'keepLines': o.keepLines = onOff(c); break;
        case 'pageBreakBefore': o.pbb = onOff(c); break;
        case 'contextualSpacing': o.ctx = onOff(c); break;
        case 'pStyle': o.pStyle = attr(c, 'val'); break;
        case 'numPr': o.num = { id: attr(first(c, 'numId'), 'val'), lvl: num(attr(first(c, 'ilvl'), 'val'), 0) }; break;
        case 'shd': { const f = attr(c, 'fill'); if (f && f !== 'auto') o.shd = f; break; }
        case 'pBdr': { o.bdr = {}; for (const s of ['top', 'bottom', 'left', 'right']) { const b = parseBorder(first(c, s)); if (b !== undefined) o.bdr[s] = b; } break; }
        case 'tabs': o.tabs = kids(c, 'tab').map(t => ({ val: attr(t, 'val'), pos: num(attr(t, 'pos')) / TW, leader: attr(t, 'leader') })).filter(t => t.val !== 'clear'); break;
        case 'rPr': o.rPr = parseRPr(c); break;
        case 'outlineLvl': o.outline = num(attr(c, 'val')); break;
      }
    }
    return o;
  }
  const mergeP = (a, b) => { const o = { ...a }; for (const k in b) { if (k === 'ind' || k === 'sp' || k === 'bdr' || k === 'rPr') o[k] = { ...(a[k] || {}), ...b[k] }; else if (b[k] !== undefined) o[k] = b[k]; } return o; };
  const mergeR = (a, b) => { const o = { ...a }; for (const k in b) if (b[k] !== undefined) o[k] = b[k]; return o; };

  async function loadDocxModel(zip) {
    const docPart = zip.file('word/document.xml');
    if (!docPart) throw new Error('This is not a readable .docx file. Legacy .doc files are not supported.');
    const M = { zip, rels: await relsOf(zip, 'word/document.xml'), styles: {}, def: { p: {}, r: { sz: 10, font: 'Arial' } }, nums: {}, abs: {}, defTab: 36, themeFonts: {}, compat: {} };
    const body = parseXml(await docPart.async('text'));
    M.doc = body;
    const sf = zip.file('word/styles.xml');
    if (sf) {
      const sd = parseXml(await sf.async('text')); const root = sd.documentElement;
      const dd = first(root, 'docDefaults');
      if (dd) { M.def.r = mergeR(M.def.r, parseRPr(first(first(dd, 'rPrDefault'), 'rPr'))); M.def.p = parsePPr(first(first(dd, 'pPrDefault'), 'pPr')); }
      for (const s of kids(root, 'style')) {
        const id = attr(s, 'styleId'); const tp = attr(s, 'type');
        const st = { id, type: tp, basedOn: attr(first(s, 'basedOn'), 'val'), def: attr(s, 'default') === '1', p: parsePPr(first(s, 'pPr')), r: parseRPr(first(s, 'rPr')), name: attr(first(s, 'name'), 'val') };
        if (tp === 'table') { st.tbl = parseTblPr(first(s, 'tblPr')); st.tcPr = parseTcPr(first(s, 'tcPr')); st.cond = {}; for (const c of kids(s, 'tblStylePr')) st.cond[attr(c, 'type')] = { r: parseRPr(first(c, 'rPr')), p: parsePPr(first(c, 'pPr')), tc: parseTcPr(first(c, 'tcPr')), tbl: parseTblPr(first(c, 'tblPr')) }; }
        M.styles[id] = st;
      }
    }
    const nf = zip.file('word/numbering.xml');
    if (nf) {
      const nd = parseXml(await nf.async('text')); const root = nd.documentElement;
      for (const a of kids(root, 'abstractNum')) {
        const lv = {};
        for (const l of kids(a, 'lvl')) lv[num(attr(l, 'ilvl'))] = { fmt: attr(first(l, 'numFmt'), 'val') || 'decimal', text: attr(first(l, 'lvlText'), 'val') ?? '%1.', start: num(attr(first(l, 'start'), 'val'), 1), p: parsePPr(first(l, 'pPr')), r: parseRPr(first(l, 'rPr')), suff: attr(first(l, 'suff'), 'val') || 'tab' };
        M.abs[attr(a, 'abstractNumId')] = lv;
      }
      for (const n of kids(root, 'num')) { const ov = {}; for (const o of kids(n, 'lvlOverride')) { const s = first(o, 'startOverride'); if (s) ov[num(attr(o, 'ilvl'))] = num(attr(s, 'val')); } M.nums[attr(n, 'numId')] = { abs: attr(first(n, 'abstractNumId'), 'val'), ov }; }
    }
    const st = zip.file('word/settings.xml');
    if (st) { const sd = parseXml(await st.async('text')); const dt = attr(first(sd.documentElement, 'defaultTabStop'), 'val'); if (dt) M.defTab = num(dt) / TW; }
    const th = zip.file('word/theme/theme1.xml');
    if (th) { const tx = await th.async('text'); const m = /<a:minorFont>\s*<a:latin typeface="([^"]*)"/.exec(tx); if (m) M.themeFonts.minor = m[1]; const mj = /<a:majorFont>\s*<a:latin typeface="([^"]*)"/.exec(tx); if (mj) M.themeFonts.major = mj[1]; }
    return M;
  }
  const parseTblPr = el => {
    const o = {}; if (!el) return o;
    const bd = first(el, 'tblBorders'); if (bd) { o.bdr = {}; for (const s of ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']) { const b = parseBorder(first(bd, s)); if (b !== undefined) o.bdr[s] = b; } }
    const cm = first(el, 'tblCellMar'); if (cm) { o.mar = {}; for (const s of ['top', 'left', 'bottom', 'right', 'start', 'end']) { const m = first(cm, s); if (m) o.mar[s === 'start' ? 'left' : s === 'end' ? 'right' : s] = num(attr(m, 'w')) / TW; } }
    const w = first(el, 'tblW'); if (w) o.w = { type: attr(w, 'type'), v: num(attr(w, 'w')) };
    const jc = first(el, 'jc'); if (jc) o.jc = attr(jc, 'val');
    const ind = first(el, 'tblInd'); if (ind) o.ind = num(attr(ind, 'w')) / TW;
    const ts = first(el, 'tblStyle'); if (ts) o.style = attr(ts, 'val');
    const lk = first(el, 'tblLook'); if (lk) { const v = parseInt(attr(lk, 'val') || '0', 16); o.look = { firstRow: attr(lk, 'firstRow') != null ? attr(lk, 'firstRow') === '1' : !!(v & 0x20), lastRow: attr(lk, 'lastRow') != null ? attr(lk, 'lastRow') === '1' : !!(v & 0x40), firstCol: attr(lk, 'firstColumn') != null ? attr(lk, 'firstColumn') === '1' : !!(v & 0x80), lastCol: attr(lk, 'lastColumn') != null ? attr(lk, 'lastColumn') === '1' : !!(v & 0x100), noHBand: attr(lk, 'noHBand') != null ? attr(lk, 'noHBand') === '1' : !!(v & 0x200), noVBand: attr(lk, 'noVBand') != null ? attr(lk, 'noVBand') === '1' : !!(v & 0x400) }; }
    return o;
  };
  const parseTcPr = el => {
    const o = {}; if (!el) return o;
    const sh = first(el, 'shd'); if (sh) { const f = attr(sh, 'fill'); if (f && f !== 'auto') o.fill = f; }
    const gs = first(el, 'gridSpan'); if (gs) o.span = num(attr(gs, 'val'), 1);
    const vm = first(el, 'vMerge'); if (vm) o.vm = attr(vm, 'val') || 'continue';
    const bd = first(el, 'tcBorders'); if (bd) { o.bdr = {}; for (const s of ['top', 'left', 'bottom', 'right', 'start', 'end']) { const b = parseBorder(first(bd, s)); if (b !== undefined) o.bdr[s === 'start' ? 'left' : s === 'end' ? 'right' : s] = b; } }
    const mar = first(el, 'tcMar'); if (mar) { o.mar = {}; for (const s of ['top', 'left', 'bottom', 'right', 'start', 'end']) { const m = first(mar, s); if (m) o.mar[s === 'start' ? 'left' : s === 'end' ? 'right' : s] = num(attr(m, 'w')) / TW; } }
    const w = first(el, 'tcW'); if (w && attr(w, 'type') === 'dxa') o.w = num(attr(w, 'w')) / TW;
    const va = first(el, 'vAlign'); if (va) o.va = attr(va, 'val');
    return o;
  };
  const styleChain = (M, id) => { const chain = []; const seen = new Set(); while (id && M.styles[id] && !seen.has(id)) { seen.add(id); chain.unshift(M.styles[id]); id = M.styles[id].basedOn; } return chain; };
  const defaultStyle = (M, type) => Object.values(M.styles).find(s => s.type === type && s.def);
  function paraProps(M, pPr, tableCtx) {
    const direct = parsePPr(pPr);
    let p = { ...M.def.p }, r = { ...M.def.r };
    const dp = defaultStyle(M, 'paragraph'); const sid = direct.pStyle || dp?.id;
    if (tableCtx?.pPr) p = mergeP(p, tableCtx.pPr);
    if (tableCtx?.rPr) r = mergeR(r, tableCtx.rPr);
    for (const s of styleChain(M, sid)) { p = mergeP(p, s.p); r = mergeR(r, s.r); r = mergeR(r, s.p.rPr || {}); }
    // numbering level props (indent) sit between style and direct formatting
    const nId = direct.num ? direct.num : p.num;
    p = mergeP(p, direct);
    if (p.rPr) { r = mergeR(r, p.rPr); }
    return { p, r, styleId: sid };
  }
  const fmtNum = (n, fmt) => {
    switch (fmt) {
      case 'lowerLetter': { let s = ''; n = Math.max(1, n); while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
      case 'upperLetter': return fmtNum(n, 'lowerLetter').toUpperCase();
      case 'lowerRoman': case 'upperRoman': { const t = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, c] of t) while (n >= v) { s += c; n -= v; } return fmt === 'upperRoman' ? s.toUpperCase() : s; }
      case 'decimalZero': return n < 10 ? '0' + n : String(n);
      default: return String(n);
    }
  };
  const BULLET = { '': '•', '': '▪', '': '>', '': '•', '': '✓', 'o': '–', '': '○', '·': '•' };

  async function docxToPdfBytes(buffer, ctx) {
    const { loadUniFonts, status = () => {} } = ctx;
    const zip = await JSZip.loadAsync(buffer);
    status('Reading document structure…');
    const M = await loadDocxModel(zip);
    const pdf = await PDFLib.PDFDocument.create();
    const fonts = await makeFonts(pdf, loadUniFonts);
    const imgCache = new Map();
    const counters = {};
    const warn = new Set();

    const bodyEl = first(M.doc.documentElement, 'body');
    /* ---- section split ---- */
    const sections = []; let curBlocks = [];
    const pushSection = sectPr => { sections.push({ blocks: curBlocks, sect: sectPr }); curBlocks = []; };
    for (const el of kids(bodyEl)) {
      if (el.localName === 'sectPr') { pushSection(el); continue; }
      curBlocks.push(el);
      if (el.localName === 'p') { const sp = first(first(el, 'pPr'), 'sectPr'); if (sp) pushSection(sp); }
    }
    if (curBlocks.length) pushSection(null);
    if (!sections.length) throw new Error('No readable content was found in this DOCX file.');

    const readSect = sp => {
      const sz = first(sp, 'pgSz'), mar = first(sp, 'pgMar'), cols = first(sp, 'cols');
      const o = { w: 595.3, h: 841.9, top: 72, bottom: 72, left: 72, right: 72, header: 36, footer: 36, cols: 1, colGap: 36, titlePg: !!first(sp, 'titlePg'), type: attr(first(sp, 'type'), 'val') || 'nextPage', hf: {} };
      if (sz) { o.w = num(attr(sz, 'w'), 11906) / TW; o.h = num(attr(sz, 'h'), 16838) / TW; if (attr(sz, 'orient') === 'landscape' && o.w < o.h) [o.w, o.h] = [o.h, o.w]; }
      if (mar) { o.top = num(attr(mar, 'top'), 1440) / TW; o.bottom = num(attr(mar, 'bottom'), 1440) / TW; o.left = num(attr(mar, 'left'), 1440) / TW; o.right = num(attr(mar, 'right'), 1440) / TW; o.header = num(attr(mar, 'header'), 720) / TW; o.footer = num(attr(mar, 'footer'), 720) / TW; if (attr(mar, 'gutter')) o.left += num(attr(mar, 'gutter')) / TW; }
      if (cols) { o.cols = Math.max(1, num(attr(cols, 'num'), 1)); o.colGap = num(attr(cols, 'space'), 720) / TW; }
      for (const r of sp ? kids(sp) : []) if (r.localName === 'headerReference' || r.localName === 'footerReference') o.hf[(r.localName === 'headerReference' ? 'h' : 'f') + (attr(r, 'type') || 'default')] = attr(r, 'id');
      return o;
    };
    const sectInfos = sections.map(s => readSect(s.sect));
    // sections without own header/footer inherit from previous
    for (let i = 1; i < sectInfos.length; i++) for (const k of ['hdefault', 'hfirst', 'fdefault', 'ffirst']) if (!sectInfos[i].hf[k] && sectInfos[i - 1].hf[k]) sectInfos[i].hf[k] = sectInfos[i - 1].hf[k];

    /* ---- inline image extraction ---- */
    async function loadImage(rid, relMap) {
      const rel = relMap[rid]; if (!rel || rel.external) return null;
      const f = zip.file(rel.target); if (!f) return null;
      return embedImage(pdf, await f.async('uint8array'), rel.target, imgCache);
    }

    /* ---- paragraph → tokens ---- */
    async function inlineTokens(pEl, base, relMap, extraBlocks, hf) {
      const toks = []; const fieldStack = [];
      const rBase = base.r;
      const runStyleProps = rs => { let o = {}; for (const s of styleChain(M, rs)) o = mergeR(o, s.r); return o; };
      async function doRun(rEl, inheritLink) {
        let rp = mergeR(rBase, {});
        const rPrEl = first(rEl, 'rPr'); const dr = parseRPr(rPrEl);
        if (dr.rStyle) rp = mergeR(rp, runStyleProps(dr.rStyle));
        rp = mergeR(rp, dr);
        if (inheritLink) { rp = mergeR(rp, { color: rp.color && rp.color !== 'auto' ? rp.color : '0563C1', u: true }); }
        if (rp.vanish) return;
        const suppress = fieldStack.some(f => f.suppress && f.sep);
        for (const c of kids(rEl)) {
          switch (c.localName) {
            case 't': if (!suppress) { const t = clean(c.textContent); if (t) toks.push({ k: 'text', t, rp }); } break;
            case 'tab': if (!suppress) toks.push({ k: 'tab', rp }); break;
            case 'br': { const ty = attr(c, 'type'); toks.push({ k: ty === 'page' ? 'pagebreak' : ty === 'column' ? 'colbreak' : 'br', rp }); break; }
            case 'cr': toks.push({ k: 'br', rp }); break;
            case 'noBreakHyphen': if (!suppress) toks.push({ k: 'text', t: '-', rp }); break;
            case 'softHyphen': break;
            case 'sym': { const ch = attr(c, 'char'); if (ch && !suppress) { const cp = parseInt(ch, 16); const m = BULLET[String.fromCodePoint(cp)] || BULLET[String.fromCodePoint(cp & 0xff)]; toks.push({ k: 'text', t: m || '•', rp }); } break; }
            case 'instrText': { const f = fieldStack[fieldStack.length - 1]; if (f) f.instr += c.textContent; break; }
            case 'fldChar': {
              const ty = attr(c, 'fldCharType');
              if (ty === 'begin') fieldStack.push({ instr: '', sep: false, suppress: false });
              else if (ty === 'separate') { const f = fieldStack[fieldStack.length - 1]; if (f) { f.sep = true; const m = /^\s*(PAGE|NUMPAGES|SECTIONPAGES)\b/i.exec(f.instr); if (m) { f.suppress = true; toks.push({ k: 'field', name: m[1].toUpperCase() === 'PAGE' ? 'PAGE' : 'NUMPAGES', rp }); } } }
              else if (ty === 'end') fieldStack.pop();
              break;
            }
            case 'drawing': case 'pict': case 'object': await doDrawing(c, rp); break;
            case 'AlternateContent': { const ch = first(c, 'Choice') || first(c, 'Fallback'); if (ch) for (const d of kids(ch)) if (d.localName === 'drawing' || d.localName === 'pict') await doDrawing(d, rp); break; }
          }
        }
      }
      async function doDrawing(d, rp) {
        // text boxes → keep their text as separate indented blocks after the paragraph
        for (const tb of d.getElementsByTagName('*')) if (tb.localName === 'txbxContent' && !tb.__done) { tb.__done = true; for (const ch of kids(tb)) extraBlocks.push(ch); }
        const blips = [...d.getElementsByTagName('*')].filter(x => x.localName === 'blip');
        if (!blips.length) {
          const vi = [...d.getElementsByTagName('*')].find(x => x.localName === 'imagedata');
          if (vi) { const rid = attr(vi, 'id'); const img = rid ? await loadImage(rid, relMap) : null; if (img) { const st = vi.parentNode.getAttribute('style') || ''; const wm = /width:([\d.]+)pt/.exec(st), hm = /height:([\d.]+)pt/.exec(st); toks.push({ k: 'img', img, w: wm ? +wm[1] : 120, h: hm ? +hm[1] : 90, rp }); } }
          return;
        }
        const ext = [...d.getElementsByTagName('*')].find(x => x.localName === 'extent');
        const blip = blips[0]; const rid = attr(blip, 'embed') || attr(blip, 'link');
        const img = rid ? await loadImage(rid, relMap) : null;
        if (!img) { warn.add('Some images (e.g. EMF/WMF vector clip-art) could not be embedded.'); return; }
        let w = ext ? num(attr(ext, 'cx')) / EMU : img.width * 0.75, h = ext ? num(attr(ext, 'cy')) / EMU : img.height * 0.75;
        const sr = [...d.getElementsByTagName('*')].find(x => x.localName === 'srcRect');
        let crop = null; if (sr) { crop = { l: num(attr(sr, 'l')) / 1e5, t: num(attr(sr, 't')) / 1e5, r: num(attr(sr, 'r')) / 1e5, b: num(attr(sr, 'b')) / 1e5 }; }
        const inline = d.localName === 'drawing' && first(d, 'inline');
        toks.push({ k: 'img', img, w, h, crop, rp, anchor: !inline });
      }
      async function walk(parent, link) {
        for (const c of kids(parent)) {
          switch (c.localName) {
            case 'r': await doRun(c, link); break;
            case 'hyperlink': case 'ins': case 'smartTag': case 'sdt': case 'sdtContent': case 'fldSimple': case 'customXml': case 'moveTo': case 'dir': case 'bdo': {
              if (c.localName === 'fldSimple') {
                const ins = attr(c, 'instr') || '';
                const m = /^\s*(PAGE|NUMPAGES)\b/i.exec(ins);
                if (m) { toks.push({ k: 'field', name: m[1].toUpperCase(), rp: mergeR(rBase, parseRPr(first(first(c, 'r'), 'rPr'))) }); break; }
              }
              await walk(c, link || c.localName === 'hyperlink'); break;
            }
            case 'AlternateContent': { const ch = first(c, 'Choice') || first(c, 'Fallback'); if (ch) await walk(ch, link); break; }
          }
        }
      }
      await walk(pEl, false);
      return toks;
    }

    /* ---- numbering ---- */
    function numberLabel(p) {
      if (!p.num || p.num.id == null || p.num.id === '0') return null;
      const n = M.nums[p.num.id]; if (!n) return null;
      const lv = M.abs[n.abs]?.[p.num.lvl]; if (!lv) return null;
      const key = p.num.id; const c = counters[key] || (counters[key] = {});
      const lvl = p.num.lvl;
      const start = n.ov[lvl] != null ? n.ov[lvl] : lv.start;
      c[lvl] = c[lvl] == null ? start : c[lvl] + 1;
      for (const k of Object.keys(c)) if (+k > lvl) delete c[k];
      let text = lv.text;
      if (lv.fmt === 'bullet') { text = BULLET[text] || BULLET[text.slice(-1)] || (text && /^[ -~•–●○▪■✓]$/.test(text) ? text : '•'); if (text === 'o') text = '–'; return { text, lv, bullet: true }; }
      text = text.replace(/%([1-9])/g, (m, d) => { const l = +d - 1; const lvl2 = M.abs[n.abs][l]; const cv = c[l] != null ? c[l] : (n.ov[l] != null ? n.ov[l] : (lvl2 ? lvl2.start : 1)); return fmtNum(cv, lvl2 ? lvl2.fmt : 'decimal'); });
      return { text, lv };
    }

    /* ---- paragraph layout: returns {lines, height, pb(before), pa(after) ...} independent of position ---- */
    async function layoutParagraph(pEl, width, tctx, extra, hfctx, relMap) {
      const pPrEl = first(pEl, 'pPr');
      const { p, r, styleId } = paraProps(M, pPrEl, tctx);
      const extraBlocks = [];
      const toks = await inlineTokens(pEl, { p, r }, relMap || M.rels, extraBlocks);
      const label = numberLabel(p);
      let ind = { left: 0, right: 0, first: 0, hanging: 0, ...(p.ind || {}) };
      if (label) {
        const li = label.lv.p.ind || {};
        // numbering indent applies unless paragraph overrides directly
        const direct = parsePPr(pPrEl).ind || {};
        const sty = {}; for (const s of styleChain(M, styleId)) Object.assign(sty, s.p.ind || {});
        const eff = { ...li, ...sty, ...direct };
        ind = { left: 0, right: 0, first: 0, hanging: 0, ...eff };
      }
      const left = ind.left || 0, right = ind.right || 0;
      let firstOff = (ind.first || 0) - (ind.hanging || 0);
      const avail = Math.max(24, width - left - right);
      const base = r;
      const sizeOf = rp => (rp.sz || 10) * (rp.va === 'superscript' || rp.va === 'subscript' ? 0.65 : 1) * (rp.smallCaps && !rp.caps ? 1 : 1);
      const fontOf = rp => fonts.get(rp.font === '@major' ? M.themeFonts.major : rp.font === '@minor' ? M.themeFonts.minor : rp.font, !!rp.b, !!rp.i);
      const colorOf = rp => { if (rp.color === 'auto' || !rp.color) return [0, 0, 0]; return hexColor(rp.color, [0, 0, 0]); };
      const finalText = (t, rp) => rp.caps ? t.toUpperCase() : t;
      // label token
      let labelTok = null;
      if (label) {
        const lrp = mergeR(base, label.lv.r || {}); if (label.bullet) { lrp.b = lrp.b; }
        labelTok = { text: label.text, rp: lrp, font: fontOf(lrp), size: sizeOf(lrp) };
        labelTok.w = labelTok.font.widthOfTextAtSize(label.text, labelTok.size);
      }
      // build atoms
      const atoms = [];
      const pushText = (t, rp) => {
        const parts = finalText(t, rp).split(/(\s+)/);
        const font = fontOf(rp), size = sizeOf(rp);
        for (const part of parts) {
          if (!part) continue;
          const isSp = /^\s+$/.test(part);
          atoms.push({ k: isSp ? 'space' : 'word', t: isSp ? ' '.repeat(Math.min(part.length, 1)) : part, rp, font, size, w: isSp ? font.widthOfTextAtSize(' ', size) : font.widthOfTextAtSize(part, size) });
        }
      };
      for (const t of toks) {
        if (t.k === 'text') pushText(t.t, t.rp);
        else if (t.k === 'field') atoms.push({ k: 'field', name: t.name, rp: t.rp, font: fontOf(t.rp), size: sizeOf(t.rp), w: fontOf(t.rp).widthOfTextAtSize('00', sizeOf(t.rp)) });
        else if (t.k === 'tab') atoms.push({ k: 'tab', rp: t.rp, size: sizeOf(t.rp), w: 0 });
        else if (t.k === 'br' || t.k === 'pagebreak' || t.k === 'colbreak') atoms.push({ k: t.k, rp: t.rp, size: sizeOf(t.rp), w: 0 });
        else if (t.k === 'img') {
          let w = t.w, h = t.h; const maxW = avail; if (w > maxW) { h *= maxW / w; w = maxW; }
          atoms.push({ k: 'img', img: t.img, crop: t.crop, w, h, rp: t.rp, size: 10 });
        }
      }
      const spB = p.sp?.before || 0, spA = p.sp?.after || 0;
      const lineRule = p.sp?.rule || 'auto', lineVal = p.sp?.line;
      const mult = lineRule === 'auto' ? (lineVal ? lineVal / 240 : 1) : 1;
      const lineH = size => lineRule === 'auto' ? size * 1.17 * mult : (lineRule === 'exact' ? lineVal / TW : Math.max(lineVal / TW, size * 1.17));
      const dsz = sizeOf(base);
      const tabs = (p.tabs || []).slice().sort((a, b) => a.pos - b.pos);
      const lines = []; let line = null; let pageBreakAfterLine = false; let forceCol = false;
      const newLine = (isFirst) => { const off = isFirst ? firstOff : 0; line = { items: [], x: left + off + (isFirst && labelTok ? 0 : 0), startX: left + off, w: 0, maxSize: 0, maxImgH: 0, isFirst, endsBr: false }; lines.push(line); };
      newLine(true);
      if (labelTok) { line.labelTok = labelTok; }
      const lineLimit = () => width - right;
      const tabStopAfter = x => {
        for (const t of tabs) if (t.pos + 0.01 > x - 0 && t.pos > x + 0.01) return t;
        const rel = x; const step = M.defTab; const nx = (Math.floor((rel + 0.01) / step) + 1) * step; return { pos: nx, val: 'left' };
      };
      const placeLabelTab = () => {
        if (!labelTok) return;
        const lab = labelTok; const labelEnd = (left + firstOff) + lab.w;
        let tx;
        const t = tabs.find(t => t.pos > labelEnd + 0.5 && t.pos <= left + 0.01);
        if (label.lv.suff === 'space') tx = labelEnd + lab.font.widthOfTextAtSize(' ', lab.size);
        else if (label.lv.suff === 'nothing') tx = labelEnd;
        else if (t) tx = t.pos; else if (firstOff < 0 && left >= labelEnd + 2) tx = left; else tx = tabStopAfter(labelEnd).pos;
        line.x = tx; line.w = tx - line.startX; line.labelEnd = tx;
        line.maxSize = Math.max(line.maxSize, lab.size);
      };
      placeLabelTab();
      const lineUsed = () => line.x;
      let i = 0;
      const widthUntilBreak = (from) => { let w = 0; for (let j = from; j < atoms.length; j++) { const a = atoms[j]; if (a.k === 'tab' || a.k === 'br' || a.k === 'pagebreak' || a.k === 'colbreak') break; w += a.w; } return w; };
      const trimTrailing = () => { while (line.items.length && line.items[line.items.length - 1].k === 'space') { const s = line.items.pop(); line.x -= s.w; } };
      const breakLine = (endsBr) => { trimTrailing(); line.endsBr = endsBr; newLine(false); };
      for (; i < atoms.length; i++) {
        const a = atoms[i];
        if (a.k === 'br') { line.maxSize = Math.max(line.maxSize, a.size); breakLine(true); continue; }
        if (a.k === 'pagebreak') { line.maxSize = Math.max(line.maxSize, a.size); line.pbAfter = true; breakLine(true); continue; }
        if (a.k === 'colbreak') { line.maxSize = Math.max(line.maxSize, a.size); line.cbAfter = true; breakLine(true); continue; }
        if (a.k === 'tab') {
          const stop = tabStopAfter(line.x);
          let target = stop.pos; const wNext = widthUntilBreak(i + 1);
          if (stop.val === 'right') target = stop.pos - wNext; else if (stop.val === 'center') target = stop.pos - wNext / 2;
          if (target < line.x) target = line.x;
          const item = { k: 'tab', x: line.x, w: target - line.x, leader: stop.leader, size: a.size, rp: a.rp, font: fontOf(a.rp) };
          line.items.push(item); line.x = target; line.maxSize = Math.max(line.maxSize, a.size); continue;
        }
        const limit = lineLimit();
        if (a.k === 'space') { if (!line.items.length) continue; if (line.x + a.w > limit) { continue; } line.items.push({ ...a, x: line.x }); line.x += a.w; continue; }
        if (line.x + a.w > limit + 0.01 && line.items.some(it => it.k !== 'tab' && it.k !== 'space')) { breakLine(false); }
        if (a.k === 'word' && line.x + a.w > limit + 0.01) {
          // very long word: break by grapheme
          const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(a.t)].map(s => s.segment) : [...a.t];
          let chunk = '';
          for (const g of seg) { if (chunk && line.x + a.font.widthOfTextAtSize(chunk + g, a.size) > limit) { const w2 = a.font.widthOfTextAtSize(chunk, a.size); line.items.push({ ...a, t: chunk, w: w2, x: line.x }); line.x += w2; line.maxSize = Math.max(line.maxSize, a.size); breakLine(false); chunk = g; } else chunk += g; }
          if (chunk) { const w2 = a.font.widthOfTextAtSize(chunk, a.size); line.items.push({ ...a, t: chunk, w: w2, x: line.x }); line.x += w2; line.maxSize = Math.max(line.maxSize, a.size); }
          continue;
        }
        line.items.push({ ...a, x: line.x }); line.x += a.w;
        if (a.k === 'img') { line.maxImgH = Math.max(line.maxImgH, a.h); } else line.maxSize = Math.max(line.maxSize, a.size);
      }
      trimTrailing();
      // drop a trailing empty line created by a final break (but keep for page-break paragraphs)
      if (lines.length > 1 && !line.items.length && !(lines[lines.length - 2].endsBr && !lines[lines.length - 2].pbAfter && !lines[lines.length - 2].cbAfter)) { /* keep empty line only when from explicit br */ }
      if (lines.length > 1 && !lines[lines.length - 1].items.length && lines[lines.length - 2].pbAfter) lines.pop();
      // line metrics
      for (const L of lines) {
        const ms = L.maxSize || dsz;
        const textH = lineH(ms);
        const asc = L.maxImgH ? Math.max(L.maxImgH, ms * 0.93) : ms * 0.93 + (textH - ms * 1.17) * (lineRule === 'auto' ? 1 : 0.5);
        const desc = ms * 0.24 + (lineRule === 'auto' ? 0 : 0);
        L.ascent = Math.max(asc, L.maxImgH ? L.maxImgH : 0); L.height = Math.max(textH, L.maxImgH + desc);
        if (lineRule === 'exact') { L.height = lineVal / TW; L.ascent = L.height * 0.8; }
        // alignment offset
        const textStart = L.startX; const used = L.x - textStart; const space = (width - right) - (L.x);
        let jc = p.jc || 'left'; if (jc === 'start') jc = 'left'; if (jc === 'end') jc = 'right';
        L.shift = 0; L.justify = 0;
        if (jc === 'center') L.shift = space / 2; else if (jc === 'right') L.shift = space;
        else if ((jc === 'both' || jc === 'distribute') && !L.endsBr && L !== lines[lines.length - 1]) {
          const spaces = L.items.filter(it => it.k === 'space').length; if (spaces) L.justify = space / spaces;
        }
        if (L.labelEnd != null && L.shift) { /* label stays at margin */ }
      }
      const contentH = lines.reduce((h, l) => h + l.height, 0);
      const bd = p.bdr || {};
      const pad = { top: bd.top ? (bd.top.space || 1) + bd.top.sz : 0, bottom: bd.bottom ? (bd.bottom.space || 1) + bd.bottom.sz : 0 };
      return { kind: 'p', lines, width, left, right, firstOff, labelTok, label, p, base, spB, spA, pad, bd, shd: p.shd, ctx: !!p.ctx, styleId, keepNext: !!p.keepNext, keepLines: !!p.keepLines, pbb: !!p.pbb, contentH, height: contentH + pad.top + pad.bottom, extra: extraBlocks, hasPb: lines.some(l => l.pbAfter), hasCb: lines.some(l => l.cbAfter), fonts, fontOf, colorOf };
    }

    /* ---- draw helpers ---- */
    function drawLines(page, lay, x0, topY, from, to, ctxv) {
      let y = topY;
      const shdColor = hexColor(lay.shd);
      const sliceH = lay.lines.slice(from, to).reduce((h, l) => h + l.height, 0);
      const boxTop = topY + (from === 0 ? lay.pad.top : 0), boxH = sliceH + (from === 0 ? lay.pad.top : 0) + (to === lay.lines.length ? lay.pad.bottom : 0);
      const bx = x0 + (lay.p.ind?.left || 0) - 0, bw = lay.width - (lay.p.ind?.left || 0) - (lay.p.ind?.right || 0);
      if (shdColor) page.drawRectangle({ x: x0 + Math.max(0, lay.left + Math.min(0, lay.firstOff)) - 0, y: boxTop - boxH, width: lay.width - Math.max(0, lay.left + Math.min(0, lay.firstOff)) - lay.right, height: boxH, color: rgbOf(shdColor) });
      const bl = x0 + Math.max(0, lay.left + Math.min(0, lay.firstOff)), br = x0 + lay.width - lay.right;
      const edge = (b, xa, ya, xb, yb) => { if (b) page.drawLine({ start: { x: xa, y: ya }, end: { x: xb, y: yb }, thickness: Math.max(0.25, b.sz), color: rgbOf(b.color) }); };
      if (from === 0) edge(lay.bd.top, bl, topY, br, topY);
      if (to === lay.lines.length) edge(lay.bd.bottom, bl, topY - boxH + 0, br, topY - boxH + 0);
      edge(lay.bd.left, bl - 2, topY, bl - 2, topY - boxH); edge(lay.bd.right, br + 2, topY, br + 2, topY - boxH);
      y -= from === 0 ? lay.pad.top : 0;
      for (let li = from; li < to; li++) {
        const L = lay.lines[li]; const baseY = y - L.ascent;
        if (li === 0 && lay.labelTok) { const lt = lay.labelTok; lt.font.draw(page, lt.text, { x: x0 + L.startX, y: baseY, size: lt.size, color: rgbOf(lay.colorOf(lt.rp)) }); }
        let jx = 0;
        for (const it of L.items) {
          const x = x0 + it.x + L.shift + jx;
          if (it.k === 'tab') {
            if (it.leader && it.leader !== 'none' && it.w > 4) {
              const ch = it.leader === 'dot' || it.leader === 'middleDot' ? '.' : it.leader === 'hyphen' ? '-' : '_';
              const cw = it.font.widthOfTextAtSize(ch, it.size); const n = Math.floor((it.w - 2) / (cw * (ch === '.' ? 1.8 : 1)));
              if (n > 0) { const step = (it.w - 2) / n; for (let k = 0; k < n; k++) it.font.draw(page, ch, { x: x + 1 + k * step + (step - cw) / 2, y: baseY, size: it.size, color: rgbOf(lay.colorOf(it.rp)) }); }
            }
            continue;
          }
          if (it.k === 'space') { jx += L.justify; continue; }
          if (it.k === 'img') {
            const ih = it.h;
            if (it.crop) { /* cropped image: draw full image scaled so the visible part fits (clip via scale) */ }
            const iw = it.w;
            if (it.crop && (it.crop.l || it.crop.r || it.crop.t || it.crop.b)) {
              const cw = 1 - it.crop.l - it.crop.r, ch = 1 - it.crop.t - it.crop.b;
              const fw = iw / cw, fh = ih / ch;
              try { page.pushOperators(PDFLib.pushGraphicsState(), PDFLib.moveTo(x, baseY), PDFLib.lineTo(x + iw, baseY), PDFLib.lineTo(x + iw, baseY + ih), PDFLib.lineTo(x, baseY + ih), PDFLib.closePath(), PDFLib.clip(), PDFLib.endPath()); page.drawImage(it.img, { x: x - it.crop.l * fw, y: baseY - it.crop.b * fh, width: fw, height: fh }); page.pushOperators(PDFLib.popGraphicsState()); } catch (e) { page.drawImage(it.img, { x, y: baseY, width: iw, height: ih }); }
            } else page.drawImage(it.img, { x, y: baseY, width: iw, height: ih });
            continue;
          }
          let text = it.k === 'field' ? String(it.name === 'PAGE' ? ctxv.page : ctxv.total) : it.t;
          const rp = it.rp; const sz = it.size; const col = lay.colorOf(rp);
          const va = rp.va === 'superscript' ? sz * 0.55 : rp.va === 'subscript' ? -sz * 0.18 : 0;
          const wTxt = it.k === 'field' ? it.font.widthOfTextAtSize(text, sz) : it.w;
          const hlc = rp.hl && rp.hl !== 'none' ? hexColor(HL[rp.hl] || rp.hl) : hexColor(rp.shd);
          if (hlc) page.drawRectangle({ x, y: baseY - sz * 0.22, width: wTxt, height: sz * 1.1, color: rgbOf(hlc) });
          it.font.draw(page, text, { x, y: baseY + va, size: sz, color: rgbOf(col) });
          if (rp.b && false) { /* bold handled by font */ }
          if (rp.u) page.drawLine({ start: { x, y: baseY - sz * 0.12 }, end: { x: x + wTxt, y: baseY - sz * 0.12 }, thickness: Math.max(0.4, sz / 22), color: rgbOf(col) });
          if (rp.strike) page.drawLine({ start: { x, y: baseY + sz * 0.3 }, end: { x: x + wTxt, y: baseY + sz * 0.3 }, thickness: Math.max(0.4, sz / 22), color: rgbOf(col) });
        }
        y -= L.height;
      }
    }

    /* ---- tables ---- */
    function resolveTable(tblEl) {
      const direct = parseTblPr(first(tblEl, 'tblPr'));
      const sid = direct.style || defaultStyle(M, 'table')?.id;
      let styleTbl = {}, cond = {}, styleR = {}, styleP = {}, styleTc = {};
      for (const s of styleChain(M, sid)) { styleTbl = { ...styleTbl, ...s.tbl, bdr: { ...(styleTbl.bdr || {}), ...(s.tbl?.bdr || {}) }, mar: { ...(styleTbl.mar || {}), ...(s.tbl?.mar || {}) } }; styleR = mergeR(styleR, s.r); styleP = mergeP(styleP, s.p); styleTc = { ...styleTc, ...s.tcPr }; for (const k in s.cond) cond[k] = { r: mergeR(cond[k]?.r || {}, s.cond[k].r), p: mergeP(cond[k]?.p || {}, s.cond[k].p), tc: { ...(cond[k]?.tc || {}), ...s.cond[k].tc }, tbl: { bdr: { ...(cond[k]?.tbl?.bdr || {}), ...(s.cond[k].tbl?.bdr || {}) } } }; }
      const T = { ...styleTbl, ...direct, bdr: { ...(styleTbl.bdr || {}), ...(direct.bdr || {}) }, mar: { top: 0, left: 5.4, bottom: 0, right: 5.4, ...(styleTbl.mar || {}), ...(direct.mar || {}) }, cond, styleR, styleP, styleTc };
      T.look = direct.look || styleTbl.look || { firstRow: true, noVBand: true };
      return T;
    }
    async function layoutTable(tblEl, availW, relMap, depth) {
      const T = resolveTable(tblEl);
      const grid = kids(first(tblEl, 'tblGrid'), 'gridCol').map(g => num(attr(g, 'w')) / TW);
      const rowEls = kids(tblEl, 'tr');
      const rowsInfo = rowEls.map(tr => { const cells = []; let col = 0; for (const tc of kids(tr, 'tc')) { const tcp = parseTcPr(first(tc, 'tcPr')); const span = tcp.span || 1; cells.push({ el: tc, tcp, col, span }); col += span; } const trPr = first(tr, 'trPr'); const hEl = first(trPr, 'trHeight'); return { cells, h: hEl ? num(attr(hEl, 'val')) / TW : 0, hRule: hEl ? attr(hEl, 'hRule') || 'atLeast' : null, header: !!first(trPr, 'tblHeader'), cantSplit: !!first(trPr, 'cantSplit') }; });
      let ncols = Math.max(grid.length, ...rowsInfo.map(r => r.cells.reduce((s, c) => s + c.span, 0)), 1);
      let cols = grid.slice(); if (!cols.length) { const w0 = availW / ncols; cols = Array(ncols).fill(w0); }
      while (cols.length < ncols) cols.push(cols.length ? cols[cols.length - 1] : 50);
      // tcW fallback when grid is missing/zero
      if (cols.every(w => !w)) cols = cols.map(() => availW / ncols);
      let total = cols.reduce((a, b) => a + b, 0);
      let target = null;
      if (T.w?.type === 'dxa' && T.w.v) target = T.w.v / TW; else if (T.w?.type === 'pct' && T.w.v) target = availW * (T.w.v > 100 ? T.w.v / 5000 : T.w.v / 100);
      if (total > availW + 0.5) { cols = cols.map(w => w * availW / total); total = availW; }
      else if (target && target < total - 1) { cols = cols.map(w => w * target / total); total = target; }
      else if (T.w?.type === 'pct' && target && target > total + 1) { const k = Math.min(target, availW) / total; cols = cols.map(w => w * k); total *= k; }
      const colX = [0]; for (const w of cols) colX.push(colX[colX.length - 1] + w);
      const nRows = rowsInfo.length;
      // style flags
      const lk = T.look;
      const cellStyle = (ri, ci, span) => {
        let r = { ...T.styleR }, p = { ...T.styleP }, tc = { ...T.styleTc }, bdr = {};
        const apply = key => { const c = T.cond[key]; if (!c) return; r = mergeR(r, c.r); p = mergeP(p, c.p); tc = { ...tc, ...c.tc, bdr: { ...(tc.bdr || {}), ...(c.tc.bdr || {}) } }; if (c.tbl?.bdr) bdr = { ...bdr, ...c.tbl.bdr }; };
        const lastRow = ri === nRows - 1, lastCol = ci + span >= ncols;
        const hasFirstRow = lk.firstRow, hasFirstCol = lk.firstCol;
        if (!lk.noHBand) apply((ri - (hasFirstRow ? 1 : 0)) % 2 === 0 ? 'band1Horz' : 'band2Horz');
        if (!lk.noVBand) apply((ci - (hasFirstCol ? 1 : 0)) % 2 === 0 ? 'band1Vert' : 'band2Vert');
        if (lk.lastCol && lastCol) apply('lastCol'); if (hasFirstCol && ci === 0) apply('firstCol');
        if (lk.lastRow && lastRow) apply('lastRow'); if (hasFirstRow && ri === 0) apply('firstRow');
        return { r, p, tc, bdr };
      };
      const rows = [];
      // vertical merge bookkeeping: map (row,col) -> origin
      const origin = {};
      for (let ri = 0; ri < nRows; ri++) {
        for (const c of rowsInfo[ri].cells) {
          if (c.tcp.vm === 'continue') { const o = origin[c.col]; if (o) { o.rowSpan++; c.skip = true; c.originRef = o; } else { c.vmOrphan = true; } }
          else { c.rowSpan = 1; origin[c.col] = c; }
          if (c.tcp.vm !== 'continue') { for (let k = 0; k < c.span; k++) origin[c.col + k] = c; }
        }
      }
      for (let ri = 0; ri < nRows; ri++) {
        const ri_ = rowsInfo[ri]; const row = { cells: [], h: 0 };
        for (const c of ri_.cells) {
          if (c.skip) continue;
          const st = cellStyle(ri, c.col, c.span);
          const mar = { ...T.mar, ...(st.tc.mar || {}), ...(c.tcp.mar || {}) };
          const cw = colX[Math.min(ncols, c.col + c.span)] - colX[c.col];
          const inner = Math.max(12, cw - mar.left - mar.right);
          const blocks = await layoutBlocks(kids(c.el).filter(e => e.localName === 'p' || e.localName === 'tbl' || e.localName === 'sdt'), inner, { pPr: st.p, rPr: st.r }, relMap, depth + 1);
          const contentH = blocks.reduce((h, b) => h + (b.kind === 'p' ? b.spB + b.height + b.spA : b.height), 0);
          row.cells.push({ ...c, st, mar, cw, x: colX[c.col], blocks, contentH, fill: c.tcp.fill || st.tc.fill, bdrC: { ...(st.tc.bdr || {}), ...(c.tcp.bdr || {}) }, bdrT: st.bdr, va: c.tcp.va || st.tc.va });
        }
        rows.push(row);
      }
      // row heights
      for (let ri = 0; ri < nRows; ri++) {
        const row = rows[ri]; let h = 0;
        for (const c of row.cells) { if ((c.rowSpan || 1) === 1) h = Math.max(h, c.contentH + c.mar.top + c.mar.bottom); }
        const ri_ = rowsInfo[ri];
        if (ri_.hRule === 'exact') h = ri_.h; else if (ri_.h) h = Math.max(h, ri_.h);
        row.h = Math.max(h, 2);
      }
      for (let ri = 0; ri < nRows; ri++) for (const c of rows[ri].cells) if ((c.rowSpan || 1) > 1) { const end = Math.min(nRows - 1, ri + c.rowSpan - 1); let sum = 0; for (let k = ri; k <= end; k++) sum += rows[k].h; const need = c.contentH + c.mar.top + c.mar.bottom; if (need > sum) rows[end].h += need - sum; }
      const hdrRows = []; for (let ri = 0; ri < nRows && rowsInfo[ri].header; ri++) hdrRows.push(ri);
      const ind = T.ind || 0; const algn = T.jc;
      const off = algn === 'center' ? Math.max(0, (availW - total) / 2) : algn === 'right' ? Math.max(0, availW - total) : ind;
      return { kind: 't', T, rows, rowsInfo, colX, total, nRows, ncols, hdrRows, off, height: rows.reduce((h, r) => h + r.h, 0), cantSplit: rowsInfo.map(r => r.cantSplit) };
    }
    const edgeBorder = (tb, cell, side, ri, ci, nRows, ncols, span, rowSpan) => {
      const c = cell.bdrC[side]; if (c !== undefined) return c;
      const cb = cell.bdrT[side]; if (cb !== undefined) return cb;
      const B = tb.T.bdr;
      if (side === 'top') return ri === 0 ? B.top : B.insideH;
      if (side === 'bottom') return ri + (rowSpan || 1) >= nRows ? B.bottom : B.insideH;
      if (side === 'left') return ci === 0 ? B.left : B.insideV;
      return ci + span >= ncols ? B.right : B.insideV;
    };
    function drawTableRows(page, tb, x0, topY, from, to, ctxv) {
      let y = topY; const rowY = [];
      for (let ri = from; ri < to; ri++) { rowY[ri] = y; y -= tb.rows[ri].h; }
      for (let ri = from; ri < to; ri++) {
        const row = tb.rows[ri];
        for (const c of row.cells) {
          const span = (c.rowSpan || 1); const endR = Math.min(tb.nRows - 1, ri + span - 1);
          let h = 0; for (let k = ri; k <= endR; k++) h += tb.rows[k].h;
          const cx = x0 + tb.off + c.x, cy = rowY[ri];
          const fill = hexColor(c.fill); if (fill) page.drawRectangle({ x: cx, y: cy - h, width: c.cw, height: h, color: rgbOf(fill) });
          // content
          let free = h - c.mar.top - c.mar.bottom - c.contentH; let yy = cy - c.mar.top - (c.va === 'center' ? free / 2 : c.va === 'bottom' ? free : 0);
          for (const b of c.blocks) {
            if (b.kind === 'p') { yy -= b.spB; drawLines(page, b, cx + c.mar.left, yy, 0, b.lines.length, ctxv); yy -= b.height + b.spA; }
            else { drawTable(page, b, cx + c.mar.left, yy, ctxv); yy -= b.height; }
          }
        }
      }
      for (let ri = from; ri < to; ri++) {
        const row = tb.rows[ri];
        for (const c of row.cells) {
          const span = (c.rowSpan || 1); const endR = Math.min(tb.nRows - 1, ri + span - 1);
          let h = 0; for (let k = ri; k <= endR; k++) h += tb.rows[k].h;
          const cx = x0 + tb.off + c.x, cy = rowY[ri];
          const ci = c.col;
          const line = (b, xa, ya, xb, yb) => { if (b && b.sz > 0) page.drawLine({ start: { x: xa, y: ya }, end: { x: xb, y: yb }, thickness: Math.max(0.25, b.sz), color: rgbOf(b.color) }); };
          line(edgeBorder(tb, c, 'top', ri, ci, tb.nRows, tb.ncols, c.span, span), cx, cy, cx + c.cw, cy);
          line(edgeBorder(tb, c, 'bottom', ri, ci, tb.nRows, tb.ncols, c.span, span), cx, cy - h, cx + c.cw, cy - h);
          line(edgeBorder(tb, c, 'left', ri, ci, tb.nRows, tb.ncols, c.span, span), cx, cy, cx, cy - h);
          line(edgeBorder(tb, c, 'right', ri, ci, tb.nRows, tb.ncols, c.span, span), cx + c.cw, cy, cx + c.cw, cy - h);
        }
      }
    }
    const drawTable = (page, tb, x0, topY, ctxv) => drawTableRows(page, tb, x0, topY, 0, tb.rows.length, ctxv);

    /* ---- block layout (paragraphs, tables, sdt wrappers) ---- */
    async function layoutBlocks(els, width, tctx, relMap, depth = 0) {
      const out = [];
      for (const el of els) {
        if (el.localName === 'p') {
          const lay = await layoutParagraph(el, width, tctx, null, null, relMap);
          out.push(lay);
          for (const ex of lay.extra) { const subs = await layoutBlocks([ex], Math.max(60, width - 24), tctx, relMap, depth + 1); for (const s of subs) { if (s.kind === 'p') { s.left += 12; for (const L of s.lines) { L.startX += 12; L.items.forEach(it => { it.x += 12; }); } } out.push(s); } }
        } else if (el.localName === 'tbl') {
          if (depth > 4) continue;
          out.push(await layoutTable(el, width, relMap, depth));
        } else if (el.localName === 'sdt') {
          const content = first(el, 'sdtContent'); if (content) out.push(...await layoutBlocks(kids(content), width, tctx, relMap, depth));
        }
      }
      return out;
    }

    /* ---- header / footer ---- */
    async function hfBlocks(sect, kind, pageNo) {
      const key = kind + ((sect.titlePg && pageNo === 1) ? 'first' : 'default');
      const id = sect.hf[key] || (key.endsWith('first') ? null : null);
      if (!id) return null;
      const rel = M.rels[id]; if (!rel) return null; const f = zip.file(rel.target); if (!f) return null;
      const doc = parseXml(await f.async('text'));
      const rm = await relsOf(zip, rel.target);
      return { els: kids(doc.documentElement), rm, key: rel.target };
    }

    /* ---- main pagination ---- */
    const pages = []; // {page, sect, sIdx}
    let cur = null; // {page, sect, col, y, ytop, ybot}
    let curSectIdx = -1;
    const newPage = (sect, sIdx) => {
      const page = pdf.addPage([sect.w, sect.h]);
      cur = { page, sect, sIdx, col: 0, y: 0, headerH: 0, number: pages.length + 1 };
      pages.push(cur);
      // body top: leave room for header
      cur.top = sect.h - (sect.bodyTop ?? sect.top); cur.bottom = sect.bodyBottom ?? sect.bottom;
      cur.y = cur.top; cur.fresh = true;
      return cur;
    };
    const colWidth = s => (s.w - s.left - s.right - (s.cols - 1) * s.colGap) / s.cols;
    const colX = (s, c) => s.left + c * (colWidth(s) + s.colGap);
    const advance = () => {
      const s = cur.sect;
      if (cur.col + 1 < s.cols) { cur.col++; cur.y = cur.top; cur.fresh = true; }
      else newPage(s, cur.sIdx);
    };
    const room = () => cur.y - cur.bottom;
    // header heights affect body top; compute lazily per section
    const hfHeights = {};
    async function measureHf(sIdx) {
      const sect = sectInfos[sIdx];
      const res = { top: sect.top, bottom: sect.bottom };
      for (const [kind, dflt] of [['h', 'header'], ['f', 'footer']]) {
        for (const first_ of [false, true]) {
          const hb = await hfBlocks(sect, kind, first_ ? 1 : 2); if (!hb) continue;
          const blocks = await layoutBlocks(hb.els, sect.w - sect.left - sect.right, {}, hb.rm, 1);
          const h = blocks.reduce((s, b) => s + (b.kind === 'p' ? b.spB + b.height + b.spA : b.height), 0);
          const mapKey = kind + (first_ ? 'first' : 'default');
          res[mapKey] = { hb, h };
          if (kind === 'h') res.top = Math.max(res.top, sect.header + h + 4); else res.bottom = Math.max(res.bottom, sect.footer + h + 4);
        }
      }
      return res;
    }
    status('Laying out pages…');
    let pendingSpace = 0; let prevBlock = null;
    for (let si = 0; si < sections.length; si++) {
      const sect = sectInfos[si];
      hfHeights[si] = await measureHf(si);
      const hh = hfHeights[si];
      sect.bodyTop = hh.top; sect.bodyBottom = hh.bottom;
      const startNew = !cur || sect.type !== 'continuous' || si === 0;
      if (startNew) { if (cur && cur.fresh && si > 0 && false) { /* reuse */ } curSectIdx = si; newPage(sect, si); cur.top = sect.h - sect.bodyTop; cur.bottom = sect.bodyBottom; cur.y = cur.top; }
      else { cur.sect = sect; cur.sIdx = si; cur.bottom = sect.bodyBottom; }
      const blocks = await layoutBlocks(sections[si].blocks.filter(e => e.localName === 'p' || e.localName === 'tbl' || e.localName === 'sdt'), colWidth(sect), {}, M.rels, 0);
      prevBlock = null;
      for (let bi = 0; bi < blocks.length; bi++) {
        const b = blocks[bi]; const cw = colWidth(sect);
        if (b.kind === 'p') {
          if (b.pbb && !cur.fresh) advanceToPage();
          const isDocStart = si === 0 && pages.length === 1 && cur.col === 0 && cur.y === cur.top && b === blocks[0];
          let sb = (cur.fresh && !isDocStart) ? 0 : b.spB;
          if (!cur.fresh && prevBlock && prevBlock.kind === 'p') { if (prevBlock.ctx && b.ctx && prevBlock.styleId === b.styleId) { cur.y += prevBlock.spA; sb = 0; } else sb = Math.max(0, sb - prevBlock.spA); }
          let need = sb + (b.keepLines ? b.height : b.lines[0].height + b.pad.top);
          if (b.keepNext && blocks[bi + 1]) { const nx = blocks[bi + 1]; need += (b.keepLines ? 0 : b.height - b.lines[0].height - b.pad.top) + (nx.kind === 'p' ? nx.spB + (nx.lines[0]?.height || 0) : (nx.rows[0]?.h || 0)); }
          if (need > room() + 0.01 && !cur.fresh) { advance(); sb = 0; }
          cur.y -= sb;
          let from = 0;
          while (from < b.lines.length) {
            let h = from === 0 ? b.pad.top : 0; let to = from;
            while (to < b.lines.length && h + b.lines[to].height <= room() + 0.01) { h += b.lines[to].height; to++; }
            if (to === from) { if (cur.fresh) { to = from + 1; h += b.lines[from].height; } else { advance(); continue; } }
            if (to < b.lines.length && to - from === 1 && from === 0 && b.lines.length > 2 && !cur.fresh) { advance(); continue; }
            if (to < b.lines.length && b.lines.length - to === 1 && to - from > 2) { to--; h -= b.lines[to].height; }
            if (to === b.lines.length) h += b.pad.bottom;
            drawLines(cur.page, b, colX(sect, cur.col), cur.y, from, to, { page: cur.number, total: 0 });
            cur.fresh = false; cur.y -= h;
            const last = b.lines[to - 1]; from = to;
            if (last.pbAfter) advanceToPage(); else if (last.cbAfter) advance(); else if (from < b.lines.length) advance();
          }
          cur.y -= b.spA; prevBlock = b;
        } else {
          // table: split by rows
          let ri = 0; const startY = cur.y;
          while (ri < b.rows.length) {
            let h = 0, to = ri;
            const repeat = ri > 0 && b.hdrRows.length && !b.hdrRows.includes(ri) ? b.hdrRows : [];
            const repH = repeat.reduce((s, k) => s + b.rows[k].h, 0);
            h = repH;
            while (to < b.rows.length) {
              // rows tied together by vertical merge must stay together
              let end = to; for (const c of b.rows[to].cells) end = Math.max(end, Math.min(b.nRows - 1, to + (c.rowSpan || 1) - 1));
              let seg = 0; for (let k = to; k <= end; k++) seg += b.rows[k].h;
              if (h + seg <= room() + 0.01) { h += seg; to = end + 1; } else break;
            }
            if (to === ri) {
              if (!cur.fresh) { advance(); continue; }
              let end = ri; for (const c of b.rows[ri].cells) end = Math.max(end, Math.min(b.nRows - 1, ri + (c.rowSpan || 1) - 1)); to = end + 1;
            }
            let yy = cur.y;
            if (repeat.length) { for (const k of repeat) { drawTableRows(cur.page, { ...b, rows: b.rows }, colX(sect, cur.col), yy, k, k + 1, { page: cur.number, total: 0 }); yy -= b.rows[k].h; } }
            drawTableRows(cur.page, b, colX(sect, cur.col), yy, ri, to, { page: cur.number, total: 0 });
            cur.fresh = false; cur.y = yy - b.rows.slice(ri, to).reduce((s, r) => s + r.h, 0); ri = to;
            if (ri < b.rows.length) advance();
          }
          cur.y -= 4; prevBlock = b;
        }
      }
    }
    function advanceToPage() { newPage(cur.sect, cur.sIdx); cur.top = cur.sect.h - cur.sect.bodyTop; cur.bottom = cur.sect.bodyBottom; cur.y = cur.top; }
    // (advance() creates pages via newPage which uses sect.top/bottom; normalise bodyTop/bottom for every page)
    for (const pg of pages) { /* geometry already applied at draw time */ }

    /* ---- headers & footers (need the total page count) ---- */
    const total = pages.length;
    for (const pg of pages) {
      const sect = pg.sect; const hh = hfHeights[pg.sIdx];
      let isFirstOfSection = sect.titlePg && pages.filter(p => p.sIdx === pg.sIdx)[0] === pg;
      for (const [kind, y0] of [['h', 'header'], ['f', 'footer']]) {
        const info = hh[kind + (isFirstOfSection && hh[kind + 'first'] ? 'first' : 'default')] || (isFirstOfSection ? null : null);
        if (!info) continue;
        const blocks = await layoutBlocks(info.hb.els, sect.w - sect.left - sect.right, {}, info.hb.rm, 1);
        const h = blocks.reduce((s, b) => s + (b.kind === 'p' ? b.spB + b.height + b.spA : b.height), 0);
        let y = kind === 'h' ? sect.h - sect.header : sect.footer + h;
        for (const b of blocks) {
          if (b.kind === 'p') { y -= b.spB; drawLines(pg.page, b, sect.left, y, 0, b.lines.length, { page: pg.number, total }); y -= b.height + b.spA; }
          else { drawTable(pg.page, b, sect.left, y, { page: pg.number, total }); y -= b.height; }
        }
      }
    }
    pdf.setProducer('FRZ PDF Express'); pdf.setCreator('FRZ PDF Express');
    const bytes = await pdf.save();
    return { bytes, pages: total, warnings: [...warn] };
  }

  window.FRZOffice = Object.assign(window.FRZOffice || {}, { docx: docxToPdfBytes, _h: { parseXml, kids, first, attr, num, clamp, clean, hexColor, rgbOf, makeFonts, embedImage, relsOf, famKind } });
  /* =====================================================================
     EXCEL (.xlsx / .xls / .csv / .tsv)
     ===================================================================== */
  const IDX = '000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 800000 008000 000080 808000 800080 008080 C0C0C0 808080 9999FF 993366 FFFFCC CCFFFF 660066 FF8080 0066CC CCCCFF 000080 FF00FF FFFF00 00FFFF 800080 800000 008080 0000FF 00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 3366FF 33CCCC 99CC00 FFCC00 FF9900 FF6600 666699 969696 003366 339966 003300 333300 993300 993366 333399 333333 000000 FFFFFF'.split(' ');
  const rgbToHsl = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; };
  const hslToRgb = ([h, s, l]) => { if (!s) return [l, l, l]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = t => { if (t < 0) t += 1; if (t > 1) t -= 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; };
  const applyTint = (c, tint) => { if (!tint) return c; const hsl = rgbToHsl(c); hsl[2] = tint < 0 ? hsl[2] * (1 + tint) : hsl[2] * (1 - tint) + tint; return hslToRgb(hsl); };
  const PAPER = { 1: [612, 792], 5: [612, 1008], 7: [522, 756], 8: [841.9, 1190.6], 9: [595.3, 841.9], 11: [419.5, 595.3], 13: [498.9, 708.7] };
  const colName = n => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  function parseTheme(text) {
    const out = []; if (!text) return out;
    const names = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
    const cs = /<a:clrScheme[\s\S]*?<\/a:clrScheme>/.exec(text)?.[0] || '';
    for (const n of names) { const m = new RegExp('<a:' + n + '>([\\s\\S]*?)</a:' + n + '>').exec(cs); let hex = null; if (m) { const a = /srgbClr val="([0-9A-Fa-f]{6})"/.exec(m[1]) || /lastClr="([0-9A-Fa-f]{6})"/.exec(m[1]); hex = a ? a[1] : null; } out.push(hex || '000000'); }
    return out;
  }
  function colorFrom(el, theme) {
    if (!el) return null;
    const rgbv = attr(el, 'rgb'), th = attr(el, 'theme'), ix = attr(el, 'indexed'), tint = num(attr(el, 'tint'), 0);
    let c = null;
    if (rgbv) c = hexColor(rgbv.slice(-6)); else if (th != null) c = hexColor(theme[+th] || '000000'); else if (ix != null) c = hexColor(IDX[+ix] || '000000'); else if (attr(el, 'auto')) return null;
    return c ? applyTint(c, tint) : null;
  }
  function parseStyles(text, theme) {
    const S = { xfs: [], fonts: [], fills: [], borders: [] };
    if (!text) return S;
    const root = parseXml(text).documentElement;
    for (const f of kids(first(root, 'fonts'), 'font')) S.fonts.push({ b: !!first(f, 'b') && attr(first(f, 'b'), 'val') !== '0', i: !!first(f, 'i') && attr(first(f, 'i'), 'val') !== '0', u: !!first(f, 'u') && attr(first(f, 'u'), 'val') !== 'none', strike: !!first(f, 'strike'), sz: num(attr(first(f, 'sz'), 'val'), 11), color: colorFrom(first(f, 'color'), theme), name: attr(first(f, 'name'), 'val') || 'Calibri' });
    for (const f of kids(first(root, 'fills'), 'fill')) { const pf = first(f, 'patternFill'); let c = null; if (pf) { const pt = attr(pf, 'patternType'); if (pt && pt !== 'none') c = colorFrom(first(pf, 'fgColor'), theme) || (pt === 'solid' ? [0.75, 0.75, 0.75] : null); if (pt === 'gray125' || pt === 'gray0625') c = null; } S.fills.push(c); }
    for (const b of kids(first(root, 'borders'), 'border')) { const o = {}; for (const side of ['left', 'right', 'top', 'bottom']) { const e = first(b, side); const st = attr(e, 'style'); if (st) o[side] = { style: st, color: colorFrom(first(e, 'color'), theme) || [0, 0, 0] }; } S.borders.push(o); }
    for (const x of kids(first(root, 'cellXfs'), 'xf')) { const al = first(x, 'alignment'); S.xfs.push({ font: num(attr(x, 'fontId')), fill: num(attr(x, 'fillId')), border: num(attr(x, 'borderId')), h: attr(al, 'horizontal'), v: attr(al, 'vertical'), wrap: attr(al, 'wrapText') === '1' || attr(al, 'wrapText') === 'true', indent: num(attr(al, 'indent')), shrink: attr(al, 'shrinkToFit') === '1', rot: num(attr(al, 'textRotation')) }); }
    return S;
  }
  const BORDER_W = { hair: 0.25, thin: 0.5, dotted: 0.5, dashed: 0.5, dashDot: 0.5, dashDotDot: 0.5, mediumDashed: 1, mediumDashDot: 1, mediumDashDotDot: 1, slantDashDot: 1, medium: 1, thick: 1.8, double: 1.2 };
  function wrapLines(text, font, size, maxW) {
    const out = [];
    const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    for (const para of String(text).split(/\r?\n/)) {
      const words = para.split(/(\s+)/); let line = '';
      for (const w of words) {
        if (!w) continue;
        const next = line + w;
        if (font.widthOfTextAtSize(next.replace(/\s+$/, ''), size) <= maxW || !line.trim()) { line = next; if (font.widthOfTextAtSize(line.trim(), size) > maxW) { const gs = seg ? [...seg.segment(line.trim())].map(x => x.segment) : [...line.trim()]; let chunk = ''; for (const g of gs) { if (chunk && font.widthOfTextAtSize(chunk + g, size) > maxW) { out.push(chunk); chunk = g; } else chunk += g; } line = chunk; } }
        else { out.push(line.replace(/\s+$/, '')); line = /^\s+$/.test(w) ? '' : w; }
      }
      out.push(line.replace(/\s+$/, ''));
    }
    return out;
  }
  function hfText(spec, vars) {
    const parts = { L: '', C: '', R: '' }; if (!spec) return parts;
    let cur = 'C'; const re = /&([LCR])|&(P|N|D|T|F|A|Z|G)|&"[^"]*"|&\d+|&[BIUSXYEO]|&&|[^&]+|&/g; let m;
    while ((m = re.exec(spec))) {
      if (m[1]) cur = m[1]; else if (m[2]) { const k = m[2]; parts[cur] += k === 'P' ? vars.page : k === 'N' ? vars.total : k === 'D' ? vars.date : k === 'T' ? vars.time : k === 'F' ? vars.file : k === 'A' ? vars.sheet : ''; }
      else if (m[0] === '&&') parts[cur] += '&'; else if (m[0][0] !== '&') parts[cur] += m[0];
    }
    return parts;
  }

  async function xlsxToPdfBytes(buffer, ctx) {
    const { loadUniFonts, status = () => {}, fileName = '' } = ctx; const XLSX = window.XLSX;
    status('Reading the workbook…');
    const u8 = new Uint8Array(buffer || 0); const isZip = !ctx.wb && u8[0] === 0x50 && u8[1] === 0x4b;
    const wb = ctx.wb || XLSX.read(buffer, { type: 'array', cellDates: true, cellStyles: true, cellNF: true, sheetStubs: true });
    let zip = null, S = { xfs: [], fonts: [], fills: [], borders: [] }, theme = [], sheetPaths = {};
    if (isZip) {
      try {
        zip = await JSZip.loadAsync(buffer);
        const th = zip.file('xl/theme/theme1.xml'); theme = parseTheme(th ? await th.async('text') : '');
        const st = zip.file('xl/styles.xml'); S = parseStyles(st ? await st.async('text') : '', theme);
        const wbf = zip.file('xl/workbook.xml');
        if (wbf) { const rels = await relsOf(zip, 'xl/workbook.xml'); const wd = parseXml(await wbf.async('text')); for (const s of kids(first(wd.documentElement, 'sheets'), 'sheet')) { const rid = attr(s, 'id'); if (rels[rid]) sheetPaths[attr(s, 'name')] = rels[rid].target; } }
      } catch (e) { zip = null; }
    }
    const pdf = await PDFLib.PDFDocument.create();
    const fonts = await makeFonts(pdf, loadUniFonts);
    const imgCache = new Map();
    const pagesMeta = []; let sheetCount = 0, cellCount = 0; const warn = new Set();
    const names = wb.SheetNames; const wbSheets = wb.Workbook?.Sheets || [];
    const printAreas = {}; for (const n of wb.Workbook?.Names || []) if (n.Name === '_xlnm.Print_Area' && n.Sheet != null) printAreas[n.Sheet] = n.Ref;
    const dateNow = new Date(); const dstr = dateNow.toLocaleDateString(), tstr = dateNow.toLocaleTimeString();

    for (let si = 0; si < names.length; si++) {
      const name = names[si]; const ws = wb.Sheets[name];
      if (wbSheets[si] && wbSheets[si].Hidden) continue;
      status(`Converting sheet ${si + 1} of ${names.length}: ${name}`);
      // ---- sheet-level XML (styles per cell, defaults, page setup, drawings)
      const sInfo = { s: {}, defCol: null, defRow: 15, pageSetup: {}, margins: { l: 0.7, r: 0.7, t: 0.75, b: 0.75, h: 0.3, f: 0.3 }, fitPage: false, grid: true, printGrid: false, header: '', footer: '', drawing: null, hCenter: false, vCenter: false };
      if (zip && sheetPaths[name]) {
        const sf = zip.file(sheetPaths[name]);
        if (sf) {
          const doc = parseXml(await sf.async('text')); const root = doc.documentElement;
          for (const c of root.getElementsByTagName('c')) { const sv = c.getAttribute('s'); if (sv && sv !== '0') sInfo.s[c.getAttribute('r')] = +sv; }
          const fp = first(root, 'sheetFormatPr'); if (fp) { if (attr(fp, 'defaultColWidth')) sInfo.defCol = num(attr(fp, 'defaultColWidth')); if (attr(fp, 'defaultRowHeight')) sInfo.defRow = num(attr(fp, 'defaultRowHeight'), 15); sInfo.baseCol = num(attr(fp, 'baseColWidth'), 8); }
          const pm = first(root, 'pageMargins'); if (pm) sInfo.margins = { l: num(attr(pm, 'left'), 0.7), r: num(attr(pm, 'right'), 0.7), t: num(attr(pm, 'top'), 0.75), b: num(attr(pm, 'bottom'), 0.75), h: num(attr(pm, 'header'), 0.3), f: num(attr(pm, 'footer'), 0.3) };
          const ps = first(root, 'pageSetup'); if (ps) sInfo.pageSetup = { orient: attr(ps, 'orientation'), paper: num(attr(ps, 'paperSize'), 9), scale: num(attr(ps, 'scale'), 100), fitW: attr(ps, 'fitToWidth'), fitH: attr(ps, 'fitToHeight') };
          const spr = first(first(root, 'sheetPr'), 'pageSetUpPr'); if (spr && attr(spr, 'fitToPage') === '1') sInfo.fitPage = true;
          const sv = first(first(root, 'sheetViews'), 'sheetView'); if (sv && attr(sv, 'showGridLines') === '0') sInfo.grid = false;
          const po = first(root, 'printOptions'); if (po) { sInfo.printGrid = attr(po, 'gridLines') === '1'; sInfo.hCenter = attr(po, 'horizontalCentered') === '1'; }
          const hf = first(root, 'headerFooter'); if (hf) { sInfo.header = first(hf, 'oddHeader')?.textContent || ''; sInfo.footer = first(hf, 'oddFooter')?.textContent || ''; }
          const dr = first(root, 'drawing'); if (dr) sInfo.drawing = attr(dr, 'id');
          sInfo.relsMap = sInfo.drawing ? await relsOf(zip, sheetPaths[name]) : {};
        }
      }
      const refStr = ws['!ref'];
      let range = refStr ? XLSX.utils.decode_range(refStr) : null;
      const opts = ctx.opts || {};
      let userRange = null;
      if (opts.range && opts.range.trim()) {
        const raw = opts.range.trim(); const bang = raw.lastIndexOf('!'); const wanted = bang > 0 ? raw.slice(0, bang).replace(/^'|'$/g, '') : names.find((n, k) => !(wbSheets[k] && wbSheets[k].Hidden));
        const ref = (bang > 0 ? raw.slice(bang + 1) : raw).replace(/\$/g, '').toUpperCase();
        if (!/^[A-Z]{1,3}[0-9]{1,7}(:[A-Z]{1,3}[0-9]{1,7})?$/.test(ref)) throw new Error('The range "' + opts.range + '" is not valid. Use a form like A1:F20 or Sheet2!A1:F20.');
        if (!names.includes(wanted)) throw new Error('There is no sheet named "' + wanted + '".');
        if (name !== wanted) continue;
        userRange = XLSX.utils.decode_range(ref);
      }
      if (userRange) range = userRange;
      else if (printAreas[si] && !opts.ignorePrintArea) { try { const pa = printAreas[si].split(',')[0].split('!').pop().replace(/\$/g, ''); range = XLSX.utils.decode_range(pa); } catch (e) { /* keep ref */ } }
      if (range && !userRange && opts.trim !== false) {
        // ignore empty rows/columns at the end (and start): shrink to the cells that really hold data
        let a = 1e9, b = 1e9, c = -1, d = -1;
        for (const k of Object.keys(ws)) { if (k[0] === '!') continue; const cell = ws[k]; if (cell.v == null || String(cell.v).trim() === '') continue; const p = XLSX.utils.decode_cell(k); if (p.r < range.s.r || p.r > range.e.r || p.c < range.s.c || p.c > range.e.c) continue; a = Math.min(a, p.r); b = Math.min(b, p.c); c = Math.max(c, p.r); d = Math.max(d, p.c); }
        if (c < 0) range = null; else { for (const m of ws['!merges'] || []) if (m.s.r >= a && m.s.r <= c && m.s.c >= b && m.s.c <= d) { c = Math.max(c, m.e.r); d = Math.max(d, m.e.c); } range = { s: { r: a, c: b }, e: { r: c, c: d } }; }
      }
      const getCell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
      if (!range) { const page = pdf.addPage(PAPER[9]); fonts.get('Helvetica', false, true).draw(page, '(This sheet is empty)', { x: 40, y: PAPER[9][1] - 50, size: 10, color: rgb(0.4, 0.4, 0.4) }); pagesMeta.push({ page, sheet: name, info: sInfo, ph: PAPER[9][1], pw: PAPER[9][0] }); sheetCount++; continue; }
      const r0 = range.s.r, r1 = range.e.r, c0 = range.s.c, c1 = range.e.c;
      // ---- dimensions (points)
      const defCharW = sInfo.defCol != null ? sInfo.defCol : ((sInfo.baseCol || 8) + 0.71);
      const colsMeta = ws['!cols'] || [], rowsMeta = ws['!rows'] || [];
      const colW = [], colVis = [], rowH = [], rowVis = [];
      for (let c = c0; c <= c1; c++) { const m = colsMeta[c]; const hidden = !!m?.hidden; let px = m && (m.wpx || (m.wch != null ? Math.trunc(m.wch * 7 + 5) : 0)); if (!px) px = Math.trunc(defCharW * 7 + 5); colW[c] = px * 0.75; colVis[c] = !hidden; }
      const merges = ws['!merges'] || []; const mergeAt = {}, covered = new Set();
      for (const m of merges) { if (m.e.r < r0 || m.s.r > r1 || m.e.c < c0 || m.s.c > c1) continue; mergeAt[m.s.r + ',' + m.s.c] = m; for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) covered.add(r + ',' + c); }
      const styleOf = (r, c) => {
        const idx = sInfo.s[XLSX.utils.encode_cell({ r, c })]; const xf = idx != null ? S.xfs[idx] : null;
        const font = (xf && S.fonts[xf.font]) || S.fonts[0] || { sz: 11, name: 'Calibri', color: null };
        return { xf: xf || {}, font, fill: xf ? S.fills[xf.fill] : null, bdr: xf ? S.borders[xf.border] || {} : {} };
      };
      const textOf = cell => { if (!cell || cell.v == null) return ''; if (cell.w != null && cell.w !== '') return clean(cell.w); if (cell.v instanceof Date) return cell.v.toLocaleDateString(); if (typeof cell.v === 'boolean') return cell.v ? 'TRUE' : 'FALSE'; return clean(String(cell.v)); };
      const sizeFactor = nm => /calibri|aptos|segoe|tahoma|candara|corbel|trebuchet/i.test(nm || '') ? 0.93 : 1;
      // row heights: stored or auto (wrapped text / big fonts)
      for (let r = r0; r <= r1; r++) {
        const m = rowsMeta[r]; rowVis[r] = !m?.hidden;
        let h = m && (m.hpt || (m.hpx ? m.hpx * 0.75 : 0));
        if (!h) {
          h = sInfo.defRow;
          for (let c = c0; c <= c1; c++) {
            if (covered.has(r + ',' + c) || !colVis[c]) continue; const cell = getCell(r, c); const txt = textOf(cell); const st = styleOf(r, c);
            const fs = st.font.sz; h = Math.max(h, fs * 1.28);
            if (st.xf.wrap && txt && !mergeAt[r + ',' + c]) { const f = fonts.get(st.font.name, st.font.b, st.font.i); const lines = wrapLines(txt, f, fs * sizeFactor(st.font.name), colW[c] - 4); h = Math.max(h, lines.length * fs * 1.25 + 3); }
            else if (/\n/.test(txt) && st.xf.wrap) h = Math.max(h, txt.split(/\n/).length * fs * 1.25 + 3);
          }
        }
        rowH[r] = h;
      }
      const visCols = []; for (let c = c0; c <= c1; c++) if (colVis[c]) visCols.push(c);
      const visRows = []; for (let r = r0; r <= r1; r++) if (rowVis[r]) visRows.push(r);
      if (!visCols.length || !visRows.length) continue;
      const totalW = visCols.reduce((s, c) => s + colW[c], 0);
      // ---- page geometry
      const ps = sInfo.pageSetup; let [pw, ph] = PAPER[ps.paper] || PAPER[9];
      const mg = sInfo.margins; const ml = mg.l * 72, mr = mg.r * 72, mt = mg.t * 72, mb = mg.b * 72;
      let landscape = ps.orient === 'landscape'; if (!ps.orient && totalW > (pw - ml - mr) * 1.1) landscape = true;
      if (landscape && pw < ph) [pw, ph] = [ph, pw];
      const areaW = pw - ml - mr, areaH = ph - mt - mb;
      let scale = (!sInfo.fitPage && ps.scale) ? ps.scale / 100 : 1;
      if (totalW * scale > areaW) scale = Math.max(0.5, Math.min(scale, areaW / totalW));
      // column groups (only when even the shrunk sheet is too wide)
      const colGroups = []; { let g = [], w = 0; for (const c of visCols) { if (g.length && (w + colW[c]) * scale > areaW + 0.01) { colGroups.push(g); g = []; w = 0; } g.push(c); w += colW[c]; } if (g.length) colGroups.push(g); }
      const rowGroups = []; { let g = [], h = 0; for (const r of visRows) { if (g.length && (h + rowH[r]) * scale > areaH + 0.01) { rowGroups.push(g); g = []; h = 0; } g.push(r); h += rowH[r]; } if (g.length) rowGroups.push(g); }
      // images from drawings
      const images = []; let cs = {}, rs = {};
      if (zip && sInfo.drawing && sInfo.relsMap[sInfo.drawing]) {
        try {
          const dpath = sInfo.relsMap[sInfo.drawing].target; const df = zip.file(dpath);
          if (df) {
            const dd = parseXml(await df.async('text')); const drels = await relsOf(zip, dpath);
            const colStart = cs; { let x = 0; for (let c = c0; c <= c1 + 40; c++) { colStart[c] = x; x += c <= c1 ? (colVis[c] ? colW[c] : 0) : 64 * 0.75; } }
            const rowStart = rs; { let y = 0; for (let r = r0; r <= r1 + 60; r++) { rowStart[r] = y; y += r <= r1 ? (rowVis[r] ? rowH[r] : 0) : sInfo.defRow; } }
            for (const an of kids(dd.documentElement)) {
              const pic = [...an.getElementsByTagName('*')].find(e => e.localName === 'pic'); const gf = [...an.getElementsByTagName('*')].find(e => e.localName === 'chart');
              const from = first(an, 'from'), to = first(an, 'to'), ext = first(an, 'ext');
              const pos = (el, def) => el ? { c: num(first(el, 'col')?.textContent), co: num(first(el, 'colOff')?.textContent) / EMU, r: num(first(el, 'row')?.textContent), ro: num(first(el, 'rowOff')?.textContent) / EMU } : def;
              const f = pos(from, { c: 0, co: 0, r: 0, ro: 0 });
              const x = (colStart[f.c] ?? 0) + f.co - colStart[c0], y = (rowStart[f.r] ?? 0) + f.ro - rowStart[r0];
              let w, h;
              if (to) { const t = pos(to); w = (colStart[t.c] ?? 0) + t.co - (colStart[f.c] ?? 0) - f.co; h = (rowStart[t.r] ?? 0) + t.ro - (rowStart[f.r] ?? 0) - f.ro; }
              else if (ext) { w = num(attr(ext, 'cx')) / EMU; h = num(attr(ext, 'cy')) / EMU; } else continue;
              if (pic) {
                const blip = [...pic.getElementsByTagName('*')].find(e => e.localName === 'blip'); const rid = attr(blip, 'embed'); const rel = drels[rid];
                if (rel && zip.file(rel.target)) { const img = await embedImage(pdf, await zip.file(rel.target).async('uint8array'), rel.target, imgCache); if (img) images.push({ img, x, y, w, h, r: f.r, c: f.c }); else warn.add('Some pictures (EMF/WMF) could not be embedded.'); }
              } else if (gf) images.push({ chart: true, x, y, w, h, r: f.r, c: f.c });
            }
          }
        } catch (e) { warn.add('Some pictures or charts could not be read.'); }
      }
      // ---- draw
      const hasBorders = Object.values(S.borders).some(b => b && Object.keys(b).length);
      for (const cg of colGroups) {
        const gx = {}; { let x = 0; for (const c of cg) { gx[c] = x; x += colW[c] * scale; } gx.total = x; }
        for (const rg of rowGroups) {
          const page = pdf.addPage([pw, ph]); const gy = {}; { let y = 0; for (const r of rg) { gy[r] = y; y += rowH[r] * scale; } gy.total = y; }
          const ox = ml + (sInfo.hCenter ? Math.max(0, (areaW - gx.total) / 2) : 0), oy = ph - mt;
          const X = c => ox + gx[c], Y = r => oy - gy[r];
          pagesMeta.push({ page, sheet: name, info: sInfo, pw, ph, ml, mr, mt, mb });
          // fills
          for (const r of rg) for (const c of cg) {
            const k = r + ',' + c; if (covered.has(k) && !sInfo.s[XLSX.utils.encode_cell({ r, c })]) continue;
            const st = styleOf(r, c); let fill = st.fill; const m = mergeAt[k];
            if (!fill) continue;
            let w = colW[c] * scale, h = rowH[r] * scale;
            if (m) { w = 0; for (let cc = m.s.c; cc <= m.e.c; cc++) if (gx[cc] != null) w += colW[cc] * scale; h = 0; for (let rr = m.s.r; rr <= m.e.r; rr++) if (gy[rr] != null) h += rowH[rr] * scale; }
            else if (covered.has(k)) continue;
            page.drawRectangle({ x: X(c), y: Y(r) - h, width: w, height: h, color: rgbOf(fill) });
          }
          // gridlines
          if (sInfo.grid || sInfo.printGrid) {
            const gc = sInfo.printGrid ? rgb(0.45, 0.45, 0.45) : rgb(0.86, 0.86, 0.86), gw = sInfo.printGrid ? 0.4 : 0.25;
            for (const c of cg) { const x = X(c); page.drawLine({ start: { x, y: oy }, end: { x, y: oy - gy.total }, thickness: gw, color: gc }); }
            page.drawLine({ start: { x: ox + gx.total, y: oy }, end: { x: ox + gx.total, y: oy - gy.total }, thickness: gw, color: gc });
            for (const r of rg) { const y = Y(r); page.drawLine({ start: { x: ox, y }, end: { x: ox + gx.total, y }, thickness: gw, color: gc }); }
            page.drawLine({ start: { x: ox, y: oy - gy.total }, end: { x: ox + gx.total, y: oy - gy.total }, thickness: gw, color: gc });
          }
          // text
          for (const r of rg) for (const c of cg) {
            const k = r + ',' + c; if (covered.has(k)) continue;
            const cell = getCell(r, c); let txt = textOf(cell); if (!txt) continue; cellCount++;
            const st = styleOf(r, c), m = mergeAt[k];
            let w = colW[c] * scale, h = rowH[r] * scale;
            if (m) { w = 0; for (let cc = m.s.c; cc <= m.e.c; cc++) if (gx[cc] != null) w += colW[cc] * scale; h = 0; for (let rr = m.s.r; rr <= m.e.r; rr++) if (gy[rr] != null) h += rowH[rr] * scale; }
            const fnt = st.font; const font = fonts.get(fnt.name, fnt.b, fnt.i); let size = fnt.sz * scale * sizeFactor(fnt.name);
            const isNum = cell.t === 'n' || cell.t === 'd'; const isBool = cell.t === 'b' || cell.t === 'e';
            let hAl = st.xf.h; if (!hAl || hAl === 'general') hAl = isNum ? 'right' : isBool ? 'center' : 'left';
            const pad = 2 * scale, ind = (st.xf.indent || 0) * 7 * scale;
            const col = fnt.color || [0, 0, 0];
            if (isNum && font.widthOfTextAtSize(txt, size) > w - pad * 2) size = Math.max(size * 0.55, size * (w - pad * 2) / font.widthOfTextAtSize(txt, size));
            let lines, wrap = st.xf.wrap || (m && /\n/.test(txt));
            if (st.xf.shrink && !wrap) { const tw = font.widthOfTextAtSize(txt, size); if (tw > w - pad * 2) size = Math.max(size * 0.5, size * (w - pad * 2) / tw); }
            lines = wrap ? wrapLines(txt, font, size, Math.max(8, w - pad * 2 - ind)) : [txt.replace(/\r?\n/g, ' ')];
            const lh = size * 1.22; const blockH = lines.length * lh;
            let vAl = st.xf.v || 'bottom';
            let topY = Y(r) - (vAl === 'top' ? 1 * scale : vAl === 'center' ? (h - blockH) / 2 : h - blockH - 1 * scale);
            // clip rectangle (text overflows into empty neighbours for single-line left/right aligned text)
            let clipL = X(c), clipR = X(c) + w;
            if (!wrap && !isNum) {
              if (hAl === 'left') { let cc = cg.indexOf(c) + (m ? m.e.c - m.s.c + 1 : 1); while (cc < cg.length) { const nc = cg[cc]; if (textOf(getCell(r, nc)) || covered.has(r + ',' + nc) || mergeAt[r + ',' + nc]) break; clipR += colW[nc] * scale; cc++; } }
              else if (hAl === 'right') { let cc = cg.indexOf(c) - 1; while (cc >= 0) { const nc = cg[cc]; if (textOf(getCell(r, nc)) || covered.has(r + ',' + nc) || mergeAt[r + ',' + nc]) break; clipL -= colW[nc] * scale; cc--; } }
            }
            page.pushOperators(PDFLib.pushGraphicsState(), PDFLib.moveTo(clipL, Y(r) - h), PDFLib.lineTo(clipR, Y(r) - h), PDFLib.lineTo(clipR, Y(r)), PDFLib.lineTo(clipL, Y(r)), PDFLib.closePath(), PDFLib.clip(), PDFLib.endPath());
            lines.forEach((ln, i) => {
              if (!ln) return; const tw = font.widthOfTextAtSize(ln, size);
              let x = hAl === 'right' ? X(c) + w - pad - tw - ind * 0 : hAl === 'center' || hAl === 'centerContinuous' ? X(c) + (w - tw) / 2 : X(c) + pad + ind;
              if (hAl === 'right' && ind) x -= ind;
              const by = topY - i * lh - size * 0.92;
              font.draw(page, ln, { x, y: by, size, color: rgbOf(col) });
              if (fnt.u) page.drawLine({ start: { x, y: by - size * 0.12 }, end: { x: x + tw, y: by - size * 0.12 }, thickness: Math.max(0.35, size / 22), color: rgbOf(col) });
              if (fnt.strike) page.drawLine({ start: { x, y: by + size * 0.3 }, end: { x: x + tw, y: by + size * 0.3 }, thickness: Math.max(0.35, size / 22), color: rgbOf(col) });
            });
            page.pushOperators(PDFLib.popGraphicsState());
          }
          // borders
          if (hasBorders) for (const r of rg) for (const c of cg) {
            const st = styleOf(r, c); if (!Object.keys(st.bdr).length) continue;
            const m = mergeAt[r + ',' + c]; const cover = covered.has(r + ',' + c);
            let w = colW[c] * scale, h = rowH[r] * scale; let cx = X(c), cy = Y(r);
            const edge = (b, xa, ya, xb, yb) => { if (b) page.drawLine({ start: { x: xa, y: ya }, end: { x: xb, y: yb }, thickness: Math.max(0.25, (BORDER_W[b.style] || 0.5) * Math.max(0.7, scale)), color: rgbOf(b.color) }); };
            if (cover) { // draw only edges on the outer boundary of the merge
              const mm = merges.find(x => r >= x.s.r && r <= x.e.r && c >= x.s.c && c <= x.e.c); if (!mm) continue;
              if (r === mm.s.r) edge(st.bdr.top, cx, cy, cx + w, cy); if (r === mm.e.r) edge(st.bdr.bottom, cx, cy - h, cx + w, cy - h);
              if (c === mm.s.c) edge(st.bdr.left, cx, cy, cx, cy - h); if (c === mm.e.c) edge(st.bdr.right, cx + w, cy, cx + w, cy - h); continue;
            }
            if (m) { w = 0; for (let cc = m.s.c; cc <= m.e.c; cc++) if (gx[cc] != null) w += colW[cc] * scale; h = 0; for (let rr = m.s.r; rr <= m.e.r; rr++) if (gy[rr] != null) h += rowH[rr] * scale; }
            edge(st.bdr.top, cx, cy, cx + w, cy); edge(st.bdr.bottom, cx, cy - h, cx + w, cy - h); edge(st.bdr.left, cx, cy, cx, cy - h); edge(st.bdr.right, cx + w, cy, cx + w, cy - h);
          }
          // pictures / charts anchored in this block
          for (const im of images) {
            const inG = (list, v, all) => list.includes(v) || (v < all[0] && list[0] === all[0]) || (v > all[all.length - 1] && list[list.length - 1] === all[all.length - 1]);
            if (!inG(cg, im.c, visCols) || !inG(rg, im.r, visRows)) continue;
            const x = ox + (im.x - (cs[cg[0]] ?? 0)) * scale, y = oy - (im.y - (rs[rg[0]] ?? 0)) * scale;
            if (im.chart) { page.drawRectangle({ x, y: y - im.h * scale, width: im.w * scale, height: im.h * scale, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.6, color: rgb(0.97, 0.97, 0.97) }); fonts.get('Helvetica', false, true).draw(page, 'Chart (not rendered)', { x: x + 6, y: y - 14, size: 8, color: rgb(0.45, 0.45, 0.45) }); warn.add('Charts are shown as placeholders.'); }
            else page.drawImage(im.img, { x, y: y - im.h * scale, width: im.w * scale, height: im.h * scale });
          }
        }
      }
      sheetCount++;
    }
    if (!pagesMeta.length) throw new Error('No visible sheets with data were found in this workbook.');
    // headers & footers
    const total = pagesMeta.length; let idx = 0; const hfFont = fonts.get('Helvetica', false, false);
    const perSheet = {};
    for (const pm of pagesMeta) { idx++; perSheet[pm.sheet] = (perSheet[pm.sheet] || 0) + 1; const vars = { page: perSheet[pm.sheet], total, date: dstr, time: tstr, file: fileName.replace(/\.[^.]+$/, ''), sheet: pm.sheet };
      for (const [spec, y] of [[pm.info.header, (pm.ph || 842) - (pm.info.margins.h * 72) - 8], [pm.info.footer, pm.info.margins.f * 72]]) {
        if (!spec) continue; const parts = hfText(spec, vars);
        for (const [k, t] of Object.entries(parts)) { if (!t.trim()) continue; const tw = hfFont.widthOfTextAtSize(t, 9); const x = k === 'L' ? pm.ml : k === 'R' ? pm.pw - pm.mr - tw : (pm.pw - tw) / 2; hfFont.draw(pm.page, t, { x, y, size: 9, color: rgb(0.2, 0.2, 0.2) }); }
      } }
    pdf.setProducer('FRZ PDF Express'); pdf.setCreator('FRZ PDF Express');
    return { bytes: await pdf.save(), pages: total, sheets: sheetCount, cells: cellCount, warnings: [...warn] };
  }
  window.FRZOffice.xlsx = xlsxToPdfBytes;
  /* =====================================================================
     POWERPOINT (.pptx)
     ===================================================================== */
  const SCHEME_NAMES = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  const PRST_CLR = { black: '000000', white: 'FFFFFF', red: 'FF0000', green: '008000', blue: '0000FF', yellow: 'FFFF00', gray: '808080', grey: '808080', orange: 'FFA500', purple: '800080', cyan: '00FFFF', magenta: 'FF00FF', darkBlue: '00008B', darkRed: '8B0000', darkGreen: '006400', lightGray: 'D3D3D3', silver: 'C0C0C0' };
  function parseThemeP(text) {
    const T = { colors: {}, major: 'Calibri Light', minor: 'Calibri' };
    if (!text) return T;
    const cs = /<a:clrScheme[\s\S]*?<\/a:clrScheme>/.exec(text)?.[0] || '';
    for (const n of SCHEME_NAMES) { const m = new RegExp('<a:' + n + '>([\\s\\S]*?)</a:' + n + '>').exec(cs); if (m) { const a = /srgbClr val="([0-9A-Fa-f]{6})"/.exec(m[1]) || /lastClr="([0-9A-Fa-f]{6})"/.exec(m[1]); if (a) T.colors[n] = a[1]; } }
    const mj = /<a:majorFont>\s*<a:latin typeface="([^"]*)"/.exec(text), mn = /<a:minorFont>\s*<a:latin typeface="([^"]*)"/.exec(text);
    if (mj) T.major = mj[1]; if (mn) T.minor = mn[1];
    return T;
  }
  function resolveClr(el, T, clrMap) {
    if (!el) return null;
    let c = null; const ln = el.localName;
    if (ln === 'srgbClr') c = hexColor(attr(el, 'val'), [0, 0, 0]);
    else if (ln === 'sysClr') c = hexColor(attr(el, 'lastClr') || '000000', [0, 0, 0]);
    else if (ln === 'prstClr') c = hexColor(PRST_CLR[attr(el, 'val')] || '000000', [0, 0, 0]);
    else if (ln === 'schemeClr') {
      let v = attr(el, 'val'); if (v === 'phClr') c = T.phClr || [0, 0, 0]; else { if (clrMap && clrMap[v]) v = clrMap[v]; if (v === 'tx1') v = 'dk1'; else if (v === 'bg1') v = 'lt1'; else if (v === 'tx2') v = 'dk2'; else if (v === 'bg2') v = 'lt2'; c = hexColor(T.colors[v] || (v === 'lt1' ? 'FFFFFF' : '000000'), [0, 0, 0]); }
    } else if (ln === 'scrgbClr') c = [num(attr(el, 'r')) / 1e5, num(attr(el, 'g')) / 1e5, num(attr(el, 'b')) / 1e5];
    else if (ln === 'hslClr') c = hslToRgb([num(attr(el, 'hue')) / 21600000, num(attr(el, 'sat')) / 1e5, num(attr(el, 'lum')) / 1e5]);
    else return null;
    let a = 1;
    for (const m of kids(el)) {
      const v = num(attr(m, 'val')) / 1e5;
      switch (m.localName) {
        case 'lumMod': { const h = rgbToHsl(c); h[2] = clamp(h[2] * v, 0, 1); c = hslToRgb(h); break; }
        case 'lumOff': { const h = rgbToHsl(c); h[2] = clamp(h[2] + v, 0, 1); c = hslToRgb(h); break; }
        case 'satMod': { const h = rgbToHsl(c); h[1] = clamp(h[1] * v, 0, 1); c = hslToRgb(h); break; }
        case 'tint': c = c.map(x => x * v + (1 - v)); break;
        case 'shade': c = c.map(x => x * v); break;
        case 'alpha': a = v; break;
      }
    }
    return { c, a };
  }
  const firstColorChild = el => kids(el).find(k => /Clr$/.test(k.localName));
  function readFill(spPr, T, clrMap) {
    if (!spPr) return null;
    for (const k of kids(spPr)) {
      if (k.localName === 'noFill') return { type: 'none' };
      if (k.localName === 'solidFill') { const r = resolveClr(firstColorChild(k), T, clrMap); return r ? { type: 'solid', ...r } : null; }
      if (k.localName === 'gradFill') {
        const stops = kids(first(k, 'gsLst'), 'gs').map(g => ({ pos: num(attr(g, 'pos')) / 1e5, ...(resolveClr(firstColorChild(g), T, clrMap) || { c: [0.5, 0.5, 0.5], a: 1 }) }));
        const lin = first(k, 'lin'); return { type: 'grad', stops, angle: lin ? num(attr(lin, 'ang')) / 60000 : 90 };
      }
      if (k.localName === 'blipFill') return { type: 'blip', rid: attr(first(k, 'blip'), 'embed'), crop: first(k, 'srcRect') ? { l: num(attr(first(k, 'srcRect'), 'l')) / 1e5, t: num(attr(first(k, 'srcRect'), 't')) / 1e5, r: num(attr(first(k, 'srcRect'), 'r')) / 1e5, b: num(attr(first(k, 'srcRect'), 'b')) / 1e5 } : null };
      if (k.localName === 'pattFill') { const r = resolveClr(firstColorChild(first(k, 'fgClr')), T, clrMap); return r ? { type: 'solid', ...r } : null; }
    }
    return null;
  }
  function readLine(spPr, T, clrMap) {
    const ln = first(spPr, 'ln'); if (!ln) return null;
    const o = { w: attr(ln, 'w') != null ? num(attr(ln, 'w')) / EMU : null };
    const f = readFill(ln, T, clrMap); if (f) o.fill = f;
    const d = first(ln, 'prstDash'); if (d) o.dash = attr(d, 'val');
    return o;
  }
  function styleRef(sp, kind, T, clrMap) { // p:style / a:fillRef | a:lnRef
    const st = first(sp, 'style'); if (!st) return null; const ref = first(st, kind); if (!ref) return null;
    const idx = num(attr(ref, 'idx')); const clr = firstColorChild(ref); const r = clr ? resolveClr(clr, T, clrMap) : null;
    return { idx, color: r };
  }
  const lineRule = {};
  const presetPath = (prst, w, h, av) => {
    const f = (a, d) => (av && av[a] != null ? av[a] : d) / 100000;
    const m = Math.min(w, h);
    switch (prst) {
      case 'ellipse': case 'donut': case 'flowChartConnector': case 'cloud': return `M0,${h / 2} A${w / 2},${h / 2} 0 1,0 ${w},${h / 2} A${w / 2},${h / 2} 0 1,0 0,${h / 2} Z`;
      case 'roundRect': case 'flowChartTerminator': case 'round2SameRect': { const r = prst === 'flowChartTerminator' ? m / 2 : m * f('adj', 16667); return `M${r},0 L${w - r},0 A${r},${r} 0 0,1 ${w},${r} L${w},${h - r} A${r},${r} 0 0,1 ${w - r},${h} L${r},${h} A${r},${r} 0 0,1 0,${h - r} L0,${r} A${r},${r} 0 0,1 ${r},0 Z`; }
      case 'triangle': case 'flowChartMerge': return `M${w * f('adj', 50000)},0 L${w},${h} L0,${h} Z`;
      case 'rtTriangle': return `M0,0 L0,${h} L${w},${h} Z`;
      case 'diamond': case 'flowChartDecision': return `M${w / 2},0 L${w},${h / 2} L${w / 2},${h} L0,${h / 2} Z`;
      case 'parallelogram': { const o = m * f('adj', 25000); return `M${o},0 L${w},0 L${w - o},${h} L0,${h} Z`; }
      case 'trapezoid': { const o = m * f('adj', 25000); return `M${o},0 L${w - o},0 L${w},${h} L0,${h} Z`; }
      case 'hexagon': { const o = m * f('adj', 25000); return `M${o},0 L${w - o},0 L${w},${h / 2} L${w - o},${h} L${o},${h} L0,${h / 2} Z`; }
      case 'pentagon': case 'homePlate': { const o = m * f('adj', 50000); return `M0,0 L${w - o},0 L${w},${h / 2} L${w - o},${h} L0,${h} Z`; }
      case 'chevron': { const o = m * f('adj', 50000); return `M0,0 L${w - o},0 L${w},${h / 2} L${w - o},${h} L0,${h} L${o},${h / 2} Z`; }
      case 'rightArrow': { const hh = h * f('adj1', 50000) / 2, hd = Math.min(w, h) * f('adj2', 50000); return `M0,${h / 2 - hh} L${w - hd},${h / 2 - hh} L${w - hd},0 L${w},${h / 2} L${w - hd},${h} L${w - hd},${h / 2 + hh} L0,${h / 2 + hh} Z`; }
      case 'leftArrow': { const hh = h * f('adj1', 50000) / 2, hd = Math.min(w, h) * f('adj2', 50000); return `M${w},${h / 2 - hh} L${hd},${h / 2 - hh} L${hd},0 L0,${h / 2} L${hd},${h} L${hd},${h / 2 + hh} L${w},${h / 2 + hh} Z`; }
      case 'upArrow': { const ww = w * f('adj1', 50000) / 2, hd = Math.min(w, h) * f('adj2', 50000); return `M${w / 2 - ww},${h} L${w / 2 - ww},${hd} L0,${hd} L${w / 2},0 L${w},${hd} L${w / 2 + ww},${hd} L${w / 2 + ww},${h} Z`; }
      case 'downArrow': { const ww = w * f('adj1', 50000) / 2, hd = Math.min(w, h) * f('adj2', 50000); return `M${w / 2 - ww},0 L${w / 2 - ww},${h - hd} L0,${h - hd} L${w / 2},${h} L${w},${h - hd} L${w / 2 + ww},${h - hd} L${w / 2 + ww},0 Z`; }
      case 'plus': case 'mathPlus': { const o = m * f('adj', 25000); return `M${o},0 L${w - o},0 L${w - o},${o} L${w},${o} L${w},${h - o} L${w - o},${h - o} L${w - o},${h} L${o},${h} L${o},${h - o} L0,${h - o} L0,${o} L${o},${o} Z`; }
      case 'star5': { const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2, r = R * 0.382; let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + rad * Math.cos(a) * (w / Math.min(w, h))) + ',' + (cy + rad * Math.sin(a) * (h / Math.min(w, h))) + ' '; } return d + 'Z'; }
      default: return `M0,0 L${w},0 L${w},${h} L0,${h} Z`;
    }
  };
  function custPath(geom, w, h) {
    let out = '';
    for (const p of kids(first(geom, 'pathLst'), 'path')) {
      const pw = num(attr(p, 'w'), w) || w, ph = num(attr(p, 'h'), h) || h; const X = v => v * w / pw, Y = v => v * h / ph;
      const pt = e => { const q = first(e, 'pt'); return [X(num(attr(q, 'x'))), Y(num(attr(q, 'y')))]; };
      let last = [0, 0];
      for (const c of kids(p)) {
        if (c.localName === 'moveTo') { const [x, y] = pt(c); out += `M${x},${y} `; last = [x, y]; }
        else if (c.localName === 'lnTo') { const [x, y] = pt(c); out += `L${x},${y} `; last = [x, y]; }
        else if (c.localName === 'cubicBezTo') { const ps = kids(c, 'pt').map(q => [X(num(attr(q, 'x'))), Y(num(attr(q, 'y')))]); if (ps.length === 3) { out += `C${ps[0]} ${ps[1]} ${ps[2]} `; last = ps[2]; } }
        else if (c.localName === 'quadBezTo') { const ps = kids(c, 'pt').map(q => [X(num(attr(q, 'x'))), Y(num(attr(q, 'y')))]); if (ps.length === 2) { out += `Q${ps[0]} ${ps[1]} `; last = ps[1]; } }
        else if (c.localName === 'arcTo') { /* approximated by staying put */ }
        else if (c.localName === 'close') out += 'Z ';
      }
    }
    return out;
  }
  const BUCH = { '': '•', '': '▪', '': '>', '': '✓', '': '•', 'Ø': '>', '§': '▪', '•': '•', '–': '–', 'o': '–' };

  async function pptxToPdfBytes(buffer, ctx) {
    const { loadUniFonts, status = () => {} } = ctx;
    const zip = await JSZip.loadAsync(buffer);
    const presF = zip.file('ppt/presentation.xml');
    if (!presF) throw new Error('This is not a readable .pptx file. Legacy .ppt files are not supported.');
    const pres = parseXml(await presF.async('text')).documentElement; const presRels = await relsOf(zip, 'ppt/presentation.xml');
    const sz = first(pres, 'sldSz'); const SW = num(attr(sz, 'cx'), 9144000) / EMU, SH = num(attr(sz, 'cy'), 6858000) / EMU;
    const slideRefs = kids(first(pres, 'sldIdLst'), 'sldId').map(s => { let rid = null; for (const at of s.attributes) if (at.localName === 'id' && at.prefix) rid = at.value; return presRels[rid]?.target; }).filter(Boolean);
    if (!slideRefs.length) throw new Error('No slides were found in this PowerPoint file.');
    const pdf = await PDFLib.PDFDocument.create(); const fonts = await makeFonts(pdf, loadUniFonts); const imgCache = new Map(); const warn = new Set();
    const defaultTextStyle = first(pres, 'defaultTextStyle');
    const tsF = zip.file('ppt/tableStyles.xml'); const tableStyles = {};
    if (tsF) { const td = parseXml(await tsF.async('text')).documentElement; for (const s of kids(td, 'tblStyle')) tableStyles[attr(s, 'styleId')] = s; }
    const cacheM = {}, cacheL = {};
    const loadPart = async (path, cache) => { if (cache[path]) return cache[path]; const f = zip.file(path); if (!f) return null; const o = { path, root: parseXml(await f.async('text')).documentElement, rels: await relsOf(zip, path) }; cache[path] = o; return o; };
    const loadMaster = async path => { const m = await loadPart(path, cacheM); if (!m || m.T) return m; const th = Object.values(m.rels).find(r => /theme$/.test(r.type || '')); m.T = parseThemeP(th && zip.file(th.target) ? await zip.file(th.target).async('text') : ''); const cm = first(m.root, 'clrMap'); m.clrMap = {}; if (cm) for (const a of cm.attributes) m.clrMap[a.localName] = a.value; m.txStyles = first(m.root, 'txStyles'); return m; };
    const BLACK = [0, 0, 0];
    const fontName = (typeface, T) => !typeface ? T.minor : typeface === '+mj-lt' ? T.major : typeface === '+mn-lt' ? T.minor : typeface.startsWith('+') ? T.minor : typeface;

    /* ---- text style chain ---- */
    const parseR = (el, T, clrMap) => { const o = {}; if (!el) return o; if (attr(el, 'sz')) o.sz = num(attr(el, 'sz')) / 100; if (attr(el, 'b') != null) o.b = attr(el, 'b') === '1'; if (attr(el, 'i') != null) o.i = attr(el, 'i') === '1'; if (attr(el, 'u')) o.u = attr(el, 'u') !== 'none'; if (attr(el, 'strike')) o.strike = attr(el, 'strike') !== 'noStrike'; if (attr(el, 'baseline')) o.base = num(attr(el, 'baseline')); if (attr(el, 'cap') === 'all') o.caps = true; const sf = first(el, 'solidFill'); if (sf) { const r = resolveClr(firstColorChild(sf), T, clrMap); if (r) o.color = r.c; } const lat = first(el, 'latin'); if (lat && attr(lat, 'typeface')) o.font = fontName(attr(lat, 'typeface'), T); return o; };
    const lvlOf = (styleEl, lvl, T, clrMap) => {
      const e = first(styleEl, `lvl${lvl + 1}pPr`); const o = {}; if (!e) return o;
      for (const k of ['marL', 'indent']) if (attr(e, k) != null) o[k] = num(attr(e, k)) / EMU; if (attr(e, 'algn')) o.algn = attr(e, 'algn');
      for (const c of kids(e)) {
        if (c.localName === 'lnSpc') { const p = first(c, 'spcPct'), q = first(c, 'spcPts'); o.lnSpc = p ? { pct: num(attr(p, 'val')) / 1e5 } : q ? { pts: num(attr(q, 'val')) / 100 } : undefined; }
        else if (c.localName === 'spcBef' || c.localName === 'spcAft') { const p = first(c, 'spcPct'), q = first(c, 'spcPts'); o[c.localName] = p ? { pct: num(attr(p, 'val')) / 1e5 } : q ? { pts: num(attr(q, 'val')) / 100 } : undefined; }
        else if (c.localName === 'buNone') o.bu = { none: true };
        else if (c.localName === 'buChar') o.bu = { ch: attr(c, 'char') }; else if (c.localName === 'buAutoNum') o.bu = { auto: attr(c, 'type') || 'arabicPeriod', start: num(attr(c, 'startAt'), 1) };
        else if (c.localName === 'buClr') { const r = resolveClr(firstColorChild(c), T, clrMap); if (r) o.buClr = r.c; } else if (c.localName === 'buSzPct') o.buSz = num(attr(c, 'val')) / 1e5;
        else if (c.localName === 'defRPr') o.r = parseR(c, T, clrMap);
      }
      return o;
    };
    const mergeLvl = (a, b) => { const o = { ...a }; for (const k in b) { if (b[k] === undefined) continue; if (k === 'r') o.r = { ...(a.r || {}), ...b.r }; else o[k] = b[k]; } return o; };
    const autoLabel = (type, n) => { const t = type || 'arabicPeriod'; if (/alphaLc/.test(t)) return fmtNum(n, 'lowerLetter') + (/ParenR/.test(t) ? ')' : '.'); if (/alphaUc/.test(t)) return fmtNum(n, 'upperLetter') + (/ParenR/.test(t) ? ')' : '.'); if (/romanLc/.test(t)) return fmtNum(n, 'lowerRoman') + '.'; if (/romanUc/.test(t)) return fmtNum(n, 'upperRoman') + '.'; return n + (/ParenR/.test(t) ? ')' : /ParenBoth/.test(t) ? ')' : '.'); };

    /* ---- text body layout ---- */
    function layoutText(txBody, width, env, scale, vars) {
      // env: { T, clrMap, chain:[styleElements...] }
      const paras = kids(txBody, 'p'); const out = []; const counters = {};
      for (const p of paras) {
        const pPr = first(p, 'pPr'); const lvl = clamp(num(attr(pPr, 'lvl'), 0), 0, 8);
        let L = {};
        for (const st of env.chain) if (st) L = mergeLvl(L, lvlOf(st, lvl, env.T, env.clrMap));
        const own = pPr ? mergeLvl({}, (() => { const o = {}; for (const k of ['marL', 'indent']) if (attr(pPr, k) != null) o[k] = num(attr(pPr, k)) / EMU; if (attr(pPr, 'algn')) o.algn = attr(pPr, 'algn'); for (const c of kids(pPr)) { if (c.localName === 'lnSpc') { const q = first(c, 'spcPct'), r = first(c, 'spcPts'); o.lnSpc = q ? { pct: num(attr(q, 'val')) / 1e5 } : r ? { pts: num(attr(r, 'val')) / 100 } : undefined; } else if (c.localName === 'spcBef' || c.localName === 'spcAft') { const q = first(c, 'spcPct'), r = first(c, 'spcPts'); o[c.localName] = q ? { pct: num(attr(q, 'val')) / 1e5 } : r ? { pts: num(attr(r, 'val')) / 100 } : undefined; } else if (c.localName === 'buNone') o.bu = { none: true }; else if (c.localName === 'buChar') o.bu = { ch: attr(c, 'char') }; else if (c.localName === 'buAutoNum') o.bu = { auto: attr(c, 'type') || 'arabicPeriod', start: num(attr(c, 'startAt'), 1) }; else if (c.localName === 'buClr') { const r = resolveClr(firstColorChild(c), env.T, env.clrMap); if (r) o.buClr = r.c; } else if (c.localName === 'buSzPct') o.buSz = num(attr(c, 'val')) / 1e5; else if (c.localName === 'defRPr') o.r = parseR(c, env.T, env.clrMap); } return o; })()) : {};
        L = mergeLvl(L, own);
        const baseR = { sz: 18, ...(L.r || {}) };
        const runs = [];
        const addRun = (text, rEl, extra) => { if (!text && !extra) return; const rp = { ...baseR, ...parseR(rEl, env.T, env.clrMap) }; runs.push({ text: clean(text), rp, br: !!extra?.br }); };
        for (const c of kids(p)) {
          if (c.localName === 'r') addRun(first(c, 't')?.textContent || '', first(c, 'rPr'));
          else if (c.localName === 'br') addRun('', first(c, 'rPr'), { br: true });
          else if (c.localName === 'fld') { const ty = attr(c, 'type') || ''; const txt = /slidenum/i.test(ty) ? String(vars.n) : (first(c, 't')?.textContent || ''); addRun(txt, first(c, 'rPr')); }
        }
        const endR = { ...baseR, ...parseR(first(p, 'endParaRPr'), env.T, env.clrMap) };
        // bullet
        let bu = null;
        if (L.bu && !L.bu.none && runs.some(r => r.text)) {
          if (L.bu.auto) { const key = lvl; counters[key] = (counters[key] == null ? L.bu.start : counters[key] + 1); for (const k of Object.keys(counters)) if (+k > lvl) delete counters[k]; bu = { text: autoLabel(L.bu.auto, counters[key]) }; }
          else { const ch = L.bu.ch; bu = { text: BUCH[ch] || (ch && /^[ -~•–●○▪■✓]$/.test(ch) ? ch : '•') }; if (bu.text === 'o') bu.text = '–'; }
        } else if (!L.bu || L.bu.none) { /* no bullet; reset autonum at this level */ for (const k of Object.keys(counters)) if (+k >= lvl) delete counters[k]; }
        const marL = (L.marL || 0) / 1; let ind = L.indent || 0; const bx = marL + ind; if (bu) ind = 0;
        const avail = Math.max(10, width - marL - 0);
        const toks = [];
        for (const r of runs) {
          const size = (r.rp.sz || 18) * scale * (r.rp.base ? 0.66 : 1);
          const font = fonts.get(r.rp.font, !!r.rp.b, !!r.rp.i);
          if (r.br) { toks.push({ k: 'br', size, font, rp: r.rp }); continue; }
          const txt = r.rp.caps ? r.text.toUpperCase() : r.text;
          for (const part of txt.split(/(\s+)/)) { if (!part) continue; const sp = /^\s+$/.test(part); const t = sp ? ' ' : part; toks.push({ k: sp ? 'space' : 'word', t, size, font, rp: r.rp, w: font.widthOfTextAtSize(t, size) }); }
        }
        const lines = []; let line = { items: [], w: 0, size: 0 }; let firstLine = true;
        const startX = () => marL + (firstLine ? Math.min(0, ind) * 0 + ind : 0);
        const push = () => { while (line.items.length && line.items[line.items.length - 1].k === 'space') line.w -= line.items.pop().w; lines.push(line); firstLine = false; line = { items: [], w: 0, size: 0 }; };
        const limit = () => width - (firstLine ? Math.max(0, marL + ind) : marL);
        const lim = () => firstLine ? width - Math.max(0, marL + ind) : width - marL;
        for (const t of toks) {
          if (t.k === 'br') { line.size = Math.max(line.size, t.size); line.endsBr = true; push(); continue; }
          if (t.k === 'space') { if (line.items.length) { line.items.push(t); line.w += t.w; } continue; }
          if (line.w + t.w > lim() + 0.01 && line.items.some(i => i.k === 'word')) push();
          if (t.w > lim() + 0.01) {
            const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(t.t)].map(s => s.segment) : [...t.t]; let chunk = '';
            for (const g of seg) { if (chunk && line.w + t.font.widthOfTextAtSize(chunk + g, t.size) > lim()) { const w2 = t.font.widthOfTextAtSize(chunk, t.size); line.items.push({ ...t, t: chunk, w: w2 }); line.w += w2; line.size = Math.max(line.size, t.size); push(); chunk = g; } else chunk += g; }
            if (chunk) { const w2 = t.font.widthOfTextAtSize(chunk, t.size); line.items.push({ ...t, t: chunk, w: w2 }); line.w += w2; line.size = Math.max(line.size, t.size); }
            continue;
          }
          line.items.push(t); line.w += t.w; line.size = Math.max(line.size, t.size);
        }
        if (line.items.length || !lines.length || line.endsBr) { line.size = line.size || endR.sz * scale; push(); }
        if (!lines.length) lines.push({ items: [], w: 0, size: endR.sz * scale });
        const lsz = lines.reduce((m, l) => Math.max(m, l.size), 0) || endR.sz * scale;
        const spc = (v, dflt) => !v ? dflt : v.pts != null ? v.pts * scale : v.pct * lsz * 1.2;
        const lnMult = L.lnSpc?.pct ?? 1;
        for (const l of lines) { const s = l.size || lsz; l.h = L.lnSpc?.pts != null ? L.lnSpc.pts : s * 1.2 * lnMult; l.asc = L.lnSpc?.pts != null ? l.h * 0.8 : s * 0.95 + (s * 1.2 * (lnMult - 1)) * (lnMult > 1 ? 1 : 0); if (lnMult < 1 && L.lnSpc?.pts == null) l.asc = s * 0.95 * (0.6 + 0.4 * lnMult); }
        out.push({ lines, L, marL, ind, bx, bu, baseR, before: spc(L.spcBef, 0), after: spc(L.spcAft, 0), algn: L.algn || 'l', h: lines.reduce((s, l) => s + l.h, 0), env });
      }
      return out;
    }
    const textHeight = paras => paras.reduce((s, p, i) => s + (i ? Math.max(0, p.before) : 0) * 0 + p.before + p.h + p.after, 0) - (paras[0] ? paras[0].before : 0) * 0;
    function drawText(page, paras, x0, topY, width, env) {
      let y = topY;
      for (let pi = 0; pi < paras.length; pi++) {
        const p = paras[pi]; if (pi) y -= p.before; else y -= p.before * 0;
        let first_ = true;
        for (let li = 0; li < p.lines.length; li++) {
          const l = p.lines[li]; const baseY = y - l.asc;
          const x00 = p.marL + (li === 0 ? p.ind : 0); const avail = width - (li === 0 ? Math.max(0, p.marL + p.ind) : p.marL);
          const startLine = li === 0 ? Math.max(0, p.marL + p.ind) : p.marL;
          let sx = x0 + startLine; const space = width - startLine - l.w;
          if (p.algn === 'ctr') sx += space / 2; else if (p.algn === 'r') sx += space;
          let jx = 0; const spaces = l.items.filter(i => i.k === 'space').length;
          const jus = (p.algn === 'just' && !l.endsBr && li < p.lines.length - 1 && spaces) ? space / spaces : 0;
          if (li === 0 && p.bu) {
            const r0 = p.baseR; const bsz = (p.baseR.sz || 18) * (p.L.buSz || 1) * (l.size / ((p.baseR.sz || 18)) || 1);
            const bf = fonts.get(r0.font, !!r0.b, false); const bx = x0 + Math.max(0, p.bx);
            bf.draw(page, p.bu.text, { x: bx, y: baseY, size: Math.max(6, (l.items[0]?.size || bsz) * (p.L.buSz || 1)), color: rgbOf(p.L.buClr || r0.color || BLACK) });
          }
          for (const it of l.items) {
            if (it.k === 'space') { sx += it.w + jus; continue; }
            const rp = it.rp; const col = rp.color || BLACK; const va = rp.base ? (rp.base > 0 ? it.size * 0.5 : -it.size * 0.15) : 0;
            it.font.draw(page, it.t, { x: sx, y: baseY + va, size: it.size, color: rgbOf(col) });
            if (rp.u) page.drawLine({ start: { x: sx, y: baseY - it.size * 0.12 }, end: { x: sx + it.w, y: baseY - it.size * 0.12 }, thickness: Math.max(0.4, it.size / 22), color: rgbOf(col) });
            if (rp.strike) page.drawLine({ start: { x: sx, y: baseY + it.size * 0.3 }, end: { x: sx + it.w, y: baseY + it.size * 0.3 }, thickness: Math.max(0.4, it.size / 22), color: rgbOf(col) });
            sx += it.w;
          }
          y -= l.h;
        }
        y -= p.after;
      }
    }

    /* ---- drawing primitives ---- */
    const getImg = async (rels, rid) => { const rel = rels[rid]; if (!rel || !zip.file(rel.target)) return null; return embedImage(pdf, await zip.file(rel.target).async('uint8array'), rel.target, imgCache); };
    function gradRect(page, x, y, w, h, fill) {
      const st = fill.stops.slice().sort((a, b) => a.pos - b.pos); if (!st.length) return; if (st.length === 1) { page.drawRectangle({ x, y, width: w, height: h, color: rgbOf(st[0].c) }); return; }
      const ang = ((fill.angle % 360) + 360) % 360; const vertical = (ang > 45 && ang < 135) || (ang > 225 && ang < 315); const rev = ang >= 135 && ang <= 315; const N = 48;
      const colAt = t => { t = clamp(rev ? 1 - t : t, 0, 1); for (let i = 1; i < st.length; i++) if (t <= st[i].pos || i === st.length - 1) { const a = st[i - 1], b = st[i]; const u = clamp((t - a.pos) / Math.max(1e-6, b.pos - a.pos), 0, 1); return [a.c[0] + (b.c[0] - a.c[0]) * u, a.c[1] + (b.c[1] - a.c[1]) * u, a.c[2] + (b.c[2] - a.c[2]) * u]; } return st[0].c; };
      for (let i = 0; i < N; i++) { const t = (i + 0.5) / N; if (vertical) page.drawRectangle({ x, y: y + h - (i + 1) * h / N - 0.3, width: w, height: h / N + 0.6, color: rgbOf(colAt(t)) }); else page.drawRectangle({ x: x + i * w / N - 0.3, y, width: w / N + 0.6, height: h, color: rgbOf(colAt(t)) }); }
    }
    const dashOf = d => !d || d === 'solid' ? undefined : /sysDot|dot/.test(d) && !/dash/i.test(d) ? [1, 2] : [4, 3];
    const resolveFillLine = (el, T, clrMap, isPic) => {
      const spPr = first(el, 'spPr'); let fill = readFill(spPr, T, clrMap); let line = readLine(spPr, T, clrMap);
      const fr = styleRef(el, 'fillRef', T, clrMap), lr = styleRef(el, 'lnRef', T, clrMap);
      if (!fill && fr && fr.idx > 0 && fr.color) fill = { type: 'solid', ...fr.color };
      if (!line || (!line.fill && !(line.w === 0))) { if (lr && lr.idx > 0 && lr.color) line = { w: (line && line.w) ?? (lr.idx === 1 ? 0.75 : lr.idx === 2 ? 1.5 : 2.25), fill: { type: 'solid', ...lr.color }, dash: line?.dash }; }
      return { fill, line };
    };

    /* ---- shape tree ---- */
    const idPath = (page, path, opts) => page.drawSvgPath(path, opts);
    async function drawTree(page, tree, xf, env, layer) {
      for (const el of kids(tree)) {
        const nm = el.localName;
        if (nm === 'sp' || nm === 'cxnSp') await drawSp(page, el, xf, env, layer);
        else if (nm === 'pic') await drawPic(page, el, xf, env);
        else if (nm === 'grpSp') {
          const gx = first(first(el, 'grpSpPr'), 'xfrm'); let nx = xf;
          if (gx) { const off = first(gx, 'off'), ext = first(gx, 'ext'), co = first(gx, 'chOff'), ce = first(gx, 'chExt'); const ox = num(attr(off, 'x')), oy = num(attr(off, 'y')), ex = num(attr(ext, 'cx')), ey = num(attr(ext, 'cy')), cox = num(attr(co, 'x')), coy = num(attr(co, 'y')), cex = num(attr(ce, 'cx')) || ex || 1, cey = num(attr(ce, 'cy')) || ey || 1; const sx = ex / cex, sy = ey / cey; nx = { sx: xf.sx * sx, sy: xf.sy * sy, tx: xf.tx + xf.sx * (ox - cox * sx), ty: xf.ty + xf.sy * (oy - coy * sy) }; }
          await drawTree(page, el, nx, env, layer);
        } else if (nm === 'graphicFrame') await drawFrame(page, el, xf, env);
        else if (nm === 'AlternateContent') { const ch = first(el, 'Choice') || first(el, 'Fallback'); if (ch) await drawTree(page, ch, xf, env, layer); }
      }
    }
    const box = (el, xf, inherited) => {
      const x = first(first(el, 'spPr') || first(el, 'xfrm') || el, 'xfrm') || first(el, 'xfrm') || inherited; if (!x) return null;
      const off = first(x, 'off'), ext = first(x, 'ext'); if (!off || !ext) return null;
      const X = (num(attr(off, 'x')) * xf.sx + xf.tx) / EMU, Y = (num(attr(off, 'y')) * xf.sy + xf.ty) / EMU, W = num(attr(ext, 'cx')) * xf.sx / EMU, H = num(attr(ext, 'cy')) * xf.sy / EMU;
      return { x: X, y: Y, w: W, h: H, rot: num(attr(x, 'rot')) / 60000, flipH: attr(x, 'flipH') === '1', flipV: attr(x, 'flipV') === '1' };
    };
    const phOf = el => { const ph = first(first(first(el, 'nvSpPr') || first(el, 'nvPicPr') || first(el, 'nvGraphicFramePr') || el, 'nvPr') || first(first(el, 'nvSpPr'), 'nvPr'), 'ph'); return ph ? { type: attr(ph, 'type') || 'obj', idx: attr(ph, 'idx') } : null; };
    const findPh = (root, ph) => { if (!ph || !root) return null; const tree = first(first(root, 'cSld'), 'spTree'); let cand = null; for (const s of kids(tree, 'sp')) { const p = phOf(s); if (!p) continue; if (ph.idx != null && p.idx === ph.idx) return s; if (!cand && p.type === ph.type && (ph.idx == null || p.idx == null || true)) cand = s; if (!cand && ((ph.type === 'ctrTitle' && p.type === 'title') || (ph.type === 'subTitle' && p.type === 'body'))) cand = s; } return cand; };
    async function drawSp(page, el, xf, env, layer) {
      const ph = phOf(el); let b = box(el, xf, null); let lPh = null, mPh = null;
      if (ph && layer === 'slide') { lPh = findPh(env.layout?.root, ph); mPh = findPh(env.master?.root, ph); if (!b) { const lx = lPh && first(first(lPh, 'spPr'), 'xfrm'); const mx = mPh && first(first(mPh, 'spPr'), 'xfrm'); b = box(el, xf, lx || mx); } }
      else if (ph && layer !== 'slide') return; // layout/master placeholders are not drawn
      if (!b || b.w < 0 || b.h < 0) return;
      const T = env.T, clrMap = env.clrMap; let { fill, line } = resolveFillLine(el, T, clrMap);
      if (ph && !fill) { const pf = lPh && readFill(first(lPh, 'spPr'), T, clrMap); if (pf) fill = pf; }
      const spPr = first(el, 'spPr'); const geom = first(spPr, 'prstGeom'), cg = first(spPr, 'custGeom'); const prst = geom ? attr(geom, 'prst') : cg ? 'cust' : 'rect';
      const isLine = el.localName === 'cxnSp' || /^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/.test(prst);
      const PH = env.H;
      const cx = b.x + b.w / 2, cyTop = b.y + b.h / 2; const pcy = PH - cyTop;
      // fills & outlines
      if (isLine) {
        const lf = line?.fill?.c ? line.fill : (styleRef(el, 'lnRef', T, clrMap)?.color ? { c: styleRef(el, 'lnRef', T, clrMap).color.c } : { c: [0, 0, 0] });
        const x1 = b.flipH ? b.x + b.w : b.x, x2 = b.flipH ? b.x : b.x + b.w, y1 = b.flipV ? b.y + b.h : b.y, y2 = b.flipV ? b.y : b.y + b.h;
        page.drawLine({ start: { x: x1, y: PH - y1 }, end: { x: x2, y: PH - y2 }, thickness: Math.max(0.25, line?.w ?? 1), color: rgbOf(lf.c), dashArray: dashOf(line?.dash) });
        return;
      }
      const hasLine = line && line.fill && line.fill.type !== 'none' && (line.w == null || line.w > 0);
      let pathStr = null;
      if (prst === 'rect' || prst === 'flowChartProcess' || prst === 'flowChartAlternateProcess' || prst === 'snip1Rect' || prst === 'wedgeRectCallout') pathStr = null; else pathStr = cg ? custPath(cg, b.w, b.h) : presetPath(prst, b.w, b.h, (() => { const av = {}; for (const g of kids(first(geom, 'avLst'), 'gd')) { const m = /val\s+(-?\d+)/.exec(attr(g, 'fmla') || ''); if (m) av[attr(g, 'name')] = +m[1]; } return av; })());
      if (fill && fill.type === 'blip') { const img = await getImg(env.rels, fill.rid); if (img) page.drawImage(img, { x: b.x, y: PH - b.y - b.h, width: b.w, height: b.h }); }
      else if (fill && fill.type === 'grad' && !pathStr) gradRect(page, b.x, PH - b.y - b.h, b.w, b.h, fill);
      const solid = fill && (fill.type === 'solid' ? fill : fill.type === 'grad' ? { c: fill.stops[0]?.c || [0.5, 0.5, 0.5], a: 1 } : null);
      if (pathStr && (solid || hasLine)) {
        const centered = pathStr; const th = -b.rot * Math.PI / 180;
        const o = { x: cx + (-b.w / 2) * Math.cos(th) - (b.h / 2) * Math.sin(th), y: pcy + (-b.w / 2) * Math.sin(th) + (b.h / 2) * Math.cos(th), rotate: degrees(-b.rot) }; if (solid) { o.color = rgbOf(solid.c); if (solid.a < 1) o.opacity = solid.a; } if (hasLine) { o.borderColor = rgbOf(line.fill.c); o.borderWidth = Math.max(0.25, line.w ?? 0.75); } else o.borderWidth = 0;
        try { page.drawSvgPath(centered, o); } catch (e) { page.drawRectangle({ x: b.x, y: PH - b.y - b.h, width: b.w, height: b.h, color: solid ? rgbOf(solid.c) : undefined, borderColor: hasLine ? rgbOf(line.fill.c) : undefined, borderWidth: hasLine ? 0.75 : 0 }); }
      } else if (!pathStr && (solid || hasLine) && !(fill && (fill.type === 'grad' || fill.type === 'blip') && !hasLine)) {
        const o = { x: b.x, y: PH - b.y - b.h, width: b.w, height: b.h }; if (solid && fill.type === 'solid') { o.color = rgbOf(solid.c); if (solid.a < 1) o.opacity = solid.a; } if (hasLine) { o.borderColor = rgbOf(line.fill.c); o.borderWidth = Math.max(0.25, line.w ?? 0.75); } if (b.rot) { /* rotate rect around centre */ o.rotate = degrees(-b.rot); const rad = -b.rot * Math.PI / 180; const dx = -b.w / 2, dy = -b.h / 2; o.x = cx + dx * Math.cos(rad) - dy * Math.sin(rad); o.y = pcy + dx * Math.sin(rad) + dy * Math.cos(rad) - 0; o.y = pcy + (-b.w / 2) * Math.sin(rad) + (b.h / 2 * -1) * Math.cos(rad) * -1 - b.h; o.y = pcy - ( -dx * Math.sin(rad) * -1) ; const ox = cx + (-b.w / 2) * Math.cos(rad) - (-b.h / 2) * Math.sin(rad), oy = pcy + (-b.w / 2) * Math.sin(rad) + (-b.h / 2) * Math.cos(rad); o.x = ox; o.y = oy; }
        if (solid || hasLine) page.drawRectangle(o);
      }
      // text
      const tb = first(el, 'txBody'); if (!tb) return;
      const bodyPr = first(tb, 'bodyPr'); const ins = k => attr(bodyPr, k) != null ? num(attr(bodyPr, k)) / EMU : (k === 'lIns' || k === 'rIns' ? 7.2 : 3.6);
      const lI = ins('lIns'), tI = ins('tIns'), rI = ins('rIns'), bI = ins('bIns');
      const lstEl = first(tb, 'lstStyle');
      const ty = ph ? (/title/i.test(ph.type) ? 'titleStyle' : /^(dt|ftr|sldNum)$/.test(ph.type) ? 'otherStyle' : 'bodyStyle') : 'otherStyle';
      const chain = [defaultTextStyle, env.master?.txStyles ? first(env.master.txStyles, ty) : null, mPh ? first(first(mPh, 'txBody'), 'lstStyle') : null, lPh ? first(first(lPh, 'txBody'), 'lstStyle') : null, lstEl];
      const tenv = { T, clrMap, chain };
      const wrapNone = attr(bodyPr, 'wrap') === 'none';
      const innerW = wrapNone ? 5000 : Math.max(10, b.w - lI - rI), innerH = b.h - tI - bI;
      const na = first(bodyPr, 'normAutofit'); let scale = na && attr(na, 'fontScale') ? num(attr(na, 'fontScale')) / 1e5 : 1;
      let paras = layoutText(tb, innerW, tenv, scale, { n: env.n });
      let th = textHeight(paras);
      if (na && !attr(na, 'fontScale')) { let tries = 0; while (th > innerH && scale > 0.4 && tries++ < 14) { scale *= 0.93; paras = layoutText(tb, innerW, tenv, scale, { n: env.n }); th = textHeight(paras); } }
      if (!paras.some(p => p.lines.some(l => l.items.length))) return;
      const anchor = attr(bodyPr, 'anchor') || (ph && lPh ? attr(first(first(lPh, 'txBody'), 'bodyPr'), 'anchor') : null) || (ph && mPh ? attr(first(first(mPh, 'txBody'), 'bodyPr'), 'anchor') : null) || 't';
      let top = b.y + tI; if (anchor === 'ctr') top = b.y + tI + (innerH - th) / 2; else if (anchor === 'b') top = b.y + tI + (innerH - th);
      let tx = b.x + lI; if (wrapNone) { const wmax = Math.max(...paras.map(p => Math.max(...p.lines.map(l => l.w + p.marL)))); const al = paras[0].algn; if (al === 'ctr') tx = b.x + (b.w - wmax) / 2; else if (al === 'r') tx = b.x + b.w - rI - wmax; paras.forEach(p => { p.algn = 'l'; }); return drawText(page, paras, tx, PH - top, wmax + 4, tenv); }
      drawText(page, paras, tx, PH - top, innerW, tenv);
    }
    async function drawPic(page, el, xf, env) {
      const b = box(el, xf, null); if (!b) return; const PH = env.H; const bf = first(el, 'blipFill'); const blip = first(bf, 'blip'); const rid = attr(blip, 'embed');
      const img = rid ? await getImg(env.rels, rid) : null;
      if (!img) { warn.add('Some pictures (e.g. EMF/WMF or linked images) could not be embedded.'); return; }
      const sr = first(bf, 'srcRect'); const cr = sr ? { l: num(attr(sr, 'l')) / 1e5, t: num(attr(sr, 't')) / 1e5, r: num(attr(sr, 'r')) / 1e5, b: num(attr(sr, 'b')) / 1e5 } : null;
      const x = b.x, y = PH - b.y - b.h;
      const o = { x, y, width: b.w, height: b.h };
      if (cr && (cr.l || cr.r || cr.t || cr.b)) { const cw = 1 - cr.l - cr.r, ch = 1 - cr.t - cr.b; const fw = b.w / cw, fh = b.h / ch; page.pushOperators(PDFLib.pushGraphicsState(), PDFLib.moveTo(x, y), PDFLib.lineTo(x + b.w, y), PDFLib.lineTo(x + b.w, y + b.h), PDFLib.lineTo(x, y + b.h), PDFLib.closePath(), PDFLib.clip(), PDFLib.endPath()); page.drawImage(img, { x: x - cr.l * fw, y: y - cr.b * fh, width: fw, height: fh }); page.pushOperators(PDFLib.popGraphicsState()); }
      else if (b.rot) { const rad = -b.rot * Math.PI / 180; const cx = b.x + b.w / 2, cy = PH - (b.y + b.h / 2); page.drawImage(img, { x: cx + (-b.w / 2) * Math.cos(rad) - (-b.h / 2) * Math.sin(rad), y: cy + (-b.w / 2) * Math.sin(rad) + (-b.h / 2) * Math.cos(rad), width: b.w, height: b.h, rotate: degrees(-b.rot) }); }
      else page.drawImage(img, o);
      const ln = readLine(first(el, 'spPr'), env.T, env.clrMap); if (ln && ln.fill && ln.fill.type === 'solid') page.drawRectangle({ x, y, width: b.w, height: b.h, borderColor: rgbOf(ln.fill.c), borderWidth: ln.w || 0.75 });
    }
    async function drawFrame(page, el, xf, env) {
      const b = box(el, xf, null); if (!b) return; const PH = env.H; const gd = first(first(el, 'graphic'), 'graphicData'); const tbl = first(gd, 'tbl');
      if (!tbl) { const isChart = gd && /chart/i.test(attr(gd, 'uri') || ''); page.drawRectangle({ x: b.x, y: PH - b.y - b.h, width: b.w, height: b.h, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.6, color: rgb(0.97, 0.97, 0.97) }); fonts.get('Helvetica', false, true).draw(page, isChart ? 'Chart (not rendered)' : 'Embedded object (not rendered)', { x: b.x + 8, y: PH - b.y - 18, size: 9, color: rgb(0.45, 0.45, 0.45) }); warn.add('Charts, SmartArt and embedded objects are shown as placeholders.'); return; }
      const T = env.T, clrMap = env.clrMap; const pr = first(tbl, 'tblPr'); const flag = k => attr(pr, k) === '1';
      const sid = first(pr, 'tableStyleId')?.textContent; const sdef = tableStyles[sid];
      const cols = kids(first(tbl, 'tblGrid'), 'gridCol').map(g => num(attr(g, 'w')) * xf.sx / EMU); const rows = kids(tbl, 'tr');
      const styleParts = {}; if (sdef) for (const part of ['wholeTbl', 'band1H', 'band2H', 'band1V', 'band2V', 'firstRow', 'lastRow', 'firstCol', 'lastCol']) { const e = first(sdef, part); if (e) styleParts[part] = e; }
      const builtin = !sdef; const acc = resolveClr({ localName: 'schemeClr', getAttribute: () => 'accent1', attributes: [], firstElementChild: null }, T, clrMap);
      const accent = hexColor(T.colors.accent1 || '4472C4', [0.27, 0.45, 0.77]);
      const tintOf = (c, t) => c.map(x => x * t + (1 - t));
      const partFill = (part) => { const e = styleParts[part]; const tcs = e && first(e, 'tcStyle'); const f = tcs && first(tcs, 'fill'); if (f) { const sf = first(f, 'solidFill'); if (sf) { const r = resolveClr(firstColorChild(sf), T, clrMap); if (r) return r.c; } } return null; };
      const partText = (part) => { const e = styleParts[part]; const tt = e && first(e, 'tcTxStyle'); if (!tt) return {}; const o = {}; if (attr(tt, 'b') === 'on') o.b = true; const clr = firstColorChild(tt); if (clr) { const r = resolveClr(clr, T, clrMap); if (r) o.color = r.c; } else { const fr = first(tt, 'fontRef'); const c2 = fr && firstColorChild(fr); if (c2) { const r = resolveClr(c2, T, clrMap); if (r) o.color = r.c; } } return o; };
      const laid = []; let totalH = 0;
      for (let ri = 0; ri < rows.length; ri++) {
        const tcs = kids(rows[ri], 'tc'); const rowCells = []; let ci = 0; let rowH = num(attr(rows[ri], 'h')) * xf.sy / EMU;
        for (const tc of tcs) {
          const span = num(attr(tc, 'gridSpan'), 1); const hm = attr(tc, 'hMerge') === '1' || attr(tc, 'vMerge') === '1';
          const w = cols.slice(ci, ci + span).reduce((a, c) => a + c, 0); const tcPr = first(tc, 'tcPr');
          const mar = k => attr(tcPr, k) != null ? num(attr(tcPr, k)) / EMU : (k === 'marL' || k === 'marR' ? 7.2 : 3.6);
          const isHdr = flag('firstRow') && ri === 0, isLast = flag('lastRow') && ri === rows.length - 1, isFC = flag('firstCol') && ci === 0;
          let fill = readFill(tcPr, T, clrMap); fill = fill && fill.type === 'solid' ? fill.c : null; let tcolor = null, tbold = false;
          if (builtin && !fill) { if (isHdr) { fill = accent; tcolor = [1, 1, 1]; tbold = true; } else if (flag('bandRow')) fill = tintOf(accent, ((ri - (flag('firstRow') ? 1 : 0)) % 2 === 0) ? 0.4 : 0.2); else fill = tintOf(accent, 0.2); if (isFC && !isHdr) { tbold = true; } }
          else if (!fill) { const parts = [isHdr ? 'firstRow' : null, isLast ? 'lastRow' : null, isFC ? 'firstCol' : null, flag('bandRow') && !isHdr ? (((ri - (flag('firstRow') ? 1 : 0)) % 2 === 0) ? 'band1H' : 'band2H') : null, 'wholeTbl'].filter(Boolean); for (const p of parts) { const f = partFill(p); if (f && !fill) fill = f; const tt = partText(p); if (tt.color && !tcolor) tcolor = tt.color; if (tt.b) tbold = tbold || true; } }
          const tb = first(tc, 'txBody'); let paras = [];
          const tenv = { T, clrMap, chain: [defaultTextStyle, env.master?.txStyles ? first(env.master.txStyles, 'otherStyle') : null, first(tb, 'lstStyle')] };
          if (tb && !hm) { paras = layoutText(tb, Math.max(10, w - mar('marL') - mar('marR')), tenv, 1, { n: env.n }); }
          if (tcolor || tbold) for (const p of paras) for (const l of p.lines) for (const it of l.items) { if (tcolor && !it.rp.colorExplicit) it.rp = { ...it.rp, color: it.rp.color && it.rp.color !== BLACK && !(it.rp.color[0] === 0 && it.rp.color[1] === 0 && it.rp.color[2] === 0) ? it.rp.color : tcolor }; if (tbold && !it.rp.b) { it.rp = { ...it.rp, b: true }; it.font = fonts.get(it.rp.font, true, !!it.rp.i); it.w = it.font.widthOfTextAtSize(it.t, it.size); } }
          if (tcolor || tbold) for (const p of paras) { let lw = 0; for (const l of p.lines) { l.w = l.items.reduce((s, i) => s + i.w, 0); } }
          const ch = paras.length ? textHeight(paras) + mar('tIns' in {} ? 'marT' : 'marT') + mar('marB') : 0;
          rowH = Math.max(rowH, ch);
          const bd = {}; for (const [k, nmk] of [['L', 'lnL'], ['R', 'lnR'], ['T', 'lnT'], ['B', 'lnB']]) { const lnEl = first(tcPr, nmk); if (lnEl) { const f = readFill(lnEl, T, clrMap); if (f && f.type === 'solid') bd[k] = { c: f.c, w: attr(lnEl, 'w') != null ? num(attr(lnEl, 'w')) / EMU : 0.75 }; } }
          if (builtin && !Object.keys(bd).length) for (const k of ['L', 'R', 'T', 'B']) bd[k] = { c: [1, 1, 1], w: 1 };
          rowCells.push({ x: cols.slice(0, ci).reduce((a, c) => a + c, 0), w, span, fill, paras, mar: { l: mar('marL'), r: mar('marR'), t: mar('marT'), b: mar('marB') }, anchor: attr(tcPr, 'anchor') || 't', bd, hm, tenv });
          ci += span;
        }
        laid.push({ cells: rowCells, h: rowH }); totalH += rowH;
      }
      let y = b.y;
      for (const row of laid) {
        for (const c of row.cells) {
          if (c.hm) continue; const cx = b.x + c.x;
          if (c.fill) page.drawRectangle({ x: cx, y: PH - y - row.h, width: c.w, height: row.h, color: rgbOf(c.fill) });
          if (c.paras.length) { const th = textHeight(c.paras); let top = y + c.mar.t; if (c.anchor === 'ctr') top = y + (row.h - th) / 2; else if (c.anchor === 'b') top = y + row.h - c.mar.b - th; drawText(page, c.paras, cx + c.mar.l, PH - top, c.w - c.mar.l - c.mar.r, c.tenv); }
          const ln = (k, xa, ya, xb, yb) => { const d = c.bd[k]; if (d && d.w > 0) page.drawLine({ start: { x: xa, y: ya }, end: { x: xb, y: yb }, thickness: d.w, color: rgbOf(d.c) }); };
          ln('T', cx, PH - y, cx + c.w, PH - y); ln('B', cx, PH - y - row.h, cx + c.w, PH - y - row.h); ln('L', cx, PH - y, cx, PH - y - row.h); ln('R', cx + c.w, PH - y, cx + c.w, PH - y - row.h);
        }
        y += row.h;
      }
    }

    /* ---- slides ---- */
    for (let i = 0; i < slideRefs.length; i++) {
      status(`Converting slide ${i + 1} of ${slideRefs.length}…`);
      const slide = await loadPart(slideRefs[i], {}); if (!slide) continue;
      const layRel = Object.values(slide.rels).find(r => /slideLayout$/.test(r.type || '')); const layout = layRel ? await loadPart(layRel.target, cacheL) : null;
      const masRel = layout && Object.values(layout.rels).find(r => /slideMaster$/.test(r.type || '')); const master = masRel ? await loadMaster(masRel.target) : null;
      const T = master?.T || parseThemeP(''); const clrMap = master?.clrMap || {};
      const page = pdf.addPage([SW, SH]); const PH = SH;
      const baseEnv = { T, clrMap, master, layout, H: PH, n: i + 1 };
      // background
      const bgOf = async (root, rels) => { const bg = first(first(root, 'cSld'), 'bg'); if (!bg) return false; const pr = first(bg, 'bgPr'); let fill = null; if (pr) fill = readFill(pr, T, clrMap); else { const ref = first(bg, 'bgRef'); const c = ref && firstColorChild(ref); if (c) { const r = resolveClr(c, T, clrMap); if (r) fill = { type: 'solid', ...r }; } } if (!fill) return false; if (fill.type === 'solid') page.drawRectangle({ x: 0, y: 0, width: SW, height: SH, color: rgbOf(fill.c) }); else if (fill.type === 'grad') gradRect(page, 0, 0, SW, SH, fill); else if (fill.type === 'blip') { const img = await getImg(rels, fill.rid); if (img) page.drawImage(img, { x: 0, y: 0, width: SW, height: SH }); } return true; };
      if (!(await bgOf(slide.root, slide.rels)) && !(layout && await bgOf(layout.root, layout.rels)) && !(master && await bgOf(master.root, master.rels))) page.drawRectangle({ x: 0, y: 0, width: SW, height: SH, color: rgb(1, 1, 1) });
      const ident = { sx: 1, sy: 1, tx: 0, ty: 0 };
      const showMaster = attr(slide.root, 'showMasterSp') !== '0', showLayoutMaster = !layout || attr(layout.root, 'showMasterSp') !== '0';
      if (master && showMaster && showLayoutMaster) await drawTree(page, first(first(master.root, 'cSld'), 'spTree'), ident, { ...baseEnv, rels: master.rels }, 'master');
      if (layout && showMaster) await drawTree(page, first(first(layout.root, 'cSld'), 'spTree'), ident, { ...baseEnv, rels: layout.rels }, 'layout');
      await drawTree(page, first(first(slide.root, 'cSld'), 'spTree'), ident, { ...baseEnv, rels: slide.rels }, 'slide');
    }
    pdf.setProducer('FRZ PDF Express'); pdf.setCreator('FRZ PDF Express');
    return { bytes: await pdf.save(), pages: slideRefs.length, warnings: [...warn] };
  }
  window.FRZOffice.pptx = pptxToPdfBytes;
})();
