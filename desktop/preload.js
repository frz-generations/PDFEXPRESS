/*!
 * FRZ PDF Express — desktop preload
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. MIT License. SPDX-License-Identifier: MIT
 * Exposes a few safe functions to the page: default-PDF-viewer check/request and direct printing.
 */
'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('frzDesktop', {
  isDefaultPdf: () => ipcRenderer.invoke('frz:isDefaultPdf'),
  setDefaultPdf: () => ipcRenderer.invoke('frz:setDefaultPdf'),
  listPrinters: () => ipcRenderer.invoke('frz:listPrinters'),
  printerOptions: name => ipcRenderer.invoke('frz:printerOptions', String(name || '')),
  printPdf: (bytes, opts) => ipcRenderer.invoke('frz:printPdf', bytes, opts),
<<<<<<< HEAD
  printerProps: o => ipcRenderer.invoke('frz:printerProps', o),
  printImages: o => ipcRenderer.invoke('frz:printImages', o),
=======
>>>>>>> 0f24d202aa411c19baf13ae2e4dbe86d860c2ed7
  printPage: opts => ipcRenderer.invoke('frz:printPage', opts),
  saveCopy: o => ipcRenderer.invoke('frz:saveCopy', o),
  pathForFile: f => { try { return webUtils.getPathForFile(f) || ''; } catch (e) { return ''; } },
});
