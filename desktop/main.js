/*!
 * FRZ PDF Express — desktop shell (Electron)
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 *
 * Loads the same offline web app from local files through a private app:// scheme.
 * No network access is needed; navigation away from the app is blocked.
 */
'use strict';
const { app, BrowserWindow, Menu, dialog, shell, protocol, net, session, ipcMain } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const SCHEME = 'app';
const HOST = 'local';
const WWW = app.isPackaged ? path.join(process.resourcesPath, 'www') : path.resolve(__dirname, '..');

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);


/* ---- default PDF viewer detection / request ---- */
const DESKTOP_ID = 'frz-pdf-express.desktop';
const run = (cmd, args) => new Promise(res => execFile(cmd, args, { timeout: 8000, windowsHide: true }, (err, out) => res(err ? '' : String(out))));
async function isDefaultPdf() {
  if (process.platform === 'linux') return (await run('xdg-mime', ['query', 'default', 'application/pdf'])).trim() === DESKTOP_ID;
  if (process.platform === 'win32') {
    const out = await run('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\FileExts\\.pdf\\UserChoice', '/v', 'ProgId']);
    return /frz|pdfexpress/i.test(out);
  }
  return false;
}
async function setDefaultPdf() {
  if (process.platform === 'linux') {
    await run('xdg-mime', ['default', DESKTOP_ID, 'application/pdf']);
    const ok = await isDefaultPdf();
    return { ok, message: ok ? 'Done — PDF files will now open in FRZ PDF Express.' : 'Could not change it automatically. Right-click a PDF, choose Open With, and pick FRZ PDF Express.' };
  }
  if (process.platform === 'win32') {
    shell.openExternal('ms-settings:defaultapps');
    return { ok: false, message: 'Windows Settings opened. Search for “.pdf” and choose FRZ PDF Express. Windows only lets you make this choice yourself.' };
  }
  return { ok: false, message: 'Right-click a PDF, choose Get Info, set “Open with” to FRZ PDF Express and click Change All.' };
}
ipcMain.handle('frz:isDefaultPdf', () => isDefaultPdf());
ipcMain.handle('frz:setDefaultPdf', () => setDefaultPdf());

