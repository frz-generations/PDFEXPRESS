/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations (https://github.com/frz-generations).
 * Created by FRZ Generations as an open-source application, following government open-source guidelines.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 */
/* Browser-only office/PDF converters for FRZ PDF Express. */
(() => {
  'use strict';

  const PDFLib = window.PDFLib;
  const PDFDocument = PDFLib?.PDFDocument;
  const pdfjs = window.pdfjsLib;
  let XLSX = window.XLSX;
  const JSZip = window.JSZip;

  const byId = id => document.getElementById(id);
  const pdfSafe = value => String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\u00a0/g, ' ');

  /* ---- Unicode text in PDFs: Noto Sans (Latin) + Noto Sans Malayalam, shaped by fontkit, drawn as real selectable text ---- */
  const isMal = ch => /[\u0D00-\u0D7F\u200C\u200D]/.test(ch);
  async function ensureFontkit() {
    if (window.fontkit) return;
    await new Promise((resolve, reject) => { const el = document.createElement('script'); el.src = 'vendor/fontkit.min.js'; el.onload = resolve; el.onerror = () => reject(new Error('The Unicode font engine could not be loaded.')); document.head.appendChild(el); });
  }
  async function loadUniFonts(pdf) {
    await ensureFontkit(); pdf.registerFontkit(window.fontkit);
    const get = async name => new Uint8Array(await (await fetch('vendor/fonts/noto/' + name)).arrayBuffer());
    const emb = async (name, mal) => pdf.embedFont(await get(name), mal ? { subset: true, features: { mark: false, mkmk: false, abvm: false, blwm: false, dist: false, curs: false } } : { subset: true });
    const [lr, lb, mr, mb] = [await emb('NotoSans-400.woff'), await emb('NotoSans-700.woff'), await emb('NotoSansMalayalam-400.woff', true), await emb('NotoSansMalayalam-700.woff', true)];
    const make = (lat, mal) => {
      const latSet = new Set(lat.getCharacterSet()), malSet = new Set(mal.getCharacterSet());
      const runs = text => {
        const out = []; let cur = null;
        for (let ch of String(text)) {
          const cp = ch.codePointAt(0), inL = latSet.has(cp), inM = malSet.has(cp); let f;
          if (isMal(ch) && inM) f = mal; else if (inL && inM) f = cur ? cur.font : lat; else if (inL) f = lat; else if (inM) f = mal; else { ch = '?'; f = lat; }
          if (cur && cur.font === f) cur.text += ch; else { cur = { font: f, text: ch }; out.push(cur); }
        }
        return out;
      };
      return {
        isMixed: true, base: lat,
        widthOfTextAtSize: (text, size) => runs(text).reduce((w, r) => w + r.font.widthOfTextAtSize(r.text, size), 0),
        heightAtSize: size => lat.heightAtSize(size),
        draw(page, text, o) { let x = o.x; runs(text).forEach(r => { page.drawText(r.text, { ...o, x, font: r.font }); x += r.font.widthOfTextAtSize(r.text, o.size || 12); }); }
      };
    };
    return { regular: make(lr, mr), bold: make(lb, mb) };
  }
  function drawU(page, text, o) { if (o && o.font && o.font.isMixed) o.font.draw(page, String(text), o); else page.drawText(text, o); }

  function filenameFor(name) {
    return window.frzActionFilename ? window.frzActionFilename(name) : name;
  }

  function download(bytes, name, mime) {
    const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filenameFor(name);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  }

  function setStatus(id, text, visible = true) {
    const box = byId(`${id}Status`);
    const label = byId(`${id}StatusText`);
    if (label) label.textContent = text;
    if (box) box.classList.toggle('show', visible);
  }

  function bindFileTool(id, accept, handler) {
    const zone = document.querySelector(`[data-drop="${id}"]`);
    const input = document.querySelector(`[data-input="${id}"]`);
    if (!zone || !input) return;
    const acceptFile = file => {
      const lower = file.name.toLowerCase();
      return accept.some(rule => rule.startsWith('.') ? lower.endsWith(rule) : file.type === rule);
    };
    const submit = files => {
      const file = files.find(acceptFile);
      if (file) handler(file);
      else window.alert(`Choose a supported file: ${accept.join(', ')}`);
    };
    input.addEventListener('click', event => event.stopPropagation());
    zone.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
      if (input.files?.length) submit([...input.files]);
      input.value = '';
    });
    ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.add('drag');
    }));
    ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => {
      event.preventDefault();
      zone.classList.remove('drag');
    }));
    zone.addEventListener('drop', event => {
      const files = [...(event.dataTransfer?.files || [])];
      if (files.length) submit(files);
    });
  }

  function formatCell(value) {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return pdfSafe(value);
  }

  const xlsxOpts = () => ({ trim: byId('xlsxTrim') ? byId('xlsxTrim').checked : true, range: byId('xlsxRange') ? byId('xlsxRange').value : '' });
  async function runSpreadsheet(input, id, name) {
    const button = byId('xlsx2pdfBtn');
    try { await window.frzLoad('xlsx'); XLSX = window.XLSX; } catch (e) {}
    if (!XLSX || !PDFDocument || !window.FRZOffice) return window.alert('The spreadsheet libraries are not available. Reconnect once, reload the app, and try again.');
    if (button) button.disabled = true;
    setStatus(id, 'Reading the cells locally…');
    try {
      const res = await window.FRZOffice.xlsx(input.buffer || null, { wb: input.wb, loadUniFonts, fileName: name, opts: xlsxOpts(), status: text => setStatus(id, text) });
      download(res.bytes, 'frz-spreadsheet-to-pdf.pdf', 'application/pdf');
      setStatus(id, `Done — ${res.sheets} sheet(s) on ${res.pages} page(s). Widths, merged cells, fills, borders and number formats were kept; empty cells at the end were ${xlsxOpts().range.trim() ? 'cut to your range' : xlsxOpts().trim ? 'ignored' : 'included'}.${res.warnings.length ? ' Note: ' + res.warnings.join(' ') : ''}`);
    } catch (error) {
      setStatus(id, `Could not convert this data: ${error.message}`);
    } finally {
      if (button) button.disabled = false;
    }
  }
  async function spreadsheetToPdf(file) { return runSpreadsheet({ buffer: await file.arrayBuffer() }, 'xlsx2pdf', file.name); }
  function pastedWorkbook(text, html) {
    if (html && /<table[\s>]/i.test(html)) { try { const wb = XLSX.read(html, { type: 'string', raw: true }); if (wb.SheetNames.length) return wb; } catch (e) { /* fall back to text */ } }
    const wb = XLSX.read(String(text).replace(/\r\n/g, '\n'), { type: 'string', raw: true, FS: '\t' });
    return wb;
  }
  function initPaste() {
    const box = byId('xlsxPaste'); if (!box) return;
    let lastHtml = '';
    box.addEventListener('paste', event => { lastHtml = event.clipboardData?.getData('text/html') || ''; });
    box.addEventListener('input', () => { if (!box.value) lastHtml = ''; });
    byId('xlsxPasteClear')?.addEventListener('click', () => { box.value = ''; lastHtml = ''; setStatus('xlsx2pdf', '', false); box.focus(); });
    byId('xlsxPasteBtn')?.addEventListener('click', async () => {
      if (!box.value.trim()) return setStatus('xlsx2pdf', 'Copy some cells in Excel or Google Sheets, then paste them into the box first.');
      try { await window.frzLoad('xlsx'); XLSX = window.XLSX; } catch (e) {}
      let wb; try { wb = pastedWorkbook(box.value, lastHtml); } catch (e) { return setStatus('xlsx2pdf', `Could not read the pasted cells: ${e.message}`); }
      await runSpreadsheet({ wb }, 'xlsx2pdf', 'pasted-cells');
    });
  }

  function wrapText(text, font, size, maxWidth) {
    const words = pdfSafe(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    const pieces = w => seg ? [...seg.segment(w)].map(x => x.segment) : [...w];
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
      if (font.widthOfTextAtSize(line, size) > maxWidth) {
        let chunk = '';
        for (const g of pieces(line)) { if (chunk && font.widthOfTextAtSize(chunk + g, size) > maxWidth) { lines.push(chunk); chunk = g; } else chunk += g; }
        line = chunk;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function normalizeZipTarget(target) {
    let path = target.replace(/^\//, '');
    if (path.startsWith('ppt/')) return path;
    if (path.startsWith('../')) path = path.replace(/^\.\.\//, '');
    return `ppt/${path}`;
  }

  async function pptxToPdf(file) {
    const id = 'pptx2pdf';
    const button = byId('pptx2pdfBtn');
    if (!JSZip || !PDFDocument || !window.FRZOffice) return window.alert('The presentation conversion libraries are unavailable. Reconnect once, reload the app, and try again.');
    button.disabled = true;
    setStatus(id, 'Reading the presentation locally…');
    try {
      const res = await window.FRZOffice.pptx(await file.arrayBuffer(), { loadUniFonts, status: text => setStatus(id, text) });
      download(res.bytes, 'frz-powerpoint-to-pdf.pdf', 'application/pdf');
      setStatus(id, `Done — ${res.pages} slide(s). Layout, fonts, colours, shapes, pictures and tables were kept as real PDF content.${res.warnings.length ? ' Note: ' + res.warnings.join(' ') : ''}`);
    } catch (error) {
      setStatus(id, `Could not convert this presentation: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  async function pdfToPowerPoint(file) {
    const id = 'pdf2pptx';
    const button = byId('pdf2pptxBtn');
    try { await window.frzLoad('pptx'); } catch (e) {}
    const Pptx = window.PptxGenJS || window.pptxgenjs || window.pptxgen;
    if (!pdfjs || !Pptx) return window.alert('The presentation export library is unavailable. Reconnect once, reload the app, and try again.');
    button.disabled = true;
    setStatus(id, 'Rendering PDF pages into slides locally…');
    try {
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const deck = new Pptx();
      deck.layout = 'LAYOUT_WIDE';
      deck.author = 'FRZ Generations';
      deck.subject = 'Image-based slides converted from a PDF';
      deck.title = 'FRZ PDF Express — PDF to PowerPoint';
      deck.company = 'FRZ Generations';
      deck.lang = 'en-US';
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        setStatus(id, `Rendering page ${pageNumber} of ${pdf.numPages}…`);
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.6 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d', { alpha: false });
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: context, viewport }).promise;
        const slide = deck.addSlide();
        const slideW = 13.333;
        const slideH = 7.5;
        const imageRatio = canvas.width / canvas.height;
        const slideRatio = slideW / slideH;
        const imageW = imageRatio > slideRatio ? slideW : slideH * imageRatio;
        const imageH = imageRatio > slideRatio ? slideW / imageRatio : slideH;
        slide.background = { color: 'FFFFFF' };
        slide.addImage({ data: canvas.toDataURL('image/png'), x: (slideW - imageW) / 2, y: (slideH - imageH) / 2, w: imageW, h: imageH });
        canvas.width = 1;
        canvas.height = 1;
      }
      const bytes = await deck.write({ outputType: 'arraybuffer' });
      download(bytes, 'frz-pdf-to-powerpoint.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      setStatus(id, `Done — ${pdf.numPages} slide(s). Each slide is a sharp page image, not editable text.`);
    } catch (error) {
      setStatus(id, `Could not create the PowerPoint file: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  function groupPdfLines(items) {
    const lines = [];
    const sorted = items.filter(item => item.str && item.str.trim()).map(item => ({
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0,
      width: item.width || 0,
      text: item.str.trim(),
    })).sort((a, b) => Math.abs(b.y - a.y) > 3 ? b.y - a.y : a.x - b.x);
    for (const item of sorted) {
      let line = lines.find(candidate => Math.abs(candidate.y - item.y) <= 3);
      if (!line) {
        line = { y: item.y, items: [] };
        lines.push(line);
      }
      line.items.push(item);
    }
    return lines.sort((a, b) => b.y - a.y).map(line => {
      line.items.sort((a, b) => a.x - b.x);
      const cells = [];
      for (const item of line.items) {
        const previous = cells[cells.length - 1];
        const previousRight = previous ? previous.x + previous.width : -Infinity;
        if (previous && item.x - previousRight < 22) {
          previous.text = `${previous.text} ${item.text}`.trim();
          previous.width = item.x + item.width - previous.x;
        } else cells.push({ x: item.x, width: item.width, text: item.text });
      }
      return cells.map(cell => cell.text);
    });
  }

  async function pdfToSpreadsheet(file) {
    const id = 'pdf2xlsx';
    const button = byId('pdf2xlsxBtn');
    try { await window.frzLoad('xlsx'); XLSX = window.XLSX; } catch (e) {}
    if (!pdfjs || !XLSX) return window.alert('The spreadsheet libraries are unavailable. Reconnect once, reload the app, and try again.');
    button.disabled = true;
    setStatus(id, 'Extracting selectable text locally…');
    try {
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const workbook = XLSX.utils.book_new();
      let totalText = 0;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
        setStatus(id, `Reading page ${pageNumber} of ${pdf.numPages}…`);
        const page = await pdf.getPage(pageNumber);
        const text = await page.getTextContent();
        const rows = groupPdfLines(text.items);
        totalText += rows.reduce((count, row) => count + row.join('').length, 0);
        const sheetRows = rows.length ? rows : [['No selectable text found. Run the OCR tool first for a scanned page.']];
        const sheet = XLSX.utils.aoa_to_sheet(sheetRows);
        XLSX.utils.book_append_sheet(workbook, sheet, `Page ${pageNumber}`);
      }
      const bytes = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      download(bytes, 'frz-pdf-to-spreadsheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      setStatus(id, totalText ? `Done — extracted selectable text from ${pdf.numPages} page(s). Table columns are reconstructed heuristically; scanned pages need OCR first.` : 'Done — no selectable text was found. The workbook includes a note for each scanned page; run OCR first to extract its contents.');
    } catch (error) {
      setStatus(id, `Could not create the spreadsheet: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  function escapeXml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }

  async function readPdfTextPages(file, id) {
    if (!pdfjs) throw new Error('The PDF text library is unavailable. Reload after reconnecting once.');
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setStatus(id, `Reading page ${pageNumber} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = groupPdfLines(content.items).map(row => row.join('   ')).filter(line => line.trim());
      pages.push(lines);
    }
    return pages;
  }

  async function pdfToMarkdown(file) {
    const id = 'pdf2md';
    const button = byId(`${id}Btn`);
    button.disabled = true;
    setStatus(id, 'Extracting selectable text locally…');
    try {
      const pages = await readPdfTextPages(file, id);
      const markdown = pages.map((lines, index) => `# Page ${index + 1}\n\n${lines.length ? lines.map(line => line.replace(/\s+/g, ' ').trim()).join('\n\n') : '_No selectable text. Run OCR first for scanned pages._'}`).join('\n\n---\n\n');
      download(new TextEncoder().encode(markdown), 'frz-pdf-to-markdown.md', 'text/markdown;charset=utf-8');
      setStatus(id, `Done — exported text from ${pages.length} page(s). Page structure and tables are best effort; scanned pages need OCR first.`);
    } catch (error) {
      setStatus(id, `Could not create Markdown: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  async function pdfToDocx(file) {
    const id = 'pdf2docx';
    const button = byId(`${id}Btn`);
    if (!JSZip) return window.alert('The Word export library is unavailable. Reload after reconnecting once.');
    button.disabled = true;
    setStatus(id, 'Extracting selectable text and building a Word document locally…');
    try {
      const pages = await readPdfTextPages(file, id);
      const blocks = [];
      pages.forEach((lines, index) => {
        if (index) blocks.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
        blocks.push(`<w:p><w:pPr><w:keepNext/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Page ${index + 1}</w:t></w:r></w:p>`);
        if (lines.length) {
          lines.forEach(line => blocks.push(`<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`));
        } else {
          blocks.push('<w:p><w:r><w:t>No selectable text. Run OCR first for scanned pages.</w:t></w:r></w:p>');
        }
      });
      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="450" w:footer="450" w:gutter="0"/></w:sectPr></w:body></w:document>`;
      const zip = new JSZip();
      zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
      zip.file('word/document.xml', documentXml);
      const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      download(bytes, 'frz-pdf-to-word.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const textCount = pages.reduce((sum, lines) => sum + lines.join('').length, 0);
      setStatus(id, textCount ? `Done — created a basic Word document from ${pages.length} page(s) of selectable text. Original layout and images are not preserved.` : 'No selectable text was found. The Word document includes OCR reminders; run OCR first for scanned pages.');
    } catch (error) {
      setStatus(id, `Could not create the Word document: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  async function docxToPdf(file) {
    const id = 'docx2pdf';
    const button = byId(`${id}Btn`);
    if (!JSZip || !PDFDocument || !window.FRZOffice) return window.alert('The Word conversion libraries are unavailable. Reload after reconnecting once.');
    button.disabled = true;
    setStatus(id, 'Reading the Word document locally…');
    try {
      const res = await window.FRZOffice.docx(await file.arrayBuffer(), { loadUniFonts, status: text => setStatus(id, text) });
      download(res.bytes, 'frz-word-to-pdf.pdf', 'application/pdf');
      setStatus(id, `Done — ${res.pages} page(s). Text, styles, lists, tables, images, headers and footers were kept as real PDF content.${res.warnings.length ? ' Note: ' + res.warnings.join(' ') : ''}`);
    } catch (error) {
      setStatus(id, `Could not convert this Word document: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  function init() {
    const inputStatus = byId('xlsx2pdfStatus');
    bindFileTool('xlsx2pdf', ['.xlsx', '.xls', '.csv', '.tsv'], spreadsheetToPdf);
    initPaste();
    bindFileTool('pptx2pdf', ['.pptx'], pptxToPdf);
    bindFileTool('pdf2pptx', ['application/pdf', '.pdf'], pdfToPowerPoint);
    bindFileTool('pdf2xlsx', ['application/pdf', '.pdf'], pdfToSpreadsheet);
    bindFileTool('docx2pdf', ['.docx'], docxToPdf);
    bindFileTool('pdf2docx', ['application/pdf', '.pdf'], pdfToDocx);
    bindFileTool('pdf2md', ['application/pdf', '.pdf'], pdfToMarkdown);
    ['xlsx2pdf', 'pptx2pdf', 'pdf2pptx', 'pdf2xlsx', 'docx2pdf', 'pdf2docx', 'pdf2md'].forEach(id => {
      const button = byId(`${id}Btn`);
      const input = document.querySelector(`[data-input="${id}"]`);
      button?.addEventListener('click', () => input?.click());
    });
    if (inputStatus) inputStatus.classList.remove('show');
  }

  window.FRZConverters = { init };
})();
