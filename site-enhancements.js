/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations (https://github.com/frz-generations).
 * Created by FRZ Generations as an open-source application, following government open-source guidelines.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 */
(() => {
  'use strict';

  const updateKey = 'frz-pdf-whats-new-2026-10-v14';
  const dialog = document.createElement('dialog');
  dialog.className = 'frz-whats-new';
  dialog.setAttribute('aria-labelledby', 'frzWhatsNewTitle');
  dialog.innerHTML = `
    <div class="frz-whats-new-head">
      <div><p class="frz-whats-new-eyebrow">FRZ PDF Express · October 2026</p><h2 id="frzWhatsNewTitle">What’s new in this update?</h2></div>
      <button class="frz-whats-new-x" type="button" aria-label="Close update notes">×</button>
    </div>
    <div class="frz-whats-new-body" tabindex="0">
      <ul>
        <li><strong>New converters:</strong> Spreadsheet to PDF, PowerPoint to PDF, PDF to PowerPoint, PDF to spreadsheet, Word to PDF, PDF to Word, and PDF to Markdown.</li>
        <li><strong>New PDF tools:</strong> Crop PDF, Sign PDF, and Compare PDFs.</li>
        <li><strong>Phone Scan to PDF:</strong> choose Start rear camera to request access only when you use this tool, capture multiple pages, adjust free crop handles, batch-edit selected pages, choose A4, A5, Letter, or Legal, and create one PDF. Selection targets batch edits; all pages remaining in the collection export in order.</li>
        <li><strong>Find tools faster:</strong> search the 33-tool catalog or filter it by Organize, Convert, Edit &amp; sign, Read &amp; extract, or Compare &amp; improve.</li>
        <li><strong>Edit with confidence:</strong> Ctrl+Z / Ctrl+Y undo and redo, a ⋯ menu on every page (redact text or images, delete, add a blank page, download or open a page), pinch or Ctrl +/- zoom, Ctrl+S saves “name (copy).pdf” and keeps it up to date; you are only asked to save if something really changed. Word to PDF now supports Malayalam.</li>
        <li><strong>Viewer, your way:</strong> hide, pin or auto-hide the toolbar and dock it left, right, top or bottom; night and sepia pages; faster page loading.</li>
        <li><strong>Print your way:</strong> one or both sides, booklets that really continue behind each page, a test sheet, and (desktop app) printer, tray, paper type and quality chosen right here.</li>
        <li><strong>New PDF viewer:</strong> open several PDFs as tabs, jump to any page, copy text and images, highlight, redact or read selected text aloud, and find your recent files again until you clear them.</li>
        <li><strong>Reader and sharing refinements:</strong> zoom now updates the page layout and scroll area, and tool links can be refreshed or shared without losing the selected tool.</li>
        <li><strong>Open-source release:</strong> FRZ PDF Express is now MIT-licensed by FRZ Generations. Exports are clean — no FRZ watermark or footer is added to your files.</li>
        <li><strong>Focused launch:</strong> the update popup no longer opens over direct tool links or PDF-handler launches; use the What’s New button to open it at any time.</li>
        <li><strong>Offline-ready:</strong> the app shell and conversion libraries are cached after loading. OCR language data may need its first online download.</li>
      </ul>
      <p class="frz-whats-new-note">Files stay in your browser. Crop changes the visible page area but does not erase hidden content; signing is a visual stamp; text comparison and Word/Markdown conversion have limits described in each tool.</p>
    </div>
    <div class="frz-whats-new-actions"><button class="frz-whats-new-close" type="button">Got it</button></div>`;

  const css = document.createElement('style');
  css.textContent = `
    .frz-whats-new{width:min(680px,calc(100vw - 28px));max-height:calc(100dvh - 28px);padding:0;border:1px solid var(--gold-line,rgba(201,162,75,.4));border-radius:20px;background:var(--surface,#14171c);color:var(--text,#eae7df);box-shadow:0 26px 90px rgba(0,0,0,.58);font-family:var(--font-body,Inter,Arial,sans-serif)}
    .frz-whats-new::backdrop{background:rgba(3,5,8,.74);backdrop-filter:blur(5px)}
    .frz-whats-new-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding:24px 26px 18px;border-bottom:1px solid var(--border-soft,#1e222a)}
    .frz-whats-new-eyebrow{margin:0 0 6px;color:var(--gold,#c9a24b);font:11px var(--font-mono,monospace);letter-spacing:.09em;text-transform:uppercase}
    .frz-whats-new h2{margin:0;font:600 clamp(22px,4vw,29px) var(--font-display,Georgia,serif)}
    .frz-whats-new-x{border:0;background:transparent;color:var(--text-muted,#93989f);font-size:28px;line-height:1;cursor:pointer}
    .frz-whats-new-body{padding:8px 26px 4px;overflow:auto;max-height:calc(100dvh - 220px)}
    .frz-whats-new-body ul{padding-left:20px;display:grid;gap:12px;line-height:1.55;font-size:14px}
    .frz-whats-new-body strong{color:var(--text,#eae7df)}
    .frz-whats-new-note{font-size:12px;line-height:1.6;color:var(--text-muted,#93989f)}
    .frz-whats-new-actions{padding:14px 26px 22px;display:flex;justify-content:flex-end}
    .frz-whats-new-close{border:1px solid var(--gold,#c9a24b);border-radius:999px;background:var(--gold,#c9a24b);color:#1a1508;font:600 13px var(--font-body,Inter,Arial,sans-serif);padding:10px 20px;cursor:pointer}
    .frz-install-guide{width:min(600px,calc(100vw - 28px));max-height:calc(100dvh - 28px);overflow:auto;padding:24px;border:1px solid var(--gold-line,rgba(201,162,75,.4));border-radius:20px;background:var(--surface,#14171c);color:var(--text,#eae7df);box-shadow:0 26px 90px rgba(0,0,0,.58);font-family:var(--font-body,Inter,Arial,sans-serif)}
    .frz-install-guide::backdrop{background:rgba(3,5,8,.74);backdrop-filter:blur(5px)}
    .frz-install-guide h2{margin:0 0 12px;font:600 clamp(22px,4vw,28px) var(--font-display,Georgia,serif)}
    .frz-install-guide p{font-size:14px;line-height:1.6;color:var(--text-muted,#93989f)}
    .frz-install-guide strong{color:var(--text,#eae7df)}
    @media(max-width:520px){.frz-whats-new-head,.frz-whats-new-body{padding-left:18px;padding-right:18px}.frz-whats-new-body ul{font-size:13px}.frz-install-guide{padding:20px}}
  `;
  document.head.appendChild(css);
  document.body.appendChild(dialog);

  const safeOpen = element => {
    if (typeof element.showModal === 'function') element.showModal();
    else element.setAttribute('open', '');
  };
  const safeClose = element => {
    if (typeof element.close === 'function') element.close();
    else element.removeAttribute('open');
  };
  const closeButton = dialog.querySelector('.frz-whats-new-close');
  const xButton = dialog.querySelector('.frz-whats-new-x');
  const openDialog = () => safeOpen(dialog);
  window.FRZCloseWhatsNew = () => safeClose(dialog);
  document.getElementById('whatsNewBtn')?.addEventListener('click', openDialog);
  closeButton.addEventListener('click', () => safeClose(dialog));
  xButton.addEventListener('click', () => safeClose(dialog));
  dialog.addEventListener('click', event => {
    if (event.target === dialog) safeClose(dialog);
  });
  const shouldAutoOpenUpdate = () => {
    const hash = window.location.hash.toLowerCase();
    return (!hash || hash === '#home') && !window.__frzPdfLaunchPending;
  };
  try {
    if (!localStorage.getItem(updateKey) && shouldAutoOpenUpdate()) {
      window.setTimeout(() => {
        if (!shouldAutoOpenUpdate()) return;
        openDialog();
        localStorage.setItem(updateKey, 'seen');
      }, 700);
    }
  } catch (_) {
    if (shouldAutoOpenUpdate()) window.setTimeout(() => {
      if (shouldAutoOpenUpdate()) openDialog();
    }, 700);
  }

  let deferredInstallPrompt = null;
  document.querySelectorAll('img.brand-mark,img.stamp-logo').forEach(image => {
    image.addEventListener('error', () => {
      if (!image.dataset.localFallback) {
        image.dataset.localFallback = 'true';
        image.src = 'brand-logo.png';
      }
    });
  });
})();