/* ---------- printing from the viewer (direct to a printer, no system dialog) ---------- */
const os = require('os');
const SAFE = /^[\w.+\-]{1,64}$/;
function parseLpOptions(text) {
  // lines look like:  InputSlot/Media Source: *Auto Tray1 Tray2
  const out = { tray: [], mediaType: [], quality: [] };
  String(text || '').split('\n').forEach(line => {
    const m = line.match(/^([\w-]+)(?:\/([^:]+))?:\s*(.*)$/); if (!m) return;
    const key = m[1], choices = m[3].trim().split(/\s+/).filter(Boolean).map(c => ({ value: c.replace(/^\*/, ''), def: c[0] === '*' })).filter(c => SAFE.test(c.value));
    const bucket = key === 'InputSlot' ? 'tray' : key === 'MediaType' ? 'mediaType' : /^(Resolution|OutputMode|PrintQuality|cupsPrintQuality)$/.test(key) ? 'quality' : null;
    if (bucket && !out[bucket].length) { out[bucket] = choices; if (bucket === 'quality') out.qualityKey = key; }
  });
  return out;
}
const runCmd = (cmd, args) => new Promise(res => execFile(cmd, args, { timeout: 20000 }, (err, stdout, stderr) => res({ err, stdout: String(stdout || ''), stderr: String(stderr || '') })));
const fromMain = e => win && e.sender === win.webContents;
ipcMain.handle('frz:listPrinters', async e => {
  if (!fromMain(e)) return [];
  try { return (await e.sender.getPrintersAsync()).map(p => ({ name: p.name, displayName: p.displayName || p.name, isDefault: !!p.isDefault })); } catch (err) { return []; }
});
ipcMain.handle('frz:printerOptions', async (e, name) => {
  if (!fromMain(e) || typeof name !== 'string') return { direct: false, tray: [], mediaType: [], quality: [] };
  if (process.platform === 'win32') return { direct: false, tray: [], mediaType: [], quality: [] };
  const r = await runCmd('lpoptions', ['-p', name, '-l']);
  return { direct: !r.err, ...parseLpOptions(r.stdout) };
});
/* Vector print through CUPS (Linux, macOS): sends the PDF itself, so text stays sharp. */
ipcMain.handle('frz:printPdf', async (e, bytes, o) => {
  if (!fromMain(e) || !(bytes instanceof Uint8Array || Buffer.isBuffer(bytes)) || !o || typeof o.printer !== 'string') return { ok: false, message: 'Bad request.' };
  if (process.platform === 'win32') return { ok: false, unsupported: true, message: 'Direct PDF printing is not available on Windows.' };
  const known = (await e.sender.getPrintersAsync()).map(p => p.name); if (!known.includes(o.printer)) return { ok: false, message: 'Unknown printer.' };
  const args = ['-d', o.printer, '-n', String(Math.min(99, Math.max(1, parseInt(o.copies, 10) || 1)))];
  const sides = { one: 'one-sided', long: 'two-sided-long-edge', short: 'two-sided-short-edge' }[o.sides] || 'one-sided'; args.push('-o', 'sides=' + sides);
  if (o.tray && SAFE.test(o.tray)) args.push('-o', 'InputSlot=' + o.tray);
  if (o.mediaType && SAFE.test(o.mediaType)) args.push('-o', 'MediaType=' + o.mediaType);
  if (o.quality && SAFE.test(o.quality) && o.qualityKey && SAFE.test(o.qualityKey)) args.push('-o', o.qualityKey + '=' + o.quality);
  else if (o.qualityLevel) args.push('-o', 'print-quality=' + ({ draft: 3, normal: 4, best: 5 }[o.qualityLevel] || 4));
  if (o.color === false) args.push('-o', 'print-color-mode=monochrome');
  if (o.title && typeof o.title === 'string') args.push('-t', o.title.slice(0, 80));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frz-print-')), file = path.join(dir, 'print.pdf');
  fs.writeFileSync(file, Buffer.from(bytes)); args.push('--', file);
  const r = await runCmd('lp', args); setTimeout(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (x) { } }, 10 * 60 * 1000);
  if (r.err) return { ok: false, message: (r.stderr || r.err.message || 'The printer did not accept the job.').trim().slice(0, 300) };
  return { ok: true, message: (r.stdout.match(/request id is (\S+)/) || [])[1] ? 'Sent to ' + o.printer + ' (job ' + RegExp.$1 + ').' : 'Sent to ' + o.printer + '.' };
});
/* Fallback (Windows, or when CUPS is missing): print the page the renderer prepared, silently, to the chosen printer. */
ipcMain.handle('frz:printPage', (e, o) => new Promise(res => {
  if (!fromMain(e) || !o) return res({ ok: false, message: 'Bad request.' });
  const opts = { silent: true, printBackground: true, deviceName: o.printer || '', copies: Math.min(99, Math.max(1, parseInt(o.copies, 10) || 1)), color: o.color !== false, margins: { marginType: 'none' }, landscape: !!o.landscape, duplexMode: o.sides === 'long' ? 'longEdge' : o.sides === 'short' ? 'shortEdge' : 'simplex' };
  if (o.widthMm && o.heightMm) opts.pageSize = { width: Math.round(Math.min(o.widthMm, o.heightMm) * 1000), height: Math.round(Math.max(o.widthMm, o.heightMm) * 1000) };
  e.sender.print(opts, (ok, reason) => res(ok ? { ok: true, message: 'Sent to ' + (o.printer || 'the default printer') + '.' } : { ok: false, message: reason || 'Printing failed.' }));
}));
/* Save the viewer's edited copy next to the original ("name (copy).pdf"), rewriting the same file on later saves. */
const savedTargets = new Set();
ipcMain.handle('frz:saveCopy', async (e, o) => {
  if (!fromMain(e) || !o || !(o.bytes instanceof Uint8Array || Buffer.isBuffer(o.bytes))) return { ok: false, message: 'Bad request.' };
  try {
    let target = '';
    if (typeof o.target === 'string' && savedTargets.has(o.target)) target = o.target;
    else if (typeof o.path === 'string' && /\.pdf$/i.test(o.path) && path.isAbsolute(o.path)) target = path.join(path.dirname(o.path), path.basename(o.path).replace(/\.pdf$/i, '') + ' (copy).pdf');
    else {
      const r = await dialog.showSaveDialog(win, { defaultPath: String(o.name || 'document (copy).pdf').replace(/[\\/:*?"<>|]/g, '_'), filters: [{ name: 'PDF document', extensions: ['pdf'] }] });
      if (r.canceled || !r.filePath) return { ok: false, cancelled: true, message: 'Cancelled.' };
      target = r.filePath;
    }
    if (!/\.pdf$/i.test(target)) target += '.pdf';
    await fs.promises.writeFile(target, Buffer.from(o.bytes)); savedTargets.add(target);
    return { ok: true, path: target };
  } catch (err) { return { ok: false, message: String(err && err.message ? err.message : err) }; }
});
module.exports = { parseLpOptions };

let win = null;
const pendingFiles = [];

function pdfArgs(argv) {
  return argv.slice(app.isPackaged ? 1 : 2).filter(a => /\.pdf$/i.test(a) && fs.existsSync(a));
}

async function openPdfInViewer(file) {
  if (!win) { pendingFiles.push(file); return; }
  try {
    const bytes = await fs.promises.readFile(file);
    const js = `(async () => {
      const b = Uint8Array.from(atob(${JSON.stringify(bytes.toString('base64'))}), c => c.charCodeAt(0));
      const f = new File([b], ${JSON.stringify(path.basename(file))}, { type: 'application/pdf' });
      f.frzPath = ${JSON.stringify(file)};
      if (typeof window.FRZOpenPdfInViewer === 'function') await window.FRZOpenPdfInViewer(f);
    })()`;
    await win.webContents.executeJavaScript(js);
  } catch (err) {
    dialog.showErrorBox('Could not open the PDF', String(err && err.message ? err.message : err));
  }
}

async function chooseAndOpen() {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (!r.canceled && r.filePaths[0]) openPdfInViewer(r.filePaths[0]);
}

function showAbout() {
  dialog.showMessageBox(win, {
    type: 'info',
    title: 'About',
    message: 'FRZ PDF Express ' + app.getVersion(),
    detail: [
      'Open-source PDF, image and document tools that work offline. Files never leave your device.',
      '',
      'Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations.',
      'Sole creators: Faraz Ahammed CM / FRZ Generations.',
      'Released under the MIT License. Third-party components keep their own licences.',
    ].join('\n'),
    buttons: ['OK', 'View licence'],
  }).then(r => { if (r.response === 1) win.loadURL(`${SCHEME}://${HOST}/policies.html#copyright`); });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const tpl = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [
      { label: 'Open PDF…', accelerator: 'CmdOrCtrl+O', click: chooseAndOpen },
      { label: 'All tools', accelerator: 'CmdOrCtrl+Home', click: () => win && win.loadURL(`${SCHEME}://${HOST}/app.html`) },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Help', submenu: [
      { label: 'Policies and accessibility', click: () => win && win.loadURL(`${SCHEME}://${HOST}/policies.html`) },
      { label: 'About', click: showAbout },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 360, minHeight: 480,
    backgroundColor: '#0c0e11',
    title: 'FRZ PDF Express',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false },
  });
  win.loadURL(`${SCHEME}://${HOST}/app.html`);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(mailto|tel):/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`${SCHEME}://${HOST}/`)) {
      e.preventDefault();
      if (/^(mailto|tel):/i.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.once('did-finish-load', () => {
    while (pendingFiles.length) openPdfInViewer(pendingFiles.shift());
  });
  let closing = false, forceClose = false;
  win.on('close', async e => {
    if (forceClose || !win || win.webContents.isDestroyed()) return;
    e.preventDefault();
    if (closing) return;
    closing = true;
    let ok = true;
    try {
      ok = await win.webContents.executeJavaScript(
        "(async()=>{try{if(window.FRZViewerGuard){const r=await window.FRZViewerGuard();if(r)window.__frzForceClose=true;return !!r}return true}catch(e){return true}})()", true);
    } catch (err) { ok = true; }
    closing = false;
    if (ok && win) { forceClose = true; win.close(); }
  });
  win.on('closed', () => { win = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', (_e, argv) => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    pdfArgs(argv).forEach(openPdfInViewer);
  });
  app.on('open-file', (e, file) => { e.preventDefault(); openPdfInViewer(file); });

  app.whenReady().then(() => {
    protocol.handle(SCHEME, req => {
      const u = new URL(req.url);
      if (u.host !== HOST) return new Response('Not found', { status: 404 });
      let rel = decodeURIComponent(u.pathname);
      if (rel === '/' || rel === '') rel = '/app.html';
      if (rel === '/sw.js') return new Response('', { status: 404 }); // offline cache is not needed in the desktop app
      const file = path.normalize(path.join(WWW, rel));
      if (!file.startsWith(WWW + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });

    session.defaultSession.setPermissionRequestHandler((wc, permission, cb, details) => {
      const ok = (permission === 'media' || permission === 'clipboard-sanitized-write') && String(details.requestingUrl || '').startsWith(`${SCHEME}://${HOST}/`);
      cb(ok);
    });
    session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media' || permission === 'clipboard-sanitized-write');

    buildMenu();
    pdfArgs(process.argv).forEach(f => pendingFiles.push(f));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
