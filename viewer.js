/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 *
 * PDF viewer: tabs, recent files (kept until cleared), go-to-page, selectable/copyable text,
 * copy area as image, highlight / redact / read aloud on selected text, and the
 * "set as default PDF viewer" prompt (desktop app only, and only when it is not the default).
 * Pages stay vector: nothing is flattened except pages you redact when saving.
 */
(() => {
  'use strict';
  const panel = document.getElementById('panel-viewer');
  if (!panel || !window.pdfjsLib || !window.PDFLib) return;
  const ws = panel.querySelector('.workspace');
  if (!ws) return;

  /* ---------- markup ---------- */
  const css = document.createElement('style');
  css.textContent = `
  #panel-viewer .workspace{padding:0 12px 12px}
  .vw-top{display:flex;align-items:center;gap:12px;padding:8px 0}
  .vw-top .vw-title{font:600 15px var(--font-display);flex:1}
  .vw-top .vw-back{background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:9px;padding:8px 12px;cursor:pointer;font:600 13px var(--font-body);min-height:38px}
  .vw-top .bulb-toggle{width:40px;height:44px;margin:0;align-items:center}
  .vw-top .bulb-toggle .cord{display:none}
  .vw-top .bulb-toggle svg{width:22px;height:34px;margin:0}
  .vw-bar button.vw-print{background:var(--gold);color:#1a1508;border-color:var(--gold);font-weight:700}
  .vw-tabs{display:flex;gap:4px;align-items:flex-end;overflow-x:auto;padding:8px 0 0;border-bottom:1px solid var(--border);scrollbar-width:thin}
  .vw-tab{display:flex;align-items:center;gap:6px;max-width:220px;min-width:90px;padding:7px 8px 7px 12px;border:1px solid var(--border);border-bottom:0;border-radius:8px 8px 0 0;background:var(--surface);color:var(--text-muted);font:500 12.5px var(--font-body);cursor:pointer;white-space:nowrap}
  .vw-tab[aria-selected="true"]{background:var(--surface-2);color:var(--text);border-color:var(--gold-line)}
  .vw-tab .t{overflow:hidden;text-overflow:ellipsis;flex:1;text-align:left}
  .vw-tab .x{border:0;background:transparent;color:inherit;cursor:pointer;font-size:16px;line-height:1;padding:2px 5px;border-radius:5px}
  .vw-tab .x:hover{background:var(--gold-soft)}
  .vw-tab-add{padding:6px 12px;border:1px solid var(--border);border-radius:8px 8px 0 0;background:transparent;color:var(--text);cursor:pointer;font-size:16px}
  #vwDoc{position:relative;display:flex;gap:8px;height:calc(100dvh - 120px);min-height:340px;padding-top:8px}
  @media(max-width:760px){
    #vwDoc .vw-bar{flex-wrap:wrap!important;overflow:visible;padding:5px;gap:4px 6px;max-height:none}
    #vwDoc .vw-bar .grp{flex-wrap:wrap;flex:0 1 auto;padding-right:6px;gap:2px}
    #vwDoc .vw-bar .grp.end{margin-left:0}
    #vwDoc{height:calc(100dvh - 110px)}
    #vwDoc .vw-bar button{padding:4px 6px}
    #vwDoc .vw-bar input[type=number]{width:46px}
    #vwDoc .vw-bar .lb,#vwDoc .vw-bar .lbl{display:none}
    #vwDock L,#vwDockL,#vwDockT,#vwDockR,#vwDockB{display:none}
    #vwDoc .vw-bar button{min-width:38px;min-height:38px}
    .frz-print-dialog{width:100vw!important;max-height:100dvh!important;border-radius:0!important}
  }
  #vwDoc[data-dock="top"]{flex-direction:column}
  #vwDoc[data-dock="bottom"]{flex-direction:column-reverse}
  #vwDoc[data-dock="left"]{flex-direction:row}
  #vwDoc[data-dock="right"]{flex-direction:row-reverse}
  .vw-bar{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;padding:6px 8px;background:var(--surface);border:1px solid var(--border);border-radius:12px;z-index:6;box-shadow:0 4px 18px rgba(0,0,0,.18)}
  .vw-bar .grp{display:flex;gap:3px;align-items:center;padding-right:10px;border-right:1px solid var(--border-soft)}
  .vw-bar .grp:last-child{border-right:0;padding-right:0}
  .vw-bar .grp.end{margin-left:auto}
  .vw-bar .lbl,.vw-bar .of{font-size:12px;color:var(--text-muted);margin:0 2px}
  .vw-bar button,.vw-bar input{font:500 12.5px var(--font-body)}
  .vw-bar button{display:inline-flex;align-items:center;gap:6px;background:transparent;border:1px solid transparent;color:var(--text);border-radius:8px;padding:6px 9px;cursor:pointer;min-height:34px;min-width:34px;justify-content:center}
  .vw-bar button:hover{background:var(--surface-2);border-color:var(--border)}
  .vw-bar button:focus-visible,.vw-handle:focus-visible{outline:2px solid var(--gold);outline-offset:1px}
  .vw-bar button[aria-pressed="true"]{background:var(--gold-soft);border-color:var(--gold-line);color:var(--text)}
  .vw-bar button.vw-print{background:var(--gold);color:#1a1508;border-color:var(--gold);font-weight:700}
  .vw-bar input[type=number]{width:58px;background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:6px 6px;min-height:34px}
  #vwDoc[data-labels="0"] .vw-bar .lb{display:none}
  #vwDoc[data-dock="left"] .vw-bar,#vwDoc[data-dock="right"] .vw-bar{flex-direction:column;flex-wrap:nowrap;align-items:stretch;overflow-y:auto;overflow-x:hidden;width:max-content;max-width:190px}
  #vwDoc[data-dock="left"] .vw-bar .grp,#vwDoc[data-dock="right"] .vw-bar .grp{flex-wrap:wrap;border-right:0;padding:0 0 8px;border-bottom:1px solid var(--border-soft);justify-content:center}
  #vwDoc[data-dock="left"] .vw-bar .grp.end,#vwDoc[data-dock="right"] .vw-bar .grp.end{margin:auto 0 0;border-bottom:0}
  #vwDoc[data-dock="left"] .vw-bar .lbl,#vwDoc[data-dock="right"] .vw-bar .lbl{display:none}
  #vwDoc[data-dock="left"] .vw-bar .lb,#vwDoc[data-dock="right"] .vw-bar .lb{display:none}
  #vwDoc[data-dock="left"] .vw-bar input[type=number],#vwDoc[data-dock="right"] .vw-bar input[type=number]{width:52px}
  /* hidden / auto-hide modes */
  #vwDoc[data-mode="hidden"] .vw-bar,#vwDoc[data-mode="hidden"] .vw-edge{display:none}
  #vwDoc[data-mode="pinned"] .vw-handle,#vwDoc[data-mode="pinned"] .vw-edge{display:none}
  .vw-handle{position:absolute;z-index:7;display:flex;align-items:center;justify-content:center;width:34px;height:26px;border-radius:8px;border:1px solid var(--gold-line);background:var(--surface);color:var(--text);cursor:pointer;opacity:.75;box-shadow:0 2px 10px rgba(0,0,0,.25)}
  .vw-handle:hover{opacity:1}
  #vwDoc[data-dock="top"] .vw-handle{top:14px;left:50%;transform:translateX(-50%)}
  #vwDoc[data-dock="bottom"] .vw-handle{bottom:6px;left:50%;transform:translateX(-50%) rotate(180deg)}
  #vwDoc[data-dock="left"] .vw-handle{left:6px;top:50%;transform:translateY(-50%) rotate(-90deg)}
  #vwDoc[data-dock="right"] .vw-handle{right:6px;top:50%;transform:translateY(-50%) rotate(90deg)}
  #vwDoc[data-mode="auto"] .vw-bar{position:absolute;z-index:8;transition:transform .18s ease,opacity .18s ease;opacity:0;pointer-events:none}
  #vwDoc[data-mode="auto"][data-dock="top"] .vw-bar{top:8px;left:0;right:0;transform:translateY(-120%)}
  #vwDoc[data-mode="auto"][data-dock="bottom"] .vw-bar{bottom:0;left:0;right:0;transform:translateY(120%)}
  #vwDoc[data-mode="auto"][data-dock="left"] .vw-bar{top:8px;bottom:0;left:0;transform:translateX(-120%)}
  #vwDoc[data-mode="auto"][data-dock="right"] .vw-bar{top:8px;bottom:0;right:0;transform:translateX(120%)}
  #vwDoc[data-mode="auto"] .vw-edge{position:absolute;z-index:7;background:transparent}
  #vwDoc[data-mode="auto"][data-dock="top"] .vw-edge{top:8px;left:0;right:0;height:14px}
  #vwDoc[data-mode="auto"][data-dock="bottom"] .vw-edge{bottom:0;left:0;right:0;height:14px}
  #vwDoc[data-mode="auto"][data-dock="left"] .vw-edge{top:8px;bottom:0;left:0;width:14px}
  #vwDoc[data-mode="auto"][data-dock="right"] .vw-edge{top:8px;bottom:0;right:0;width:14px}
  #vwDoc[data-mode="auto"] .vw-edge:hover+.vw-bar,#vwDoc[data-mode="auto"] .vw-bar:hover,#vwDoc[data-mode="auto"] .vw-bar:has(:focus-visible),#vwDoc[data-mode="auto"][data-peek="1"] .vw-bar{transform:none;opacity:1;pointer-events:auto}
  #vwDoc[data-mode="auto"] .vw-edge:hover{pointer-events:auto}
  .vw-menu{position:absolute;z-index:30;right:8px;top:56px;display:grid;gap:10px;width:min(300px,calc(100% - 16px));padding:14px;background:var(--surface);border:1px solid var(--gold-line);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.4)}
  .vw-menu[hidden]{display:none}
  .vw-menu label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--text-muted)}
  .vw-menu label:has(input[type=checkbox]){flex-direction:row;align-items:center;gap:8px;font-size:13px;color:var(--text)}
  .vw-menu select{background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:7px;font:500 13px var(--font-body)}
  .vw-menu button{background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:8px;padding:8px;cursor:pointer;font:600 12.5px var(--font-body)}
  .vw-scroll{flex:1;min-width:0;min-height:0;height:auto;overflow:auto;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 0;position:relative;scroll-behavior:auto}
  .vw-scroll[data-look="night"]{background:#14161a}
  .vw-scroll[data-look="night"] .vw-page canvas{filter:invert(.9) hue-rotate(180deg)}
  .vw-scroll[data-look="sepia"]{background:#e8dfca}
  .vw-scroll[data-look="sepia"] .vw-page canvas{filter:sepia(.4) brightness(.97)}
  .vw-page{position:relative;margin:0 auto var(--vw-gap,14px);background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.35)}
  .vw-page canvas{display:block}
  .vw-more{position:absolute;right:8px;bottom:8px;z-index:3;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid rgba(0,0,0,.18);background:rgba(255,255,255,.92);color:#222;cursor:pointer;opacity:.55;box-shadow:0 2px 8px rgba(0,0,0,.2)}
  .vw-page:hover .vw-more,.vw-more:focus-visible{opacity:1}
  .vw-more:hover{background:#fff;opacity:1}
  .vw-pmenu{position:fixed;z-index:20000;min-width:250px;padding:6px;background:var(--surface-2);border:1px solid var(--gold-line);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.45)}
  .vw-pmenu[hidden]{display:none}
  .vw-pmenu button{display:block;width:100%;text-align:left;background:transparent;border:0;color:var(--text);font:500 13px var(--font-body);padding:8px 10px;border-radius:8px;cursor:pointer}
  .vw-pmenu button:hover,.vw-pmenu button:focus-visible{background:var(--gold-soft);outline:none}
  .vw-pmenu hr{border:0;border-top:1px solid var(--border-soft);margin:5px 4px}
  .vw-scroll{touch-action:pan-x pan-y}

  .vw-ann{position:absolute;inset:0;pointer-events:none}
  .vw-ann div{position:absolute}
  .vw-ann .hl{background:rgba(255,222,0,.42);mix-blend-mode:multiply}
  .vw-ann .rd{background:#000}
  .vw-text{position:absolute;inset:0;overflow:hidden;line-height:1;text-size-adjust:none;user-select:text;-webkit-user-select:text}
  .vw-text span,.vw-text br{color:transparent;position:absolute;white-space:pre;cursor:text;transform-origin:0 0}
  .vw-text ::selection{background:rgba(40,110,255,.38)}
  .vw-area .vw-text{pointer-events:none}
  .vw-area .vw-page{cursor:crosshair}
  .vw-sel{position:absolute;border:2px dashed #2f7bff;background:rgba(47,123,255,.15);pointer-events:none}
  .vw-pop{position:fixed;z-index:20000;display:none;gap:4px;padding:5px;background:var(--surface-2);border:1px solid var(--gold-line);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.45)}
  .vw-pop button{background:transparent;border:0;color:var(--text);font:500 12.5px var(--font-body);padding:7px 10px;border-radius:7px;cursor:pointer}
  .vw-pop button:hover,.vw-pop button:focus-visible{background:var(--gold-soft)}
  .vw-recent h3{font:600 15px var(--font-display);margin:22px 0 8px}
  .vw-recent ul{list-style:none;padding:0;margin:0;display:grid;gap:6px}
  .vw-recent li{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:9px;background:var(--surface)}
  .vw-recent li .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .vw-recent li .m{color:var(--text-faint);font-size:11.5px;white-space:nowrap}
  .vw-recent button{background:var(--surface-2);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:6px 10px;cursor:pointer;font:500 12px var(--font-body)}
  .vw-msg{font-size:12px;color:var(--text-muted);min-height:18px;margin:4px 0}
  #vwDoc>.vw-msg{position:absolute;z-index:25;left:50%;bottom:14px;transform:translateX(-50%);margin:0;padding:7px 14px;border-radius:999px;background:var(--surface-2);border:1px solid var(--gold-line);color:var(--text);box-shadow:0 6px 20px rgba(0,0,0,.3);pointer-events:none;max-width:90%}
  #vwDoc>.vw-msg:empty{display:none}
  .frz-default-dialog{width:min(460px,calc(100vw - 28px));padding:22px;border:1px solid var(--gold-line);border-radius:14px;background:var(--surface);color:var(--text)}
  .frz-default-dialog::backdrop{background:rgba(3,5,8,.7)}
  .frz-default-dialog h2{margin:0 0 8px;font:600 21px var(--font-display)}
  .frz-default-dialog p{color:var(--text-muted);font-size:14px;line-height:1.55}
  .frz-default-dialog .row{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}
  @media (max-width:640px){#vwDoc{height:calc(100dvh - 150px)}}`;
  document.head.appendChild(css);

  ws.innerHTML = `
    <div class="vw-tabs" id="vwTabs" role="tablist" aria-label="Open PDFs"></div>
    <input type="file" id="vwFile" accept="application/pdf,.pdf" multiple hidden>
    <div id="vwHome">
      <div class="dropzone" id="vwDrop"><div class="dz-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg></div>
        <h4>Drop PDFs here, or click to choose</h4><p>Open several at once — each opens in its own tab. Nothing is uploaded.</p></div>
      <div class="vw-recent" id="vwRecent" hidden>
        <h3>Recent files <button type="button" id="vwClear" style="margin-left:8px">Clear history</button></h3>
        <div class="vw-msg" id="vwRecentMsg" role="status" aria-live="polite"></div>
        <ul id="vwRecentList"></ul>
      </div>
    </div>
    <div id="vwDoc" hidden>
      <button type="button" class="vw-handle" id="vwShow" aria-label="Show toolbar" title="Show toolbar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>
      <div class="vw-edge" id="vwEdge" aria-hidden="true"></div>
      <div class="vw-bar" id="vwBar" role="toolbar" aria-label="PDF tools">
        <div class="grp" role="group" aria-label="Zoom"><button type="button" id="vwZout" aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg><span class="lb"></span></button><button type="button" id="vwZlabel" aria-label="Fit to width" title="Fit to width">100%</button><button type="button" id="vwZin" aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span class="lb"></span></button></div>
        <div class="grp" role="group" aria-label="Pages"><button type="button" id="vwPrev" aria-label="Previous page" title="Previous page"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg><span class="lb"></span></button>
          <label for="vwGo" class="lbl">Page</label><input type="number" id="vwGo" min="1" value="1" aria-label="Go to page"><span class="of" id="vwOf"></span>
          <button type="button" id="vwGoBtn" aria-label="Go to that page">Go</button><button type="button" id="vwNext" aria-label="Next page" title="Next page"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg><span class="lb"></span></button></div>
        <div class="grp" role="group" aria-label="Selection mode"><button type="button" id="vwModeText" aria-label="Select text" title="Select text" aria-pressed="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6M12 4v16M9 20h6"/></svg><span class="lb">Select text</span></button><button type="button" id="vwModeArea" aria-label="Copy area as image" title="Copy area as image" aria-pressed="false"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/></svg><span class="lb">Copy area</span></button></div>
        <div class="grp" role="group" aria-label="Read aloud"><button type="button" id="vwRead" aria-label="Read aloud" title="Read aloud"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg><span class="lb">Read aloud</span></button><button type="button" id="vwStop" aria-label="Stop reading" title="Stop reading"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="7" width="10" height="10" rx="1.5"/></svg><span class="lb">Stop</span></button></div>
        <div class="grp" role="group" aria-label="Page actions"><button type="button" id="vwPageImg" aria-label="Copy page as image" title="Copy page as image"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 8"/></svg><span class="lb">Copy page</span></button><button type="button" id="vwSave" aria-label="Save a copy" title="Save a copy"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h11l3 3v15H5zM8 3v5h7M8 21v-6h8v6"/></svg><span class="lb">Save copy</span></button><button type="button" id="vwPrint" aria-label="Print (Ctrl+P)" title="Print (Ctrl+P)" class="vw-print"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-6h16v6h-3"/><path d="M7 14h10v7H7z"/></svg><span class="lb">Print</span></button></div>
        <div class="grp end" role="group" aria-label="Toolbar"><button type="button" id="vwPin" aria-label="Keep toolbar pinned" title="Keep toolbar pinned" aria-pressed="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 17v5M9 3h6l-1 6 3 3H7l3-3z"/></svg><span class="lb"></span></button><button type="button" id="vwHide" aria-label="Hide toolbar" title="Hide toolbar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg><span class="lb"></span></button>
          <button type="button" id="vwDockL" aria-label="Move toolbar to the left" title="Move toolbar to the left"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg><span class="lb"></span></button><button type="button" id="vwDockT" aria-label="Move toolbar to the top" title="Move toolbar to the top"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/></svg><span class="lb"></span></button><button type="button" id="vwDockR" aria-label="Move toolbar to the right" title="Move toolbar to the right"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg><span class="lb"></span></button><button type="button" id="vwDockB" aria-label="Move toolbar to the bottom" title="Move toolbar to the bottom"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15h18"/></svg><span class="lb"></span></button><button type="button" id="vwCust" aria-label="Customize the viewer" title="Customize the viewer" aria-haspopup="true" aria-expanded="false"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg><span class="lb"></span></button></div>
      </div>
      <div class="vw-menu" id="vwMenu" role="dialog" aria-label="Customize the viewer" hidden>
        <label>Toolbar position <select id="vwOptDock"><option value="top">Top</option><option value="bottom">Bottom</option><option value="left">Left</option><option value="right">Right</option></select></label>
        <label>Toolbar <select id="vwOptMode"><option value="pinned">Always visible (pinned)</option><option value="auto">Auto-hide, show on hover</option><option value="hidden">Hidden</option></select></label>
        <label><input type="checkbox" id="vwOptLabels"> Show button names</label>
        <label>Page look <select id="vwOptLook"><option value="normal">Normal</option><option value="night">Night (dark pages)</option><option value="sepia">Sepia (easy on the eyes)</option></select></label>
        <label>Space between pages <select id="vwOptGap"><option value="4">Tight</option><option value="14">Normal</option><option value="28">Wide</option></select></label>
        <label>When a PDF opens <select id="vwOptFit"><option value="width">Fit to width</option><option value="actual">Actual size (100%)</option></select></label>
        <button type="button" id="vwOptReset">Reset to defaults</button>
      </div>
      <div class="vw-msg" id="vwMsg" role="status" aria-live="polite"></div>
      <div class="vw-scroll" id="vwScroll" tabindex="0" aria-label="PDF pages"></div>
    </div>`;
  const pop = document.createElement('div');
  pop.className = 'vw-pop'; pop.setAttribute('role', 'toolbar'); pop.setAttribute('aria-label', 'Selection actions');
  pop.innerHTML = '<button type="button" data-a="copy">Copy</button><button type="button" data-a="hl">Highlight</button><button type="button" data-a="rd">Redact</button><button type="button" data-a="read">Read aloud</button><button type="button" data-a="img" hidden>Copy as image</button>';
  document.body.appendChild(pop);

  const $ = id => document.getElementById(id);
  const tabsEl = $('vwTabs'), homeEl = $('vwHome'), docEl = $('vwDoc'), scrollEl = $('vwScroll'), msgEl = $('vwMsg');
  let sayT = 0; const say = t => { msgEl.textContent = t || ''; clearTimeout(sayT); if (t) sayT = setTimeout(() => { msgEl.textContent = ''; }, 5000); };
  const fmtSize = b => b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  const getBytes = async t => t.bytes || (t.bytes = new Uint8Array(await t.file.arrayBuffer()));
  let uid = 0; const tabs = []; let active = null; let mode = 'text'; let io = null; let seq = 0;

  /* ---------- recent files (IndexedDB, kept until the user clears them) ---------- */
  const DB = { db: null, ok: true,
    open() { return new Promise(res => { if (this.db) return res(this.db); try { const r = indexedDB.open('frz-viewer', 1); r.onupgradeneeded = () => r.result.createObjectStore('recent', { keyPath: 'key' }); r.onsuccess = () => { this.db = r.result; res(this.db); }; r.onerror = () => { this.ok = false; res(null); }; } catch (e) { this.ok = false; res(null); } }); },
    async tx(mode, fn) { const db = await this.open(); if (!db) return null; return new Promise(res => { try { const t = db.transaction('recent', mode), s = t.objectStore('recent'); const out = fn(s); t.oncomplete = () => res(out && out.result !== undefined ? out.result : true); t.onerror = t.onabort = () => res(null); } catch (e) { res(null); } }); },
    all() { return this.tx('readonly', s => s.getAll()); },
    put(rec) { return this.tx('readwrite', s => s.put(rec)); },
    del(key) { return this.tx('readwrite', s => s.delete(key)); },
    clear() { return this.tx('readwrite', s => s.clear()); },
  };
  async function remember(file) {
    const key = file.name + '|' + file.size;
    await DB.put({ key, name: file.name, size: file.size, opened: Date.now(), blob: file });
    const list = (await DB.all()) || []; list.sort((a, b) => b.opened - a.opened);
    let total = 0; const MAX_N = 30, MAX_B = 400 * 1048576;
    for (let i = 0; i < list.length; i++) { total += list[i].size; if (i >= MAX_N || total > MAX_B) await DB.del(list[i].key); }
  }
  async function renderRecent() {
    const box = $('vwRecent'), ul = $('vwRecentList'); ul.textContent = '';
    const list = ((await DB.all()) || []).sort((a, b) => b.opened - a.opened);
    box.hidden = !list.length; if (!list.length) return;
    list.forEach(r => {
      const li = document.createElement('li');
      const n = document.createElement('span'); n.className = 'n'; n.textContent = r.name; n.title = r.name;
      const m = document.createElement('span'); m.className = 'm'; m.textContent = `${fmtSize(r.size)} · ${new Date(r.opened).toLocaleDateString()}`;
      const o = document.createElement('button'); o.type = 'button'; o.textContent = 'Open'; o.setAttribute('aria-label', 'Open ' + r.name);
      o.onclick = () => openFiles([new File([r.blob], r.name, { type: 'application/pdf' })], true);
      const x = document.createElement('button'); x.type = 'button'; x.textContent = 'Remove'; x.setAttribute('aria-label', 'Remove ' + r.name + ' from history');
      x.onclick = async () => { await DB.del(r.key); renderRecent(); };
      li.append(n, m, o, x); ul.appendChild(li);
    });
  }
  $('vwClear').onclick = async () => { if (!confirm('Clear the list of recently opened PDFs on this device?')) return; await DB.clear(); $('vwRecentMsg').textContent = 'History cleared.'; renderRecent(); };

  /* ---------- tabs ---------- */
  function drawTabs() {
    tabsEl.textContent = '';
    tabs.forEach(t => {
      const b = document.createElement('div'); b.className = 'vw-tab'; b.setAttribute('role', 'tab'); b.tabIndex = t === active ? 0 : -1; b.setAttribute('aria-selected', t === active ? 'true' : 'false'); b.title = t.name;
      const s = document.createElement('span'); s.className = 't'; s.textContent = (isDirty(t) ? '● ' : '') + t.name;
      const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.textContent = '×'; x.setAttribute('aria-label', 'Close ' + t.name);
      x.onclick = e => { e.stopPropagation(); closeTab(t); };
      b.append(s, x);
      b.onclick = () => activate(t);
      b.onauxclick = e => { if (e.button === 1) closeTab(t); };
      b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(t); } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const i = tabs.indexOf(t) + (e.key === 'ArrowRight' ? 1 : -1); if (tabs[i]) { activate(tabs[i]); setTimeout(() => tabsEl.querySelector('[aria-selected="true"]')?.focus(), 0); } } };
      tabsEl.appendChild(b);
    });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'vw-tab-add'; add.textContent = '+'; add.setAttribute('aria-label', 'Open another PDF'); add.title = 'Open another PDF';
    add.onclick = () => $('vwFile').click(); tabsEl.appendChild(add);
  }
  function showHome() { active = null; docEl.hidden = true; homeEl.hidden = false; drawTabs(); renderRecent(); hidePop(); }
  async function activate(t) {
    if (active && active !== t) active.scrollTop = scrollEl.scrollTop;
    active = t; homeEl.hidden = true; docEl.hidden = false; drawTabs(); say(''); hidePop();
    scrollEl.textContent = ''; if (io) io.disconnect();
    await layout(t); scrollEl.scrollTop = t.scrollTop || 0; updateInfo();
  }

  /* ---------- opening files ---------- */
  async function openFiles(files, fromRecent, insertAfter) {
    if (location.hash !== '#viewer') location.hash = '#viewer';
    const list = [].concat(files).filter(f => f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)));
    for (const f of list) {
      try {
        const url = URL.createObjectURL(f);
        const opts = { url, disableAutoFetch: true, isEvalSupported: false };
        let task = pdfjsLib.getDocument(opts);
        let encrypted = false;
        task.onPassword = (update, reason) => { encrypted = true; const p = window.prompt(reason === 2 ? 'Wrong password. Try again:' : 'This PDF is password protected. Enter the password:'); if (p === null) task.destroy(); else update(p); };
        let pdf;
        try { pdf = await task.promise; }
        catch (err) { if (encrypted || /password|destroyed/i.test(String(err && (err.name + err.message)))) throw err; const buf = await f.arrayBuffer(); task = pdfjsLib.getDocument({ data: new Uint8Array(buf) }); pdf = await task.promise; }
        const t = { id: ++seq, name: f.name, size: f.size, file: f, url, bytes: null, pdf, n: pdf.numPages, scale: 0, ann: {}, encrypted, scrollTop: 0, pages: [], path: f.frzPath || (window.frzDesktop && window.frzDesktop.pathForFile ? window.frzDesktop.pathForFile(f) : '') || '' };
        t.order = Array.from({ length: pdf.numPages }, (_, k) => ({ id: ++uid, src: k })); initHist(t);
        if (insertAfter && tabs.includes(insertAfter)) tabs.splice(tabs.indexOf(insertAfter) + 1, 0, t); else tabs.push(t); if (!fromRecent || true) remember(f);
        await activate(t);
      } catch (e) { if (!/destroyed|password/i.test(String(e && e.message))) alert('Could not open ' + f.name + ': ' + (e && e.message ? e.message : e)); }
    }
  }
  window.FRZOpenPdfInViewer = openFiles;
  $('vwFile').onchange = e => { const f = [...e.target.files]; e.target.value = ''; if (f.length) openFiles(f); };
  const dz = $('vwDrop');
  dz.onclick = () => $('vwFile').click();
  dz.setAttribute('tabindex', '0'); dz.setAttribute('role', 'button'); dz.dataset.a11y = '1';
  dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dz.click(); } };
  ['dragenter', 'dragover'].forEach(ev => panel.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => panel.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  panel.addEventListener('drop', e => { const f = [...(e.dataTransfer?.files || [])]; if (f.length) openFiles(f); });

  /* ---------- layout + lazy rendering ---------- */
  async function layout(t) {
    if (!t.w0) { const first = await t.pdf.getPage(1), v1 = first.getViewport({ scale: 1 }); t.w0 = v1.width; t.h0 = v1.height; if (!t.order[0].w && t.order[0].src === 0) { t.order[0].w = v1.width; t.order[0].h = v1.height; } }
    const v1 = { width: t.order[0].w || t.w0 };
    if (!t.scale) t.scale = UI.fit === 'actual' ? 1 : Math.min(1.6, Math.max(0.3, (scrollEl.clientWidth - 28) / v1.width));
    scrollEl.textContent = ''; t.pages = [];
    t.n = t.order.length;
    for (let i = 0; i < t.n; i++) {
      const w = t.order[i].w || t.w0, h = t.order[i].h || t.h0;
      const el = document.createElement('div'); el.className = 'vw-page'; el.dataset.i = i; el.setAttribute('aria-label', 'Page ' + (i + 1));
      el.style.width = w * t.scale + 'px'; el.style.height = h * t.scale + 'px';
      t.pages.push(el); scrollEl.appendChild(el);
    }
    scrollEl.classList.toggle('vw-area', mode === 'area');
    if (io) io.disconnect();
    Q.length = 0;
    io = new IntersectionObserver(entries => { entries.forEach(en => { const i = +en.target.dataset.i; if (en.isIntersecting) { if (!Q.some(q => q.i === i)) Q.push({ t, i }); } else { const k = Q.findIndex(q => q.i === i); if (k >= 0) Q.splice(k, 1); unrender(en.target); } }); pump(); }, { root: scrollEl, rootMargin: '700px 0px' });
    t.pages.forEach(el => io.observe(el));
    $('vwZlabel').textContent = Math.round(t.scale * 100) + '%'; $('vwGo').max = t.n; $('vwOf').textContent = '/ ' + t.n;
  }
  const Q = []; let running = 0; const MAXR = 3;
  function pump() {
    while (running < MAXR && Q.length) {
      const cur = currentPage() - 1; Q.sort((a, b) => Math.abs(a.i - cur) - Math.abs(b.i - cur)); const j = Q.shift(); if (j.t !== active) continue;
      running++; renderPage(j.t, j.i).finally(() => { running--; pump(); });
    }
  }
  function unrender(el) { if (!el._done) return; el._tok = (el._tok || 0) + 1; el._done = false; el.textContent = ''; }
  async function renderPage(t, i) {
    const el = t.pages[i]; if (!el || el._done || el._busy) return; el._busy = true; const tok = el._tok = (el._tok || 0) + 1;
    try {
      const ent = t.order[i];
      if (ent.src < 0) {
        el.style.width = ent.w * t.scale + 'px'; el.style.height = ent.h * t.scale + 'px';
        const ann0 = document.createElement('div'); ann0.className = 'vw-ann'; el.textContent = ''; el.append(ann0, moreBtn()); el._canvas = null; el._done = true; drawAnn(t, i); return;
      }
      const page = await t.pdf.getPage(ent.src + 1), v1 = page.getViewport({ scale: 1 }); ent.w = v1.width; ent.h = v1.height;
      const vp = page.getViewport({ scale: t.scale }), dpr = Math.min(2, window.devicePixelRatio || 1) * (t.scale > 2 ? 0.75 : 1);
      el.style.width = vp.width + 'px'; el.style.height = vp.height + 'px';
      const c = document.createElement('canvas'); c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr); c.style.width = vp.width + 'px'; c.style.height = vp.height + 'px';
      const ctx = c.getContext('2d', { alpha: false });
      await page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: t.scale * dpr }) }).promise;
      if (tok !== el._tok) return;
      const ann = document.createElement('div'); ann.className = 'vw-ann';
      const tl = document.createElement('div'); tl.className = 'vw-text'; tl.style.setProperty('--scale-factor', String(vp.scale));
      el.textContent = ''; el.append(c, ann, tl, moreBtn()); el._canvas = c; el._dpr = dpr; el._done = true;
      drawAnn(t, i);
      try { const tc = await page.getTextContent(); if (tok === el._tok) await pdfjsLib.renderTextLayer({ textContentSource: tc, container: tl, viewport: vp, textDivs: [] }).promise; } catch (e) { }
    } catch (e) { /* page render cancelled or failed */ } finally { el._busy = false; }
  }
  function drawAnn(t, i) {
    const el = t.pages[i], ann = el && el.querySelector('.vw-ann'); if (!ann) return; ann.textContent = '';
    (t.order[i] && t.ann[t.order[i].id] || []).forEach(a => a.r.forEach(r => { const d = document.createElement('div'); d.className = a.k; d.style.cssText = `left:${r.x * t.scale}px;top:${r.y * t.scale}px;width:${r.w * t.scale}px;height:${r.h * t.scale}px`; ann.appendChild(d); }));
  }
  async function setScale(t, s) {
    s = Math.min(4, Math.max(0.25, s)); const ratio = s / t.scale, top = scrollEl.scrollTop * ratio; t.scale = s;
    await layout(t); scrollEl.scrollTop = top; updateInfo();
  }
  $('vwZin').onclick = () => active && setScale(active, active.scale * 1.2);
  $('vwZout').onclick = () => active && setScale(active, active.scale / 1.2);
  $('vwZlabel').onclick = async () => { if (!active) return; const w = active.order[0].w || active.w0 || 600; setScale(active, (scrollEl.clientWidth - 28) / w); };

  /* ---------- go to page ---------- */
  function currentPage() { if (!active) return 1; const top = scrollEl.scrollTop + scrollEl.clientHeight * 0.3; let cur = 0; for (let i = 0; i < active.pages.length; i++) { if (active.pages[i].offsetTop <= top) cur = i; else break; } return cur + 1; }
  function updateInfo() { if (active) $('vwGo').value = currentPage(); }
  function goTo(n) { if (!active) return; n = Math.min(active.n, Math.max(1, Math.round(+n) || 1)); const el = active.pages[n - 1]; scrollEl.scrollTo({ top: el.offsetTop - 10 }); $('vwGo').value = n; }
  $('vwGoBtn').onclick = () => goTo($('vwGo').value);
  $('vwGo').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); goTo($('vwGo').value); } };
  $('vwPrev').onclick = () => goTo(currentPage() - 1);
  $('vwNext').onclick = () => goTo(currentPage() + 1);
  let raf = 0; scrollEl.addEventListener('scroll', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; updateInfo(); }); });

  /* ---------- selection → actions ---------- */
  function pageAt(x, y) { if (!active) return -1; for (let i = 0; i < active.pages.length; i++) { const r = active.pages[i].getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i; } return -1; }
  function selectionRects() {
    const sel = window.getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount || !active) return null;
    const range = sel.getRangeAt(0); if (!scrollEl.contains(range.commonAncestorContainer)) return null;
    const out = {};
    [...range.getClientRects()].forEach(r => {
      if (r.width < 1 || r.height < 1) return;
      const i = pageAt(r.left + r.width / 2, r.top + r.height / 2); if (i < 0) return;
      const pr = active.pages[i].getBoundingClientRect(), s = active.scale;
      (out[i] = out[i] || []).push({ x: (r.left - pr.left) / s, y: (r.top - pr.top) / s, w: r.width / s, h: r.height / s });
    });
    return Object.keys(out).length ? { rects: out, text: sel.toString() } : null;
  }
  function showPop(x, y, area) {
    pop.querySelector('[data-a="img"]').hidden = !area; pop.querySelector('[data-a="copy"]').hidden = !!area; pop.querySelector('[data-a="read"]').hidden = !!area;
    pop.style.display = 'flex'; const w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px'; pop.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, y + 10)) + 'px';
  }
  function hidePop() { pop.style.display = 'none'; areaPending = null; document.querySelectorAll('.vw-sel').forEach(n => n.remove()); }
  scrollEl.addEventListener('mouseup', e => {
    if (mode !== 'text') return;
    setTimeout(() => { const s = selectionRects(); if (s) showPop(e.clientX, e.clientY, false); else if (!pop.contains(e.target)) hidePop(); }, 10);
  });
  scrollEl.addEventListener('touchend', () => setTimeout(() => { const s = selectionRects(); if (s) { const r = window.getSelection().getRangeAt(0).getBoundingClientRect(); showPop(r.left + r.width / 2, r.bottom, false); } }, 400));
  scrollEl.addEventListener('scroll', () => { if (pop.style.display !== 'none' && mode === 'text') hidePop(); });

  function addMark(kind, rectsByPage) {
    Object.entries(rectsByPage).forEach(([i, r]) => { const id = active.order[+i].id; (active.ann[id] = active.ann[id] || []).push({ k: kind, r }); drawAnn(active, +i); }); commit(active);
    window.getSelection().removeAllRanges(); hidePop();
    say(kind === 'rd' ? 'Marked for redaction. Press Ctrl+S (or Save copy) to apply it — pages with redactions are rasterised so the hidden text cannot be recovered.' : 'Highlighted. Press Ctrl+S (or Save copy) to keep it in a new PDF.');
  }
  async function copyText(text) { try { await navigator.clipboard.writeText(text); say('Copied.'); } catch (e) { document.execCommand('copy'); say('Copied.'); } }

  /* read aloud */
  function speak(text) {
    if (!('speechSynthesis' in window)) { say('Reading aloud is not available on this device.'); return; }
    speechSynthesis.cancel(); text = (text || '').replace(/\s+/g, ' ').trim(); if (!text) { say('There is no text to read.'); return; }
    const parts = text.match(/[^.!?।]+[.!?।]*\s*/g) || [text];
    let buf = ''; const chunks = []; parts.forEach(p => { if ((buf + p).length > 220) { if (buf) chunks.push(buf); buf = p; } else buf += p; }); if (buf) chunks.push(buf);
    chunks.forEach(c => { const u = new SpeechSynthesisUtterance(c); if (/[ഀ-ൿ]/.test(c)) u.lang = 'ml-IN'; speechSynthesis.speak(u); });
    say('Reading aloud… press Stop to end.');
  }
  $('vwStop').onclick = () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); say('Stopped.'); };
  $('vwRead').onclick = async () => {
    const s = selectionRects(); if (s) return speak(s.text);
    if (!active) return; const ent = active.order[currentPage() - 1]; if (!ent || ent.src < 0) return speak(''); const page = await active.pdf.getPage(ent.src + 1); const tc = await page.getTextContent(); speak(tc.items.map(i => i.str).join(' '));
  };
  window.addEventListener('beforeunload', () => { try { speechSynthesis.cancel(); } catch (e) { } });

  /* area mode */
  let areaPending = null, dragging = null;
  function setMode(m) {
    mode = m; $('vwModeText').setAttribute('aria-pressed', m === 'text'); $('vwModeArea').setAttribute('aria-pressed', m === 'area'); scrollEl.classList.toggle('vw-area', m === 'area'); hidePop();
    say(m === 'area' ? 'Drag a rectangle on a page, then choose Copy as image, Highlight or Redact.' : '');
  }
  $('vwModeText').onclick = () => setMode('text'); $('vwModeArea').onclick = () => setMode('area');
  scrollEl.addEventListener('mousedown', e => {
    if (mode !== 'area' || !active || e.button !== 0 || e.target.closest('.vw-more')) return; const i = pageAt(e.clientX, e.clientY); if (i < 0) return; e.preventDefault(); hidePop();
    const pr = active.pages[i].getBoundingClientRect(); const box = document.createElement('div'); box.className = 'vw-sel'; active.pages[i].appendChild(box);
    dragging = { i, x0: e.clientX - pr.left, y0: e.clientY - pr.top, box, pr };
  });
  window.addEventListener('mousemove', e => { if (!dragging) return; const d = dragging, x = Math.min(Math.max(e.clientX - d.pr.left, 0), d.pr.width), y = Math.min(Math.max(e.clientY - d.pr.top, 0), d.pr.height); d.x1 = x; d.y1 = y; d.box.style.cssText = `left:${Math.min(d.x0, x)}px;top:${Math.min(d.y0, y)}px;width:${Math.abs(x - d.x0)}px;height:${Math.abs(y - d.y0)}px`; });
  window.addEventListener('mouseup', e => {
    if (!dragging) return; const d = dragging; dragging = null; const w = Math.abs((d.x1 ?? d.x0) - d.x0), h = Math.abs((d.y1 ?? d.y0) - d.y0);
    if (w < 6 || h < 6) { d.box.remove(); return; }
    areaPending = { i: d.i, x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w, h }; showPop(e.clientX, e.clientY, true);
  });
  async function areaToBlob(a) {
    const el = active.pages[a.i], c = el._canvas; if (!c) return null; const k = c.width / (el.clientWidth || 1);
    const o = document.createElement('canvas'); o.width = Math.max(1, Math.round(a.w * k)); o.height = Math.max(1, Math.round(a.h * k));
    o.getContext('2d').drawImage(c, a.x * k, a.y * k, a.w * k, a.h * k, 0, 0, o.width, o.height);
    return new Promise(r => o.toBlob(r, 'image/png'));
  }
  async function copyImage(blob) {
    if (!blob) { say('That page is not drawn yet — scroll to it first.'); return; }
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); say('Image copied to the clipboard.'); }
    catch (e) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = 'copied-image.png'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 5000); say('Clipboard images are not allowed here, so the image was saved as a file.'); }
  }
  $('vwPageImg').onclick = async () => { if (!active) return; const i = currentPage() - 1, c = active.pages[i]._canvas; if (!c) return; copyImage(await new Promise(r => c.toBlob(r, 'image/png'))); };

  pop.addEventListener('mousedown', e => e.preventDefault());
  pop.addEventListener('click', async e => {
    const a = e.target.closest('button')?.dataset.a; if (!a || !active) return;
    if (areaPending) {
      const p = areaPending; areaPending = null;
      if (a === 'img') { hidePop(); return copyImage(await areaToBlob(p)); }
      return addMark(a, { [p.i]: [{ x: p.x / active.scale, y: p.y / active.scale, w: p.w / active.scale, h: p.h / active.scale }] });
    }
    const s = selectionRects(); if (!s) return hidePop();
    if (a === 'copy') { await copyText(s.text); hidePop(); } else if (a === 'read') { speak(s.text); hidePop(); } else addMark(a, s.rects);
  });

  /* ---------- document model: page order, undo/redo history, unsaved changes ---------- */
  const cloneAnn = a => JSON.parse(JSON.stringify(a));
  const orderKey = t => JSON.stringify(t.order.map(e => [e.id, e.src, Math.round((e.w || 0) * 100), Math.round((e.h || 0) * 100)]));
  const keyOf = t => orderKey(t) + JSON.stringify(t.ann);
  const snapOf = t => ({ order: t.order.map(e => ({ ...e })), ann: cloneAnn(t.ann) });
  function initHist(t) { t.hist = [snapOf(t)]; t.hi = 0; t.base = keyOf(t); t.baseSnap = snapOf(t); }
  const isDirty = t => keyOf(t) !== t.base;
  function commit(t) { t.hist.length = t.hi + 1; t.hist.push(snapOf(t)); if (t.hist.length > 200) t.hist.shift(); t.hi = t.hist.length - 1; t.n = t.order.length; drawTabs(); scheduleAutosave(t); }
  async function restoreSnap(t, snap) {
    const before = orderKey(t); t.order = snap.order.map(e => ({ ...e })); t.ann = cloneAnn(snap.ann); t.n = t.order.length;
    if (t === active) { if (orderKey(t) !== before) { const top = scrollEl.scrollTop; await layout(t); scrollEl.scrollTop = top; } else t.pages.forEach((_, i) => drawAnn(t, i)); }
    drawTabs();
  }
  async function stepHistory(step) {
    const t = active; if (!t) return; const j = t.hi + step; if (j < 0 || j >= t.hist.length) { say(step < 0 ? 'Nothing to undo.' : 'Nothing to redo.'); return; }
    t.hi = j; await restoreSnap(t, t.hist[j]); scheduleAutosave(t); say(step < 0 ? 'Undone.' : 'Redone.');
  }

  /* ---------- building the edited PDF (pages stay vector; only pages with redactions become pictures) ---------- */
  async function buildEdited(t, only) {
    if (t.encrypted) throw new Error('Saving changes is not supported for password-protected PDFs.');
    const { PDFDocument, rgb } = PDFLib, doc = await PDFDocument.load(await getBytes(t), { updateMetadata: false });
    const keep = only || t.order.map((_, i) => i), keepSrc = new Set(keep.map(i => t.order[i].src).filter(s => s >= 0));
    for (let s = doc.getPageCount() - 1; s >= 0; s--) if (!keepSrc.has(s)) doc.removePage(s);
    keep.forEach((di, pos) => { const e = t.order[di]; if (e.src < 0) doc.insertPage(pos, [e.w || t.w0, e.h || t.h0]); });
    for (let pos = 0; pos < keep.length; pos++) {
      const e = t.order[keep[pos]], list = t.ann[e.id] || []; if (!list.length) continue;
      const hasRd = list.some(a => a.k === 'rd'), page = doc.getPage(pos);
      if (e.src < 0) { list.forEach(a => a.r.forEach(r => page.drawRectangle({ x: r.x, y: (e.h || t.h0) - r.y - r.h, width: r.w, height: r.h, color: a.k === 'rd' ? rgb(0, 0, 0) : rgb(1, .87, 0), opacity: a.k === 'rd' ? 1 : .4 }))); continue; }
      const pdfPage = await t.pdf.getPage(e.src + 1), v1 = pdfPage.getViewport({ scale: 1 });
      const rectOf = r => { const [x1, y1] = v1.convertToPdfPoint(r.x, r.y), [x2, y2] = v1.convertToPdfPoint(r.x + r.w, r.y + r.h); return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }; };
      if (!hasRd) { list.forEach(a => a.r.forEach(r => page.drawRectangle({ ...rectOf(r), color: rgb(1, .87, 0), opacity: .4 }))); continue; }
      const K = 4, vp = pdfPage.getViewport({ scale: K }), cv = document.createElement('canvas'); cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      const cx = cv.getContext('2d', { alpha: false }); await pdfPage.render({ canvasContext: cx, viewport: vp }).promise;
      list.forEach(a => a.r.forEach(r => { cx.fillStyle = a.k === 'rd' ? '#000' : 'rgba(255,222,0,.4)'; cx.fillRect(r.x * K, r.y * K, r.w * K, r.h * K); }));
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95)), img = await doc.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      doc.insertPage(pos, [v1.width, v1.height]).drawImage(img, { x: 0, y: 0, width: v1.width, height: v1.height }); doc.removePage(pos + 1);
    }
    return doc.save();
  }

  /* ---------- save as a copy: "name (copy).pdf", kept up to date after every later change ---------- */
  const editKind = t => { const all = Object.values(t.ann || {}).flat(); return all.some(a => a.k === 'rd') ? 'redacted' : all.some(a => a.k === 'hl') ? 'highlighted' : 'edited'; };
  const copyName = t => t._cn || (window.frzName ? window.frzName(t.name, editKind(t), 'pdf') : t.name.replace(/\.pdf$/i, '') + '-' + editKind(t) + 'frz.pdf');
  const isPhone = () => !!(window.frzDevice && window.frzDevice.isMobile);
  const triggerDownload = (bytes, name) => { const u = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); };
  let saving = Promise.resolve();
  function saveCopy(t, silent) { const run = () => saveCopyNow(t, silent); saving = saving.then(run, run); return saving; }
  async function saveCopyNow(t, silent) {
    const D = window.frzDesktop, key = keyOf(t), snap = snapOf(t); let where = ''; if (!t._cn) t._cn = copyName(t);
    const bytes = await buildEdited(t);
    if (D && D.saveCopy) {
      const r = await D.saveCopy({ path: t.path, target: t.copyTarget || '', bytes, name: copyName(t) });
      if (!r.ok) { if (!r.cancelled) say('Could not save the copy: ' + (r.message || 'unknown error')); return false; }
      t.copyTarget = r.path; where = r.path;
    } else if (window.showSaveFilePicker && !isPhone()) {
      if (!t.handle) {
        if (silent) return false;
        try { t.handle = await window.showSaveFilePicker({ suggestedName: copyName(t), types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }] }); }
        catch (e) { return false; }
      }
      try { const w = await t.handle.createWritable(); await w.write(bytes); await w.close(); where = t.handle.name; }
      catch (e) { t.handle = null; say('Could not write the copy: ' + (e && e.message ? e.message : e)); return false; }
    } else { triggerDownload(bytes, copyName(t)); t.noAuto = true; where = 'your downloads as ' + copyName(t); }
    if (!D && (isPhone() || !window.showSaveFilePicker)) { t.base = key; t.baseSnap = snap; t.autosave = false; drawTabs(); say('Downloaded as ' + copyName(t) + ' (check your Downloads folder).'); return true; }
    t.base = key; t.baseSnap = snap; t.autosave = !t.noAuto; drawTabs();
    say(silent ? 'Copy updated.' : 'Saved to ' + where + (t.autosave ? '. Later changes are added to this copy automatically.' : '.'));
    return true;
  }
  function scheduleAutosave(t) { if (!t.autosave) return; clearTimeout(t._as); t._as = setTimeout(() => { if (isDirty(t)) saveCopy(t, true).catch(() => { }); }, 1500); }
  $('vwSave').onclick = async () => { if (!active) return; say('Preparing your copy…'); try { if (!(await saveCopy(active, false))) say(''); } catch (e) { say('Could not save the copy: ' + (e && e.message ? e.message : e)); } };

  /* unsaved changes: Save as copy / Discard / Cancel (only when something really differs from the saved state) */
  function askUnsaved(t) {
    return new Promise(res => {
      const d = document.createElement('dialog'); d.className = 'frz-default-dialog'; d.setAttribute('aria-labelledby', 'vwUnT');
      d.innerHTML = '<h2 id="vwUnT">Save your changes?</h2><p></p><div class="row"><button class="btn ghost" type="button" data-r="cancel">Cancel</button><button class="btn ghost" type="button" data-r="discard">Discard</button><button class="btn primary" type="button" data-r="save">Save as copy</button></div>';
      d.querySelector('p').textContent = '“' + t.name + '” has changes that are not saved. Save them as “' + copyName(t) + '”, or discard them?';
      document.body.appendChild(d); d.showModal(); const done = r => { d.close(); d.remove(); res(r); };
      d.querySelectorAll('button').forEach(b => b.onclick = () => done(b.dataset.r)); d.addEventListener('cancel', e => { e.preventDefault(); done('cancel'); });
      d.querySelector('[data-r=save]').focus();
    });
  }
  async function settle(t) {
    if (!isDirty(t)) return true;
    const r = await askUnsaved(t); if (r === 'cancel') return false;
    if (r === 'save') { try { if (!(await saveCopy(t, false))) return false; } catch (e) { say('Could not save the copy: ' + (e && e.message ? e.message : e)); return false; } }
    else { t.autosave = false; clearTimeout(t._as); t.hist = [t.baseSnap]; t.hi = 0; await restoreSnap(t, t.baseSnap); }
    return true;
  }
  window.FRZViewerGuard = async () => { for (const t of tabs.slice()) { if (!(await settle(t))) return false; } return true; };
  window.addEventListener('beforeunload', e => { if (!window.__frzForceClose && !window.frzDesktop && tabs.some(isDirty)) { e.preventDefault(); e.returnValue = ''; } });
  async function closeTab(t) {
    if (!(await settle(t))) return;
    const i = tabs.indexOf(t); if (i < 0) return; tabs.splice(i, 1); clearTimeout(t._as);
    try { t.pdf.destroy(); } catch (e) { } try { URL.revokeObjectURL(t.url); } catch (e) { }
    if (active === t) { if (tabs.length) activate(tabs[Math.max(0, i - 1)]); else showHome(); } else drawTabs();
  }

  /* ---------- the ⋯ menu at the end of every page ---------- */
  const DOTS = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
  function moreBtn() { const b = document.createElement('button'); b.type = 'button'; b.className = 'vw-more'; b.innerHTML = DOTS; b.setAttribute('aria-label', 'Page options'); b.title = 'Page options'; b.setAttribute('aria-haspopup', 'menu'); return b; }
  const pm = document.createElement('div'); pm.className = 'vw-pmenu'; pm.setAttribute('role', 'menu'); pm.hidden = true;
  const PITEMS = [['rdall', 'Redact all text and images'], ['rdimg', 'Redact all images'], ['rdtext', 'Redact all text'], ['-'], ['del', 'Delete this page'], ['blank', 'Add a blank page after this'], ['-'], ['png', 'Download this page as an image'], ['pdf', 'Download this page as a PDF'], ['tab', 'Open this page in a new tab']];
  PITEMS.forEach(([k, l]) => { if (k === '-') { const hr = document.createElement('hr'); pm.appendChild(hr); return; } const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.k = k; b.textContent = l; pm.appendChild(b); });
  document.body.appendChild(pm); let pmPage = -1;
  const hidePm = () => { pm.hidden = true; };
  scrollEl.addEventListener('click', e => {
    const b = e.target.closest('.vw-more'); if (!b) return; e.stopPropagation(); const el = b.closest('.vw-page'); pmPage = +el.dataset.i; pm.hidden = false;
    const r = b.getBoundingClientRect(), w = pm.offsetWidth, h = pm.offsetHeight; pm.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px'; pm.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.top - h - 6 < 8 ? r.bottom + 6 : r.top - h - 6)) + 'px'; pm.querySelector('button').focus();
  });
  document.addEventListener('click', e => { if (!pm.hidden && !pm.contains(e.target)) hidePm(); });
  scrollEl.addEventListener('scroll', hidePm, { passive: true });
  pm.addEventListener('keydown', e => { const bs = [...pm.querySelectorAll('button')], i = bs.indexOf(document.activeElement); if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); } else if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); } else if (e.key === 'Escape') { hidePm(); } });

  async function textRects(t, i) {
    const e = t.order[i]; if (e.src < 0) return []; const page = await t.pdf.getPage(e.src + 1), vp = page.getViewport({ scale: 1 }), tc = await page.getTextContent(), out = [];
    tc.items.forEach(it => { if (!it.str || !it.str.trim()) return; const h = it.height || Math.abs(it.transform[3]) || 10, x = it.transform[4], y = it.transform[5]; const [x1, y1, x2, y2] = vp.convertToViewportRectangle([x, y - h * .25, x + (it.width || 0), y + h * 1.0]); out.push({ x: Math.min(x1, x2) - 1, y: Math.min(y1, y2) - 1, w: Math.abs(x2 - x1) + 2, h: Math.abs(y2 - y1) + 2 }); });
    return out;
  }
  async function imageRects(t, i) {
    const e = t.order[i]; if (e.src < 0) return []; const page = await t.pdf.getPage(e.src + 1), vp = page.getViewport({ scale: 1 }), ops = await page.getOperatorList(), O = pdfjsLib.OPS, out = [];
    const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
    let ctm = [1, 0, 0, 1, 0, 0]; const st = [];
    for (let k = 0; k < ops.fnArray.length; k++) {
      const f = ops.fnArray[k], a = ops.argsArray[k];
      if (f === O.save) st.push(ctm.slice()); else if (f === O.restore) ctm = st.pop() || [1, 0, 0, 1, 0, 0]; else if (f === O.transform) ctm = mul(ctm, a);
      else if (f === O.paintFormXObjectBegin) { st.push(ctm.slice()); if (a && a[0]) ctm = mul(ctm, a[0]); } else if (f === O.paintFormXObjectEnd) ctm = st.pop() || [1, 0, 0, 1, 0, 0];
      else if (f === O.paintImageXObject || f === O.paintInlineImageXObject || f === O.paintImageMaskXObject || f === O.paintJpegXObject) {
        const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => vp.convertToViewportPoint(ctm[0] * u + ctm[2] * v + ctm[4], ctm[1] * u + ctm[3] * v + ctm[5]));
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); out.push({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) });
      }
    }
    return out.filter(r => r.w > 2 && r.h > 2);
  }
  function addRects(t, i, rects, what) {
    if (!rects.length) { say('No ' + what + ' found on page ' + (i + 1) + '.'); return; }
    const id = t.order[i].id; (t.ann[id] = t.ann[id] || []).push({ k: 'rd', r: rects }); drawAnn(t, i); commit(t);
    say('Marked ' + rects.length + ' ' + what + ' on page ' + (i + 1) + ' for redaction. Ctrl+Z undoes it; Ctrl+S saves it.');
  }
  async function pagePng(t, i) {
    const e = t.order[i], K = 2.5, w = (e.w || t.w0) * K, h = (e.h || t.h0) * K, cv = document.createElement('canvas'); cv.width = Math.round(w); cv.height = Math.round(h);
    const cx = cv.getContext('2d', { alpha: false }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
    if (e.src >= 0) { const pg = await t.pdf.getPage(e.src + 1); await pg.render({ canvasContext: cx, viewport: pg.getViewport({ scale: K }) }).promise; }
    (t.ann[e.id] || []).forEach(a => a.r.forEach(r => { cx.fillStyle = a.k === 'rd' ? '#000' : 'rgba(255,222,0,.4)'; cx.fillRect(r.x * K, r.y * K, r.w * K, r.h * K); }));
    return new Promise(r => cv.toBlob(r, 'image/png'));
  }
  pm.addEventListener('click', async e => {
    const k = e.target.closest('button')?.dataset.k; if (!k || !active) return; const t = active, i = pmPage; hidePm(); if (i < 0 || i >= t.order.length) return;
    const base = t.name.replace(/\.pdf$/i, '');
    try {
      if (k === 'rdall') { say('Finding text and images…'); addRects(t, i, (await textRects(t, i)).concat(await imageRects(t, i)), 'text and image areas'); }
      else if (k === 'rdimg') { say('Finding images…'); addRects(t, i, await imageRects(t, i), 'images'); }
      else if (k === 'rdtext') { say('Finding text…'); addRects(t, i, await textRects(t, i), 'text areas'); }
      else if (k === 'del') { if (t.order.length <= 1) { say('A PDF needs at least one page.'); return; } t.order.splice(i, 1); commit(t); const top = scrollEl.scrollTop; await layout(t); scrollEl.scrollTop = top; say('Page ' + (i + 1) + ' deleted. Ctrl+Z brings it back.'); }
      else if (k === 'blank') { const e0 = t.order[i]; t.order.splice(i + 1, 0, { id: ++uid, src: -1, w: e0.w || t.w0, h: e0.h || t.h0 }); commit(t); const top = scrollEl.scrollTop; await layout(t); scrollEl.scrollTop = top; say('Blank page added after page ' + (i + 1) + '.'); }
      else if (k === 'png') { const b = await pagePng(t, i), u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = window.frzName ? window.frzName(base, 'page' + (i + 1), 'png') : base + '_page' + (i + 1) + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); say('Page image downloaded.'); }
      else if (k === 'pdf') { say('Preparing…'); triggerDownload(await buildEdited(t, [i]), window.frzName ? window.frzName(base, 'page' + (i + 1), 'pdf') : base + '_page' + (i + 1) + '.pdf'); say('Page downloaded as a PDF.'); }
      else if (k === 'tab') { say('Opening…'); const bytes = await buildEdited(t, [i]); await openFiles([new File([bytes], base + ' (page ' + (i + 1) + ').pdf', { type: 'application/pdf' })], true, t); }
    } catch (err) { say('Could not do that: ' + (err && err.message ? err.message : err)); }
  });

  /* ---------- keyboard shortcuts, pinch / Ctrl + wheel / Ctrl +/- zoom ---------- */
  let zBusy = false, zPending = null;
  async function runZoom() {
    zBusy = true;
    while (zPending && active) {
      const p = zPending; zPending = null; const t = active, s = Math.min(4, Math.max(0.25, p.s)); if (Math.abs(s - t.scale) < 0.003) continue;
      const ratio = s / t.scale, cy = p.cy, cx = p.cx, top = (scrollEl.scrollTop + cy) * ratio - cy, left = (scrollEl.scrollLeft + cx) * ratio - cx; t.scale = s;
      await layout(t); scrollEl.scrollTop = top; scrollEl.scrollLeft = Math.max(0, left); updateInfo();
    }
    zBusy = false;
  }
  function zoomTo(s, cx, cy) { if (!active) return; const r = scrollEl.getBoundingClientRect(); zPending = { s, cx: cx == null ? r.width / 2 : cx - r.left, cy: cy == null ? r.height / 2 : cy - r.top }; if (!zBusy) runZoom(); }
  const zoomBy = (f, cx, cy) => { const base = zPending ? zPending.s : (active ? active.scale : 1); zoomTo(base * f, cx, cy); };
  scrollEl.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const big = e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY)); zoomBy(big ? (e.deltaY < 0 ? 1.15 : 1 / 1.15) : Math.exp(-e.deltaY * 0.01), e.clientX, e.clientY); }, { passive: false });
  let pinch = null; const tdist = ts => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  scrollEl.addEventListener('touchstart', e => { if (e.touches.length === 2 && active) { pinch = { d: tdist(e.touches), s: active.scale }; hidePop(); } }, { passive: true });
  scrollEl.addEventListener('touchmove', e => { if (pinch && e.touches.length === 2) { e.preventDefault(); const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2, my = (e.touches[0].clientY + e.touches[1].clientY) / 2; zoomTo(pinch.s * tdist(e.touches) / pinch.d, mx, my); } }, { passive: false });
  scrollEl.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; }, { passive: true });
  const typing = e => { const n = e.target; return n && (n.tagName === 'INPUT' || n.tagName === 'TEXTAREA' || n.tagName === 'SELECT' || n.isContentEditable); };
  document.addEventListener('keydown', e => {
    if (!document.body.classList.contains('viewer-open')) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key, kl = k.length === 1 ? k.toLowerCase() : k;
    if (mod && kl === 'g') { e.preventDefault(); $('vwGo').focus(); $('vwGo').select(); }
    else if (mod && kl === 'w' && active) { e.preventDefault(); closeTab(active); }
    else if (mod && kl === 'u') { e.preventDefault(); $('vwFile').click(); }
    else if (mod && kl === 's' && active) { e.preventDefault(); $('vwSave').click(); }
    else if (mod && kl === 'z' && !e.shiftKey && !typing(e)) { e.preventDefault(); stepHistory(-1); }
    else if (mod && (kl === 'y' || (kl === 'z' && e.shiftKey)) && !typing(e)) { e.preventDefault(); stepHistory(1); }
    else if (mod && kl === 'c' && active && !typing(e)) { const sel = window.getSelection(); if (!sel || sel.isCollapsed) { e.preventDefault(); if (isDirty(active) || !active.autosave) $('vwSave').click(); else say('Your copy is already up to date.'); } }
    else if (mod && (k === '+' || k === '=' || k === 'Add') && active) { e.preventDefault(); zoomBy(1.15); }
    else if (mod && (k === '-' || k === '_' || k === 'Subtract') && active) { e.preventDefault(); zoomBy(1 / 1.15); }
    else if (mod && k === '0' && active) { e.preventDefault(); $('vwZlabel').click(); }
    else if (k === 'Escape') { hidePop(); hidePm(); }
  });

  /* ---------- default PDF viewer prompt (desktop app only, only when not already the default) ---------- */
  (function defaultPrompt() {
    const d = window.frzDesktop; if (!d || typeof d.isDefaultPdf !== 'function') return;
    const KEY = 'frz-default-prompt-snooze';
    const snoozed = () => { try { return Date.now() < +localStorage.getItem(KEY); } catch (e) { return false; } };
    setTimeout(async () => {
      if (snoozed()) return;
      let isDef = false; try { isDef = await d.isDefaultPdf(); } catch (e) { }
      if (isDef) return;
      const dlg = document.createElement('dialog'); dlg.className = 'frz-default-dialog'; dlg.setAttribute('aria-labelledby', 'frzDefTitle');
      dlg.innerHTML = '<h2 id="frzDefTitle">Make this your PDF viewer?</h2><p>Set FRZ PDF Express as the default app for PDF files so they open here instantly, with your tools and recent files ready.</p><p class="vw-msg" id="frzDefMsg" role="status" aria-live="polite"></p><div class="row"><button class="btn ghost" type="button" id="frzDefLater">Not now</button><button class="btn primary" type="button" id="frzDefSet">Set as default PDF viewer</button></div>';
      document.body.appendChild(dlg); try { dlg.showModal(); } catch (e) { return; }
      dlg.querySelector('#frzDefLater').onclick = () => { try { localStorage.setItem(KEY, String(Date.now() + 7 * 864e5)); } catch (e) { } dlg.close(); dlg.remove(); };
      dlg.querySelector('#frzDefSet').onclick = async () => {
        const m = dlg.querySelector('#frzDefMsg'); m.textContent = 'Working…';
        try { const r = await d.setDefaultPdf(); m.textContent = r && r.message ? r.message : 'Done.'; if (r && r.ok) setTimeout(() => { dlg.close(); dlg.remove(); }, 1800); } catch (e) { m.textContent = 'Could not change the setting. You can do it in your system settings.'; }
      };
    }, 60000);
  })();

  const rb = document.querySelector('#panel-viewer .viewer-reader-bar'); if (rb) { const w = document.createElement('div'); w.innerHTML = '<button class="bulb-toggle" id="vwTheme" type="button" aria-pressed="true" aria-label="Toggle light and dark mode" title="Toggle theme"><svg viewBox="0 0 26 42" aria-hidden="true"><rect class="bulb-cap" x="9" y="2" width="8" height="6" rx="1"/><path class="bulb-glass" d="M13 7c-5.5 0-9.5 4.2-9.5 9.2 0 3.9 2.4 6.7 4.7 8.9 1.3 1.2 1.6 2.4 1.6 4v3.4h6.4v-3.4c0-1.6.3-2.8 1.6-4 2.3-2.2 4.7-5 4.7-8.9C22.5 11.2 18.5 7 13 7z"/><path class="bulb-filament" d="M10.5 14c1 1.3 1.7 2.9 1.7 4.6s-.7 3.6-1.7 4.9M15.5 14c-1 1.3-1.7 2.9-1.7 4.6s.7 3.6 1.7 4.9"/></svg></button>'; const bb = w.firstChild; bb.style.marginLeft = 'auto'; rb.appendChild(bb); }
  const themeBtn = document.getElementById('vwTheme'), syncTheme = () => themeBtn.setAttribute('aria-pressed', document.documentElement.getAttribute('data-theme') === 'light' ? 'false' : 'true');
  themeBtn.onclick = () => { const m = document.getElementById('themeToggle'); if (m) m.click(); syncTheme(); };
  new MutationObserver(syncTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); syncTheme();
  /* ---------- toolbar: hide / pin / dock / customise ---------- */
  const UKEY = 'frz-viewer-ui', UDEF = { dock: 'top', mode: 'pinned', labels: true, look: 'normal', gap: 14, fit: 'width' };
  let UI = { ...UDEF }; try { Object.assign(UI, JSON.parse(localStorage.getItem(UKEY) || '{}')); } catch (e) { }
  let lastMode = 'pinned'; const menu = $('vwMenu');
  function applyUI(save) {
    if (!['top', 'bottom', 'left', 'right'].includes(UI.dock)) UI.dock = 'top'; if (!['pinned', 'auto', 'hidden'].includes(UI.mode)) UI.mode = 'pinned';
    const narrow = window.matchMedia && matchMedia('(max-width:760px)').matches; docEl.dataset.dock = narrow ? 'top' : UI.dock; if (narrow && UI.mode === 'hidden') UI.mode = 'pinned'; docEl.dataset.mode = UI.mode; docEl.dataset.labels = UI.labels ? '1' : '0'; delete docEl.dataset.peek;
    scrollEl.dataset.look = UI.look; scrollEl.style.setProperty('--vw-gap', UI.gap + 'px');
    const pin = $('vwPin'); pin.setAttribute('aria-pressed', UI.mode === 'pinned' ? 'true' : 'false'); pin.title = pin.ariaLabel = UI.mode === 'pinned' ? 'Pinned — click to auto-hide the toolbar' : 'Click to pin the toolbar';
    ['L', 'T', 'R', 'B'].forEach(k => $('vwDock' + k).setAttribute('aria-pressed', UI.dock === { L: 'left', T: 'top', R: 'right', B: 'bottom' }[k] ? 'true' : 'false'));
    $('vwShow').setAttribute('aria-label', UI.mode === 'hidden' ? 'Show toolbar' : 'Show toolbar while hidden');
    $('vwOptDock').value = UI.dock; $('vwOptMode').value = UI.mode; $('vwOptLabels').checked = !!UI.labels; $('vwOptLook').value = UI.look; $('vwOptGap').value = String(UI.gap); $('vwOptFit').value = UI.fit;
    if (save) { try { localStorage.setItem(UKEY, JSON.stringify(UI)); } catch (e) { } }
  }
  const setUI = patch => { Object.assign(UI, patch); applyUI(true); if (active && ('gap' in patch)) layout(active); };
  $('vwPin').onclick = () => setUI({ mode: UI.mode === 'pinned' ? 'auto' : 'pinned' });
  $('vwHide').onclick = () => { lastMode = UI.mode === 'hidden' ? 'pinned' : UI.mode; setUI({ mode: 'hidden' }); $('vwShow').focus(); };
  $('vwShow').onclick = () => { if (UI.mode === 'hidden') setUI({ mode: lastMode === 'hidden' ? 'pinned' : lastMode }); else { docEl.dataset.peek = docEl.dataset.peek ? '' : '1'; } };
  [['L', 'left'], ['T', 'top'], ['R', 'right'], ['B', 'bottom']].forEach(([k, v]) => { $('vwDock' + k).onclick = () => setUI({ dock: v }); });
  $('vwCust').onclick = e => { e.stopPropagation(); menu.hidden = !menu.hidden; $('vwCust').setAttribute('aria-expanded', String(!menu.hidden)); };
  document.addEventListener('click', e => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('#vwCust')) { menu.hidden = true; $('vwCust').setAttribute('aria-expanded', 'false'); } });
  $('vwOptDock').onchange = e => setUI({ dock: e.target.value }); $('vwOptMode').onchange = e => setUI({ mode: e.target.value }); $('vwOptLabels').onchange = e => setUI({ labels: e.target.checked });
  $('vwOptLook').onchange = e => setUI({ look: e.target.value }); $('vwOptGap').onchange = e => setUI({ gap: +e.target.value }); $('vwOptFit').onchange = e => setUI({ fit: e.target.value });
  $('vwOptReset').onclick = () => { UI = { ...UDEF }; applyUI(true); if (active) layout(active); };
  document.addEventListener('keydown', e => { if (!document.body.classList.contains('viewer-open')) return; if (e.key === 'Escape' && !menu.hidden) { menu.hidden = true; $('vwCust').focus(); } if (e.altKey && e.key.toLowerCase() === 't') { e.preventDefault(); $('vwHide').click(); } });
  applyUI(false); try { matchMedia('(max-width:760px)').addEventListener('change', () => applyUI(false)); } catch (e) { }
  window.FRZViewer = { bytes: getBytes, dirty: isDirty, active: () => active, say, currentPage };
  drawTabs(); renderRecent();
})();
