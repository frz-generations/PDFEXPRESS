/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations (https://github.com/frz-generations).
 * Created by FRZ Generations as an open-source application, following government open-source guidelines.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 */
/* Phone-first, browser-local Scan to PDF experience. Camera access starts only after an explicit tap. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const PDFLib = window.PDFLib;
  const pages = [];
  const PAGE_SIZES = {
    a4: [595.28, 841.89],
    a5: [419.53, 595.28],
    letter: [612, 792],
    legal: [612, 1008],
  };
  const MIN_CROP = 0.06;
  let activeId = null;
  let nextPageId = 1;
  let cameraStream = null;
  let cameraGeneration = 0;
  let pointerEdit = null;

  const panel = $('panel-scan');
  const grid = $('scanPageGrid');
  const frame = $('scanCropStage');
  const cropRect = $('scanCropRect');
  const statusBox = $('scanStatus');
  const statusText = $('scanStatusText');
  const cameraStatus = $('scanCameraStatus');
  const video = $('scanCameraVideo');
  const cameraWrap = $('scanCameraWrap');
  const startCameraButton = $('scanStartCamera');
  const stopCameraButton = $('scanStopCamera');
  const captureButton = $('scanCaptureBtn');
  const photoInput = $('scanPhotoInput');
  const fileInputButton = $('scanPickPhotos');
  const controls = $('scanControls');
  const emptyState = $('scanEmptyState');
  const editor = $('scanEditor');
  const cropImage = $('scanEditImage');
  const selectionCount = $('scanSelectionCount');
  const createButton = $('scanBtn');
  const bwSelected = $('scanBwSelected');
  const threshold = $('scanThreshold');

  if (!panel || !grid || !frame || !cropRect || !video) return;

  function setStatus(message, busy = false) {
    statusText.textContent = message;
    statusBox.classList.toggle('show', Boolean(message));
    statusBox.querySelector('.spinner').hidden = !busy;
  }

  function setCameraMessage(message, isError = false) {
    cameraStatus.textContent = message;
    cameraStatus.classList.toggle('error-text', isError);
    cameraStatus.classList.toggle('show', Boolean(message));
  }

  function selectedPages() { return pages.filter(page => page.selected); }
  function activePage() { return pages.find(page => page.id === activeId) || null; }
  function cropFor(page) { return page.crop; }

  function updateSelectionSummary() {
    const count = selectedPages().length;
    selectionCount.textContent = `${count} of ${pages.length} pages selected for batch edits.`;
    const current = activePage();
    bwSelected.checked = Boolean(current?.blackWhite);
    bwSelected.disabled = count === 0;
  }

  function renderPages() {
    grid.replaceChildren();
    pages.forEach((page, index) => {
      const card = document.createElement('article');
      card.className = `scan-page-card${page.selected ? ' is-selected' : ''}${page.id === activeId ? ' is-active' : ''}`;
      card.dataset.pageId = page.id;

      const selectLabel = document.createElement('label');
      selectLabel.className = 'scan-page-select';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'scan-page-checkbox';
      checkbox.checked = page.selected;
      checkbox.setAttribute('aria-label', `Select page ${index + 1}`);
      const selectText = document.createElement('span');
      selectText.textContent = 'Select';
      selectLabel.append(checkbox, selectText);

      const thumb = document.createElement('img');
      thumb.className = 'scan-page-thumb';
      thumb.src = page.url;
      thumb.alt = `Preview of scan page ${index + 1}`;
      thumb.loading = 'lazy';

      const title = document.createElement('strong');
      title.className = 'scan-page-title';
      title.textContent = `Page ${index + 1}`;
      const filename = document.createElement('span');
      filename.className = 'scan-page-filename';
      filename.textContent = page.file.name;

      const actions = document.createElement('div');
      actions.className = 'scan-page-actions';
      actions.append(
        actionButton('Edit crop', 'edit', page.id, page.id === activeId),
        actionButton('Move up', 'up', page.id, index === 0),
        actionButton('Move down', 'down', page.id, index === pages.length - 1),
        actionButton('Remove', 'remove', page.id, false, true),
      );
      card.append(selectLabel, thumb, title, filename, actions);
      grid.appendChild(card);
    });

    const hasPages = pages.length > 0;
    controls.hidden = !hasPages;
    editor.hidden = !hasPages;
    emptyState.hidden = hasPages;
    createButton.disabled = !hasPages;
    $('scanClear').hidden = !hasPages;
    updateSelectionSummary();
    renderCropEditor();
  }

  function actionButton(label, action, id, disabled = false, danger = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `scan-page-action${danger ? ' is-danger' : ''}`;
    button.dataset.scanAction = action;
    button.dataset.pageId = id;
    button.textContent = label;
    button.disabled = disabled;
    button.setAttribute('aria-label', `${label} page`);
    return button;
  }

  function renderCropEditor() {
    const page = activePage();
    if (!page) {
      cropImage.removeAttribute('src');
      $('scanActivePageLabel').textContent = 'Choose a page to adjust its crop.';
      cropRect.hidden = true;
      return;
    }
    $('scanActivePageLabel').textContent = `Editing page ${pages.indexOf(page) + 1}. Drag the gold corner or edge handles to crop freely.`;
    cropImage.src = page.url;
    cropImage.style.filter = page.blackWhite ? 'grayscale(1) contrast(1.12)' : '';
    cropRect.hidden = false;
    placeCropRect(page.crop);
  }

  function placeCropRect(crop) {
    cropRect.style.left = `${crop.x * 100}%`;
    cropRect.style.top = `${crop.y * 100}%`;
    cropRect.style.width = `${crop.w * 100}%`;
    cropRect.style.height = `${crop.h * 100}%`;
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  async function addImageFile(file) {
    const accepted = file && (/^image\/(jpeg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name));
    if (!accepted) return false;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    try {
      if (typeof image.decode === 'function') await image.decode();
      else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('The image has no readable dimensions.');
      const page = { id: String(nextPageId++), file, url, image, crop: { x: 0, y: 0, w: 1, h: 1 }, blackWhite: false, selected: true };
      pages.push(page);
      activeId = page.id;
      return true;
    } catch (error) {
      URL.revokeObjectURL(url);
      setStatus(`Could not open ${file.name}: ${error.message}`);
      return false;
    }
  }

  async function addFiles(files) {
    const incoming = [...files].filter(file => /^image\/(jpeg|png|webp)$/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name));
    if (!incoming.length) {
      setStatus('Choose JPG, PNG, or WebP photos.');
      return;
    }
    setStatus(`Adding ${incoming.length} photo${incoming.length === 1 ? '' : 's'}…`, true);
    let added = 0;
    for (const file of incoming) if (await addImageFile(file)) added++;
    renderPages();
    setStatus(added ? `Added ${added} page${added === 1 ? '' : 's'}. Select pages to make batch edits, then create one PDF.` : 'No usable photos were added.');
  }

  function handleCardAction(action, id) {
    const index = pages.findIndex(page => page.id === id);
    if (index < 0) return;
    if (action === 'edit') {
      activeId = id;
    } else if (action === 'remove') {
      const [removed] = pages.splice(index, 1);
      URL.revokeObjectURL(removed.url);
      if (activeId === id) activeId = pages[Math.min(index, pages.length - 1)]?.id || null;
    } else if (action === 'up' && index > 0) {
      [pages[index - 1], pages[index]] = [pages[index], pages[index - 1]];
    } else if (action === 'down' && index < pages.length - 1) {
      [pages[index + 1], pages[index]] = [pages[index], pages[index + 1]];
    }
    renderPages();
  }

  function stopCamera(message = '') {
    cameraGeneration++;
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    video.pause();
    video.srcObject = null;
    cameraWrap.hidden = true;
    captureButton.disabled = true;
    captureButton.hidden = true;
    stopCameraButton.hidden = true;
    startCameraButton.hidden = false;
    if (message) setCameraMessage(message);
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setCameraMessage('Camera capture needs a supported browser on HTTPS. You can still choose photos from your device.', true);
      return;
    }
    startCameraButton.disabled = true;
    setCameraMessage('Waiting for camera permission…');
    const generation = ++cameraGeneration;
    try {
      // This is the only getUserMedia call in the app, reached from the explicit button click.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } },
      });
      if (generation !== cameraGeneration || !panel.classList.contains('active') || document.hidden) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      cameraStream = stream;
      video.srcObject = stream;
      cameraWrap.hidden = false;
      await video.play();
      captureButton.hidden = false;
      captureButton.disabled = false;
      stopCameraButton.hidden = false;
      startCameraButton.hidden = true;
      setCameraMessage('Rear camera is ready. Tap Capture photo for each page; tap Stop camera when finished.');
    } catch (error) {
      if (cameraStream) stopCamera();
      const messages = {
        NotAllowedError: 'Camera permission was denied. You can still choose photos instead.',
        NotFoundError: 'No camera was found. You can still choose photos instead.',
        NotReadableError: 'The camera is busy in another app. Close it or choose photos instead.',
        OverconstrainedError: 'The requested rear camera is unavailable. Try another camera or choose photos instead.',
      };
      setCameraMessage(messages[error.name] || `Could not open the camera: ${error.message || 'camera unavailable'}. You can still choose photos instead.`, true);
    } finally {
      startCameraButton.disabled = false;
    }
  }

  async function capturePhoto() {
    if (!cameraStream || !video.videoWidth || !video.videoHeight) return;
    captureButton.disabled = true;
    try {
      const canvas = document.createElement('canvas');
      const cap = 5000;
      const scale = Math.min(1, cap / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not capture this photo.')), 'image/jpeg', 0.92));
      const file = new File([blob], `phone-scan-${String(pages.length + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
      if (await addImageFile(file)) {
        renderPages();
        setStatus(`Captured page ${pages.length}. Capture another page or select pages to batch-edit.`);
      }
    } catch (error) {
      setStatus(`Could not capture a photo: ${error.message}`);
    } finally {
      captureButton.disabled = !cameraStream;
    }
  }

  function applyCropToSelected() {
    const source = activePage();
    const selected = selectedPages();
    if (!source || !selected.length) return setStatus('Select one or more pages to apply the current crop.');
    selected.forEach(page => { page.crop = { ...source.crop }; });
    renderPages();
    setStatus(`Applied page ${pages.indexOf(source) + 1}'s crop to ${selected.length} selected page${selected.length === 1 ? '' : 's'}.`);
  }

  function resetCropForSelected() {
    const selected = selectedPages();
    if (!selected.length) return setStatus('Select one or more pages to reset their crop.');
    selected.forEach(page => { page.crop = { x: 0, y: 0, w: 1, h: 1 }; });
    renderPages();
    setStatus(`Reset the crop on ${selected.length} selected page${selected.length === 1 ? '' : 's'}.`);
  }

  function pointInFrame(event) {
    const rect = frame.getBoundingClientRect();
    return { x: clamp((event.clientX - rect.left) / rect.width, 0, 1), y: clamp((event.clientY - rect.top) / rect.height, 0, 1) };
  }

  function beginCropEdit(event, mode) {
    const page = activePage();
    if (!page || !mode) return;
    event.preventDefault();
    event.stopPropagation();
    pointerEdit = { mode, start: pointInFrame(event), original: { ...page.crop } };
    frame.setPointerCapture?.(event.pointerId);
  }

  function moveCropEdit(event) {
    if (!pointerEdit) return;
    const page = activePage();
    if (!page) return;
    const point = pointInFrame(event);
    const dx = point.x - pointerEdit.start.x;
    const dy = point.y - pointerEdit.start.y;
    const c = { ...pointerEdit.original };
    const mode = pointerEdit.mode;
    if (mode === 'move') {
      c.x = clamp(c.x + dx, 0, 1 - c.w);
      c.y = clamp(c.y + dy, 0, 1 - c.h);
    } else {
      let left = c.x, right = c.x + c.w, top = c.y, bottom = c.y + c.h;
      if (mode.includes('w')) left = clamp(left + dx, 0, right - MIN_CROP);
      if (mode.includes('e')) right = clamp(right + dx, left + MIN_CROP, 1);
      if (mode.includes('n')) top = clamp(top + dy, 0, bottom - MIN_CROP);
      if (mode.includes('s')) bottom = clamp(bottom + dy, top + MIN_CROP, 1);
      c.x = left; c.y = top; c.w = right - left; c.h = bottom - top;
    }
    page.crop = c;
    placeCropRect(c);
  }

  function endCropEdit(event) {
    if (!pointerEdit) return;
    pointerEdit = null;
    if (event?.pointerId != null && frame.hasPointerCapture?.(event.pointerId)) frame.releasePointerCapture(event.pointerId);
    renderPages();
  }

  function moveCropByKeyboard(event, mode) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const page = activePage();
    if (!page) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.05 : 0.01;
    const c = { ...page.crop };
    if (mode === 'move') {
      if (event.key === 'ArrowLeft') c.x -= step;
      if (event.key === 'ArrowRight') c.x += step;
      if (event.key === 'ArrowUp') c.y -= step;
      if (event.key === 'ArrowDown') c.y += step;
      c.x = clamp(c.x, 0, 1 - c.w); c.y = clamp(c.y, 0, 1 - c.h);
    } else {
      let left = c.x, right = c.x + c.w, top = c.y, bottom = c.y + c.h;
      if (mode.includes('w') && event.key === 'ArrowLeft') left = clamp(left - step, 0, right - MIN_CROP);
      if (mode.includes('w') && event.key === 'ArrowRight') left = clamp(left + step, 0, right - MIN_CROP);
      if (mode.includes('e') && event.key === 'ArrowRight') right = clamp(right + step, left + MIN_CROP, 1);
      if (mode.includes('e') && event.key === 'ArrowLeft') right = clamp(right - step, left + MIN_CROP, 1);
      if (mode.includes('n') && event.key === 'ArrowUp') top = clamp(top - step, 0, bottom - MIN_CROP);
      if (mode.includes('n') && event.key === 'ArrowDown') top = clamp(top + step, 0, bottom - MIN_CROP);
      if (mode.includes('s') && event.key === 'ArrowDown') bottom = clamp(bottom + step, top + MIN_CROP, 1);
      if (mode.includes('s') && event.key === 'ArrowUp') bottom = clamp(bottom - step, top + MIN_CROP, 1);
      c.x = left; c.y = top; c.w = right - left; c.h = bottom - top;
    }
    page.crop = c;
    placeCropRect(c);
    renderPages();
  }

  function cropBounds(page) {
    const c = page.crop;
    const width = page.image.naturalWidth, height = page.image.naturalHeight;
    const x = Math.round(c.x * width), y = Math.round(c.y * height);
    const w = Math.max(1, Math.min(width - x, Math.round(c.w * width)));
    const h = Math.max(1, Math.min(height - y, Math.round(c.h * height)));
    return { x, y, w, h };
  }

  function renderCroppedImage(page) {
    const bounds = cropBounds(page);
    const limit = 3600;
    const scale = Math.min(1, limit / Math.max(bounds.w, bounds.h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bounds.w * scale));
    canvas.height = Math.max(1, Math.round(bounds.h * scale));
    const context = canvas.getContext('2d', { alpha: false });
    context.drawImage(page.image, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, canvas.width, canvas.height);
    if (page.blackWhite) {
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      const cutoff = Number(threshold.value) || 145;
      for (let i = 0; i < data.data.length; i += 4) {
        const luminance = data.data[i] * 0.299 + data.data[i + 1] * 0.587 + data.data[i + 2] * 0.114;
        const value = luminance >= cutoff ? 255 : 0;
        data.data[i] = data.data[i + 1] = data.data[i + 2] = value;
      }
      context.putImageData(data, 0, 0);
    }
    return canvas;
  }

  function outputSize(format, imageWidth, imageHeight) {
    const size = [...PAGE_SIZES[format]];
    if (imageWidth > imageHeight && size[1] > size[0]) return [size[1], size[0]];
    if (imageWidth < imageHeight && size[0] > size[1]) return [size[1], size[0]];
    return size;
  }

  async function createPdf() {
    if (!pages.length) return;
    if (!PDFLib?.PDFDocument) return setStatus('The PDF library is not available. Reconnect and reload once, then try again.');
    createButton.disabled = true;
    setStatus(`Creating a ${pages.length}-page PDF…`, true);
    try {
      const pdf = await PDFLib.PDFDocument.create();
      const format = $('scanPageSize').value;
      for (let index = 0; index < pages.length; index++) {
        setStatus(`Preparing page ${index + 1} of ${pages.length}…`, true);
        const canvas = renderCroppedImage(pages[index]);
        const blob = await new Promise((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error(`Could not prepare page ${index + 1}.`)), 'image/jpeg', 0.92));
        const embedded = await pdf.embedJpg(await blob.arrayBuffer());
        const [pageWidth, pageHeight] = outputSize(format, canvas.width, canvas.height);
        const margin = Math.min(24, pageWidth * 0.04, pageHeight * 0.04);
        const scale = Math.min((pageWidth - margin * 2) / embedded.width, (pageHeight - margin * 2) / embedded.height);
        const drawWidth = embedded.width * scale, drawHeight = embedded.height * scale;
        const page = pdf.addPage([pageWidth, pageHeight]);
        page.drawImage(embedded, { x: (pageWidth - drawWidth) / 2, y: (pageHeight - drawHeight) / 2, width: drawWidth, height: drawHeight });
      }
      setStatus('Saving your PDF…', true);
      const bytes = await pdf.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = window.frzActionFilename ? window.frzActionFilename('frz-scanned.pdf') : 'FRZPDF_scanned.pdf';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus(`Created one ${format.toUpperCase()} PDF with ${pages.length} page${pages.length === 1 ? '' : 's'}. Photos stay on your device.`);
    } catch (error) {
      setStatus(`Could not create the PDF: ${error.message}`);
    } finally {
      createButton.disabled = pages.length === 0;
    }
  }

  grid.addEventListener('change', event => {
    if (!event.target.matches('.scan-page-checkbox')) return;
    const id = event.target.closest('[data-page-id]')?.dataset.pageId;
    const page = pages.find(item => item.id === id);
    if (!page) return;
    page.selected = event.target.checked;
    event.target.closest('.scan-page-card')?.classList.toggle('is-selected', page.selected);
    updateSelectionSummary();
  });
  grid.addEventListener('click', event => {
    const button = event.target.closest('[data-scan-action]');
    if (button) handleCardAction(button.dataset.scanAction, button.dataset.pageId);
  });

  $('scanSelectAll').addEventListener('click', () => { pages.forEach(page => { page.selected = true; }); renderPages(); });
  $('scanSelectNone').addEventListener('click', () => { pages.forEach(page => { page.selected = false; }); renderPages(); });
  $('scanApplyCrop').addEventListener('click', applyCropToSelected);
  $('scanResetCrop').addEventListener('click', resetCropForSelected);
  bwSelected.addEventListener('change', () => {
    const selected = selectedPages();
    selected.forEach(page => { page.blackWhite = bwSelected.checked; });
    renderCropEditor();
    setStatus(`Black-and-white ${bwSelected.checked ? 'enabled' : 'disabled'} for ${selected.length} selected page${selected.length === 1 ? '' : 's'}.`);
  });
  $('scanPageSize').addEventListener('change', event => setStatus(`New pages will use ${event.target.options[event.target.selectedIndex].text}.`));
  $('scanClear').addEventListener('click', () => {
    pages.forEach(page => URL.revokeObjectURL(page.url));
    pages.length = 0; activeId = null; renderPages(); setStatus('Removed all scan pages.');
  });
  photoInput.addEventListener('change', async () => {
    if (photoInput.files?.length) await addFiles(photoInput.files);
    photoInput.value = '';
  });
  fileInputButton.addEventListener('click', () => photoInput.click());
  startCameraButton.addEventListener('click', startCamera);
  stopCameraButton.addEventListener('click', () => stopCamera('Camera stopped. Your photos remain on this device.'));
  captureButton.addEventListener('click', capturePhoto);
  createButton.addEventListener('click', createPdf);

  for (const handle of cropRect.querySelectorAll('[data-scan-handle]')) {
    handle.addEventListener('pointerdown', event => beginCropEdit(event, handle.dataset.scanHandle));
    handle.addEventListener('keydown', event => moveCropByKeyboard(event, handle.dataset.scanHandle));
  }
  cropRect.addEventListener('pointerdown', event => {
    if (event.target === cropRect) beginCropEdit(event, 'move');
  });
  frame.addEventListener('pointermove', moveCropEdit);
  frame.addEventListener('pointerup', endCropEdit);
  frame.addEventListener('pointercancel', endCropEdit);
  cropImage.addEventListener('load', () => { const page = activePage(); if (page) placeCropRect(page.crop); });
  document.querySelector('[data-drop="scan"]')?.addEventListener('drop', event => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files?.length) addFiles(files);
  });

  const observer = new MutationObserver(() => {
    if (!panel.classList.contains('active')) stopCamera();
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopCamera('Camera stopped while the app is hidden.'); });
  window.addEventListener('pagehide', () => stopCamera());

  renderPages();
})();
