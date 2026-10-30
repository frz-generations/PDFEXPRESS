/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations (https://github.com/frz-generations).
 * Created by FRZ Generations as an open-source application, following government open-source guidelines.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 */
/* Additional privacy-first PDF utilities for FRZ PDF Express. */
(() => {
  'use strict';

  const PDFLib = window.PDFLib;
  const pdfjs = window.pdfjsLib;
  const $ = id => document.getElementById(id);
  const setStatus = (id, message, visible = true) => {
    const box = $(`${id}Status`);
    const label = $(`${id}StatusText`);
    if (label) label.textContent = message;
    if (box) box.classList.toggle('show', visible);
  };
  const download = (bytes, name, mime) => {
    const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = window.frzActionFilename ? window.frzActionFilename(name) : name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  };
  const isPdf = file => file && (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));

  function bindPdfInput(key, handler) {
    const zone = $(`${key}Drop`);
    const input = $(`${key}Input`);
    if (!zone || !input) return;
    const submit = files => {
      const file = [...files].find(isPdf);
      if (file) handler(file);
      else window.alert('Choose a PDF file.');
    };
    zone.addEventListener('click', event => { if (event.target !== input) input.click(); });
    input.addEventListener('change', () => {
      if (input.files?.length) submit(input.files);
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
      if (event.dataTransfer?.files?.length) submit(event.dataTransfer.files);
    });
  }

  function parsePageRange(value, pageCount) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw || raw === 'all') return new Set(Array.from({ length: pageCount }, (_, index) => index));
    const selected = new Set();
    for (const part of raw.split(',').map(item => item.trim()).filter(Boolean)) {
      const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) throw new Error('Use page numbers such as 1-3,5, or leave the field blank for all pages.');
      const first = Number(match[1]);
      const last = Number(match[2] || match[1]);
      if (first < 1 || last < first || last > pageCount) throw new Error(`Page range must be between 1 and ${pageCount}.`);
      for (let page = first; page <= last; page++) selected.add(page - 1);
    }
    return selected;
  }

  function initCrop() {
    const loaded = $('cropLoaded');
    let sourceFile = null;
    bindPdfInput('crop', file => {
      sourceFile = file;
      $('cropFileName').textContent = file.name;
      loaded.hidden = false;
      setStatus('crop', '', false);
    });
    $('cropBtn')?.addEventListener('click', async () => {
      if (!sourceFile || !PDFLib?.PDFDocument) return;
      const button = $('cropBtn');
      button.disabled = true;
      setStatus('crop', 'Applying crop boxes locally…');
      try {
        const pdf = await PDFLib.PDFDocument.load(await sourceFile.arrayBuffer());
        const pages = pdf.getPages();
        const selected = parsePageRange($('cropRange').value, pages.length);
        const margins = {
          left: Math.max(0, Number($('cropLeft').value) || 0),
          right: Math.max(0, Number($('cropRight').value) || 0),
          top: Math.max(0, Number($('cropTop').value) || 0),
          bottom: Math.max(0, Number($('cropBottom').value) || 0),
        };
        if (!selected.size) throw new Error('Choose at least one page.');
        for (const index of selected) {
          const page = pages[index];
          const box = page.getCropBox();
          const width = box.width - margins.left - margins.right;
          const height = box.height - margins.top - margins.bottom;
          if (width < 24 || height < 24) throw new Error(`The crop margins are too large for page ${index + 1}. Keep at least 24 points in each direction.`);
          page.setCropBox(box.x + margins.left, box.y + margins.bottom, width, height);
        }
        download(await pdf.save(), 'frz-cropped.pdf', 'application/pdf');
        setStatus('crop', `Done — applied a visible crop to ${selected.size} page(s). Hidden page content is not erased.`);
      } catch (error) {
        setStatus('crop', `Could not crop this PDF: ${error.message}`);
      } finally {
        button.disabled = false;
      }
    });
    $('cropReset')?.addEventListener('click', () => {
      sourceFile = null;
      loaded.hidden = true;
      ['cropLeft', 'cropRight', 'cropTop', 'cropBottom'].forEach(id => { $(id).value = '0'; });
      $('cropRange').value = '';
      setStatus('crop', '', false);
    });
  }

  function initSign() {
    const canvas = $('signaturePad');
    const context = canvas?.getContext('2d');
    const loaded = $('signpdfLoaded');
    const input = $('signpdfInput');
    const zone = $('signpdfDrop');
    if (!canvas || !context || !loaded || !input || !zone) return;
    let sourceFile = null;
    let pageCount = 0;
    let hasSignature = false;
    let drawing = false;

    const clearSignature = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      hasSignature = false;
      $('signTypedName').value = '';
    };
    const drawTypedName = () => {
      const name = $('signTypedName').value.trim();
      if (!name) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#141414';
      context.textBaseline = 'middle';
      context.font = 'italic 74px cursive';
      context.fillText(name.slice(0, 48), 26, canvas.height / 2, canvas.width - 52);
      hasSignature = true;
    };
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
    };
    canvas.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button === 0) {
        $('signTypedName').value = '';
        drawing = true;
        hasSignature = true;
        canvas.setPointerCapture(event.pointerId);
        const p = point(event);
        context.beginPath();
        context.moveTo(p.x, p.y);
      }
    });
    canvas.addEventListener('pointermove', event => {
      if (!drawing) return;
      const p = point(event);
      context.strokeStyle = '#141414';
      context.lineWidth = 7;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineTo(p.x, p.y);
      context.stroke();
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => canvas.addEventListener(type, () => { drawing = false; }));
    $('signUseTyped')?.addEventListener('click', drawTypedName);
    $('signClear')?.addEventListener('click', clearSignature);

    const submit = async files => {
      const file = [...files].find(isPdf);
      if (!file) return window.alert('Choose a PDF file.');
      try {
        if (!PDFLib?.PDFDocument) throw new Error('The PDF editing library is not available. Reload after reconnecting once.');
        const pdf = await PDFLib.PDFDocument.load(await file.arrayBuffer());
        sourceFile = file;
        pageCount = pdf.getPageCount();
        $('signPage').max = String(pageCount);
        $('signPage').value = '1';
        $('signFileName').textContent = `${file.name} · ${pageCount} page${pageCount === 1 ? '' : 's'}`;
        clearSignature();
        loaded.hidden = false;
        setStatus('signpdf', '', false);
      } catch (error) {
        setStatus('signpdf', `Could not open this PDF: ${error.message}`);
      }
    };
    zone.addEventListener('click', event => { if (event.target !== input) input.click(); });
    input.addEventListener('change', () => { if (input.files?.length) submit(input.files); input.value = ''; });
    ['dragenter', 'dragover'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(type => zone.addEventListener(type, event => { event.preventDefault(); zone.classList.remove('drag'); }));
    zone.addEventListener('drop', event => { if (event.dataTransfer?.files?.length) submit(event.dataTransfer.files); });

    $('signpdfBtn')?.addEventListener('click', async () => {
      if (!sourceFile || !hasSignature) return setStatus('signpdf', 'Draw or type a signature first.');
      const button = $('signpdfBtn');
      button.disabled = true;
      setStatus('signpdf', 'Adding the visual signature locally…');
      try {
        const pdf = await PDFLib.PDFDocument.load(await sourceFile.arrayBuffer());
        const pageNumber = Number($('signPage').value);
        if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) throw new Error(`Choose a page from 1 to ${pageCount}.`);
        const pngData = canvas.toDataURL('image/png').split(',')[1];
        const pngBytes = Uint8Array.from(atob(pngData), char => char.charCodeAt(0));
        const image = await pdf.embedPng(pngBytes);
        const page = pdf.getPages()[pageNumber - 1];
        const { width, height } = page.getSize();
        const requestedWidth = Math.max(40, Math.min(300, Number($('signWidth').value) || 160));
        const imageWidth = Math.min(requestedWidth, width - 48);
        const imageHeight = imageWidth * image.height / image.width;
        const position = $('signPosition').value;
        const x = position === 'right' ? width - imageWidth - 30 : position === 'center' ? (width - imageWidth) / 2 : 30;
        const y = Math.min(height - imageHeight - 24, 38);
        page.drawImage(image, { x, y, width: imageWidth, height: imageHeight });
        download(await pdf.save(), 'frz-signed.pdf', 'application/pdf');
        setStatus('signpdf', `Done — added a visual signature to page ${pageNumber}. This is not a certificate-backed digital signature.`);
      } catch (error) {
        setStatus('signpdf', `Could not sign this PDF: ${error.message}`);
      } finally {
        button.disabled = false;
      }
    });
    $('signpdfReset')?.addEventListener('click', () => {
      sourceFile = null;
      pageCount = 0;
      loaded.hidden = true;
      clearSignature();
      setStatus('signpdf', '', false);
    });
  }

  async function extractPdfPages(file, progress) {
    if (!pdfjs) throw new Error('The PDF text library is unavailable. Reload after reconnecting once.');
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      progress?.(`Reading ${file.name}: page ${pageNumber} of ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.map(item => item.str || '').join(' ').replace(/\s+/g, ' ').trim();
      pages.push(text);
    }
    return pages;
  }

  function firstTextChange(before, after) {
    let start = 0;
    while (start < before.length && start < after.length && before[start] === after[start]) start++;
    let endBefore = before.length;
    let endAfter = after.length;
    while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) { endBefore--; endAfter--; }
    const oldPart = before.slice(Math.max(0, start - 36), Math.min(before.length, endBefore + 48)).trim();
    const newPart = after.slice(Math.max(0, start - 36), Math.min(after.length, endAfter + 48)).trim();
    return { oldPart: oldPart || '(no extractable text)', newPart: newPart || '(no extractable text)' };
  }

  function initCompare() {
    const inputA = $('comparePdfA');
    const inputB = $('comparePdfB');
    const button = $('compareBtn');
    const results = $('compareResults');
    const list = $('compareDiffs');
    if (!inputA || !inputB || !button || !results || !list) return;
    const refresh = () => {
      $('compareFileAName').textContent = inputA.files?.[0]?.name || 'No first PDF selected';
      $('compareFileBName').textContent = inputB.files?.[0]?.name || 'No second PDF selected';
      button.disabled = !(inputA.files?.[0] && inputB.files?.[0]);
      results.hidden = true;
      setStatus('compare', '', false);
    };
    inputA.addEventListener('change', refresh);
    inputB.addEventListener('change', refresh);
    $('compareReset')?.addEventListener('click', () => { inputA.value = ''; inputB.value = ''; refresh(); });
    button.addEventListener('click', async () => {
      const first = inputA.files?.[0];
      const second = inputB.files?.[0];
      if (!isPdf(first) || !isPdf(second)) return setStatus('compare', 'Choose two PDF files.');
      button.disabled = true;
      list.replaceChildren();
      results.hidden = true;
      try {
        const before = await extractPdfPages(first, message => setStatus('compare', message));
        const after = await extractPdfPages(second, message => setStatus('compare', message));
        const changed = [];
        const maxPages = Math.max(before.length, after.length);
        for (let index = 0; index < maxPages; index++) {
          const hasFirstPage = index < before.length;
          const hasSecondPage = index < after.length;
          const a = hasFirstPage ? before[index] : '';
          const b = hasSecondPage ? after[index] : '';
          if (!hasFirstPage || !hasSecondPage) {
            changed.push({ page: index + 1, a, b, missing: hasFirstPage ? 'Only in first PDF' : 'Only in second PDF' });
            continue;
          }
          const normalize = text => text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
          if (normalize(a) === normalize(b)) continue;
          changed.push({ page: index + 1, a, b, missing: '' });
        }
        const summary = $('compareSummary');
        const textDiffCount = changed.filter(entry => !entry.missing).length;
        const missingPageCount = changed.length - textDiffCount;
        const pageLabel = count => `${count} page${count === 1 ? '' : 's'}`;
        const textDiffSummary = textDiffCount ? `${pageLabel(textDiffCount)} differ by selectable text` : 'No selectable-text differences';
        const missingPageSummary = missingPageCount ? `${pageLabel(missingPageCount)} appear in only one PDF` : 'no pages are missing';
        const pageCountNote = before.length === after.length
          ? `Both PDFs have ${before.length} pages.`
          : `Page counts differ: ${before.length} in the first PDF and ${after.length} in the second.`;
        summary.textContent = changed.length
          ? `${textDiffSummary}; ${missingPageSummary}. ${pageCountNote}`
          : `No differences found in selectable text across ${pageLabel(maxPages)}. ${pageCountNote} Image-only changes are not checked.`;
        if (!changed.length) {
          const item = document.createElement('li');
          item.textContent = 'The extracted text matches. Compare page images separately if the PDFs contain scans or graphics.';
          list.appendChild(item);
        }
        changed.forEach(entry => {
          const item = document.createElement('li');
          const title = document.createElement('strong');
          title.textContent = entry.missing ? `Page ${entry.page} — ${entry.missing}` : `Page ${entry.page} — text differs`;
          item.appendChild(title);
          if (!entry.missing && (!entry.a || !entry.b)) {
            const note = document.createElement('p');
            note.textContent = 'One or both pages have no selectable text; image-only changes may not be detected. Run OCR first for scanned pages.';
            item.appendChild(note);
          } else if (!entry.missing) {
            const delta = firstTextChange(entry.a, entry.b);
            const beforeText = document.createElement('p');
            beforeText.textContent = `First PDF: ${delta.oldPart}`;
            const afterText = document.createElement('p');
            afterText.textContent = `Second PDF: ${delta.newPart}`;
            item.append(beforeText, afterText);
          }
          list.appendChild(item);
        });
        const report = [
          '# FRZ PDF Express — text comparison',
          '',
          `First PDF: ${first.name}`,
          `Second PDF: ${second.name}`,
          `Pages checked: ${maxPages}`,
          `Pages with different extractable text: ${textDiffCount}`,
          `Pages present in only one PDF: ${missingPageCount}`,
          `Page counts: ${before.length} in the first PDF; ${after.length} in the second PDF`,
          '',
          'This report compares selectable text only. It does not compare page images, layout, or visual appearance. Run OCR first for scanned documents.',
          ...changed.flatMap(entry => [``, `## Page ${entry.page}${entry.missing ? ` — ${entry.missing}` : ''}`, ...(entry.missing ? [] : [``, `- First PDF: ${entry.a || '(no selectable text)'}`, `- Second PDF: ${entry.b || '(no selectable text)'}`])]),
        ].join('\n');
        $('compareDownload').onclick = () => download(new TextEncoder().encode(report), 'frz-pdf-comparison.md', 'text/markdown;charset=utf-8');
        results.hidden = false;
        setStatus('compare', `Comparison complete — ${textDiffSummary}; ${missingPageSummary}. Visual-only changes are not checked.`);
      } catch (error) {
        setStatus('compare', `Could not compare these PDFs: ${error.message}`);
      } finally {
        button.disabled = false;
      }
    });
    refresh();
  }

  initCrop();
  initSign();
  initCompare();
})();
