/* lazy loader for heavy libraries (keeps phones fast) */
window.frzLoad=(function(){const src={xlsx:'vendor/xlsx.full.min.js',pptx:'vendor/pptxgen.min.js',ocr:'vendor/tesseract/tesseract.min.js'},chk={xlsx:()=>window.XLSX,pptx:()=>window.PptxGenJS||window.pptxgenjs||window.pptxgen,ocr:()=>window.Tesseract},p={};
return function(n){if(chk[n]())return Promise.resolve();if(p[n])return p[n];return p[n]=new Promise((ok,no)=>{const s=document.createElement('script');s.src=src[n];s.onload=()=>ok();s.onerror=()=>{delete p[n];no(new Error('Could not load '+n+' library'))};document.head.appendChild(s)})}})();
/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 *
 * Device detection (phone / tablet / desktop, OS, model, browser) and the website-only
 * "get the official app / install as app" notice. Nothing is sent anywhere: detection is local.
 * The desktop (Electron) app never shows install prompts.
 */
(() => {
  'use strict';
  const OFFICIAL_APP_URL = 'https://github.com/frz-generations'; // set this to the exact releases page of the official app
  const ua = navigator.userAgent || '', uad = navigator.userAgentData;
  const touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || touchMac;
  const isAndroid = /Android/i.test(ua);
  const isTablet = /iPad/.test(ua) || touchMac || (isAndroid && !/Mobile/i.test(ua));
  const isMobile = isIOS || isAndroid || /Mobi|Windows Phone/i.test(ua) || !!(uad && uad.mobile);
  const desktopApp = !!window.frzDesktop;
  const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const browser = /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : /EdgiOS|EdgA|Edg\//.test(ua) ? 'Edge' : /OPiOS|OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox/.test(ua) ? 'Firefox' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'Browser';
  const iosNonSafari = isIOS && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const osName = isIOS ? (/iPad/.test(ua) || touchMac ? 'iPadOS' : 'iOS') : isAndroid ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux|X11/.test(ua) ? 'Linux' : 'Unknown OS';
  let osVer = ''; { const m = isIOS ? /OS (\d+)[_.](\d+)/.exec(ua) : isAndroid ? /Android (\d+(?:\.\d+)?)/.exec(ua) : null; if (m) osVer = isIOS ? m[1] + '.' + m[2] : m[1]; }
  let model = isIOS ? (/iPad/.test(ua) || touchMac ? 'iPad' : 'iPhone') : (isAndroid ? ((/;\s*([^;)]+?)\s+Build\//.exec(ua) || /;\s*([^;)]+?)\)/.exec(ua.replace(/Android [\d.]+;?/, '')) || [])[1] || 'Android device') : '');
  if (model === 'K') model = 'Android device';
  const info = { isMobile, isPhone: isMobile && !isTablet, isTablet, isIOS, isAndroid, os: osName, osVersion: osVer, model, browser, desktopApp, standalone, label: '' };
  const makeLabel = () => { info.label = [info.model || info.os, (info.os + (info.osVersion ? ' ' + info.osVersion : '')).trim(), info.browser].filter((v, i, a) => v && a.indexOf(v) === i).join(' · '); };
  makeLabel();
  window.frzDevice = info;
  const root = document.documentElement;
  root.classList.add(isMobile ? 'frz-mobile' : 'frz-desktop-web'); if (isIOS) root.classList.add('frz-ios'); if (isAndroid) root.classList.add('frz-android'); if (desktopApp) root.classList.add('frz-app'); if (standalone) root.classList.add('frz-standalone');
  if (uad && uad.getHighEntropyValues) uad.getHighEntropyValues(['model', 'platformVersion']).then(v => { if (v.model) info.model = v.model; if (v.platformVersion && isAndroid) info.osVersion = String(parseInt(v.platformVersion, 10) || info.osVersion); makeLabel(); const el = document.getElementById('frzDevLabel'); if (el) el.textContent = info.label; }).catch(() => { });
  if (desktopApp || standalone) return; // installed app or desktop shell: no website notices

  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; render(); });
  window.addEventListener('appinstalled', () => { deferred = null; const b = document.getElementById('frzDevBar'); if (b) b.remove(); });
  const KEY = 'frz-device-bar-dismissed';
  const dismissed = () => { try { return Date.now() - (+localStorage.getItem(KEY) || 0) < 3 * 86400000; } catch (e) { return false; } };
  const css = document.createElement('style');
  css.textContent = `#frzDevBar{position:fixed;left:50%;transform:translateX(-50%);bottom:max(10px,env(safe-area-inset-bottom));z-index:60;width:min(560px,calc(100vw - 20px));box-sizing:border-box;padding:12px 40px 12px 14px;border:1px solid var(--gold-line,#8a7a3a);border-radius:14px;background:var(--surface,#14181f);color:var(--text,#eee);font:500 13px/1.5 var(--font-body,system-ui,sans-serif);box-shadow:0 8px 28px rgba(0,0,0,.45)}
#frzDevBar b{font-weight:600}#frzDevBar a{color:var(--gold,#d4af37)}#frzDevBar .dev{color:var(--text-muted,#9aa);font-size:12px;margin-bottom:4px}
#frzDevBar .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}#frzDevBar button{font:600 13px var(--font-body,system-ui);border-radius:9px;padding:8px 14px;min-height:36px;cursor:pointer;border:1px solid var(--border,#444);background:var(--surface-2,#222);color:var(--text,#eee)}
#frzDevBar button.primary{background:var(--gold,#d4af37);color:#1a1508;border-color:var(--gold,#d4af37)}#frzDevBar .x{position:absolute;top:6px;right:6px;padding:0;width:32px;min-height:32px;border:0;background:transparent;font-size:16px}
#frzDevBar .note{margin:6px 0 0;color:var(--text-muted,#9aa);font-size:12.5px}
body.viewer-open #frzDevBar,html.frz-hide-devbar #frzDevBar{display:none}`;
  document.head.appendChild(css);
  function render() {
    if (dismissed()) return; let bar = document.getElementById('frzDevBar');
    if (!bar) { bar = document.createElement('div'); bar.id = 'frzDevBar'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Get the app'); document.body.appendChild(bar); }
    const canPrompt = !!deferred; let action = '', note = '';
    if (isIOS && iosNonSafari) note = 'This device can’t install this app from ' + browser + ' — please use the Safari browser, then tap Share → Add to Home Screen.';
    else if (isIOS) { action = '<button type="button" class="primary" id="frzInst">Install as app</button>'; note = ''; }
    else if (canPrompt) action = '<button type="button" class="primary" id="frzInst">Install as app</button>';
    else if (isAndroid) note = 'To install: open the ' + browser + ' menu (⋮) and choose “Install app” or “Add to Home screen”. If you don’t see it, this browser can’t install the app — use Chrome.';
    else if (!isMobile) note = 'You can also install it from your browser’s address bar (the install icon), or use the desktop app.';
    bar.innerHTML = `<button type="button" class="x" id="frzDevX" aria-label="Close">✕</button><div class="dev">Detected: <span id="frzDevLabel">${info.label.replace(/[<&>]/g, '')}</span></div><div>You’re using the website. <b>Download the official app</b> from <a href="${OFFICIAL_APP_URL}" target="_blank" rel="noopener">FRZ Generations</a>${isMobile ? ', or press <b>Install as app</b> to add it to your phone.' : '.'}</div><div class="acts">${action}</div>${note ? '<p class="note" id="frzNote">' + note + '</p>' : '<p class="note" id="frzNote" hidden></p>'}`;
    bar.querySelector('#frzDevX').onclick = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { } bar.remove(); };
    const inst = bar.querySelector('#frzInst');
    if (inst) inst.onclick = async () => {
      if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch (e) { } deferred = null; bar.remove(); return; }
      const n = bar.querySelector('#frzNote'); n.hidden = false; n.textContent = isIOS ? 'On iPhone / iPad: tap the Share button (square with an arrow) in Safari, then “Add to Home Screen”.' : 'Open your browser menu and choose “Install app”.';
    };
  }
  const start = () => setTimeout(render, 1800);
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
