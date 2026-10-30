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
  printPage: opts => ipcRenderer.invoke('frz:printPage', opts),
  saveCopy: o => ipcRenderer.invoke('frz:saveCopy', o),
  pathForFile: f => { try { return webUtils.getPathForFile(f) || ''; } catch (e) { return ''; } },
});
