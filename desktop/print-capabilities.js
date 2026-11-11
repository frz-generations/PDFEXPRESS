/*
 * FRZ PDF Express — platform printer capability helpers
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. MIT License. SPDX-License-Identifier: MIT
 * Keep this notice and creator credit; see ../LICENSE and ../NOTICE.
 */
'use strict';

const SAFE_OPTION = /^[\w.+-]{1,64}$/;

const PAPER_MM = {
  a0: [841, 1189], a1: [594, 841], a2: [420, 594], a3: [297, 420], a4: [210, 297], a5: [148, 210], a6: [105, 148],
  letter: [215.9, 279.4], legal: [215.9, 355.6], tabloid: [279.4, 431.8],
  ledger: [431.8, 279.4], executive: [184.15, 266.7], statement: [139.7, 215.9],
  b4: [250, 353], b5: [176, 250],
};

function labelFor(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const iso = key.match(/isoa([0-6])|isob([4-5])|jisb([4-5])/);
  if (iso) return iso[1] ? 'A' + iso[1] : 'B' + (iso[2] || iso[3]);
  const known = {
    a3: 'A3', a4: 'A4', a5: 'A5', a6: 'A6', letter: 'Letter', legal: 'Legal',
    tabloid: 'Tabloid', ledger: 'Ledger', executive: 'Executive', statement: 'Statement',
    b4: 'B4', b5: 'B5',
  };
  if (key.includes('letter')) return 'Letter';
  if (key.includes('legal')) return 'Legal';
  if (key.includes('tabloid')) return 'Tabloid';
  return known[key] || String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
}

function dimensionsForPaper(value) {
  const key = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isoA = key.match(/iso?a([0-6])/), isoB = key.match(/iso?b([4-5])/), jisB = key.match(/jisb([4-5])/);
  const hit = isoA ? 'a' + isoA[1] : isoB ? 'b' + isoB[1] : jisB ? 'b' + jisB[1] : Object.keys(PAPER_MM).find(name => key === name || key.startsWith(name) || key.includes(name));
  if (!hit) return null;
  const [widthMm, heightMm] = PAPER_MM[hit];
  return { widthMm, heightMm };
}

function parseLpOptions(text) {
  const out = { tray: [], mediaType: [], quality: [], paperSizes: [], feats: {}, meta: {} };
  const seen = new Set();
  String(text || '').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([\w-]+)(?:\/([^:]+))?:\s*(.*)$/);
    if (!m) return;
    const key = m[1];
    const lower = key.toLowerCase();
    let bucket = null;
    if (['pagesize', 'pageregion', 'mediasize', 'media'].includes(lower)) bucket = 'paperSizes';
    else if (['inputslot', 'inputbin'].includes(lower)) bucket = 'tray';
    else if (['mediatype', 'pagemediatype'].includes(lower)) bucket = 'mediaType';
    else if (['resolution', 'printquality', 'cupsprintquality', 'quality'].includes(lower)) bucket = 'quality';
    if (!bucket || seen.has(bucket)) return;
    const choices = m[3].trim().split(/\s+/).filter(Boolean).map(raw => {
      const def = raw[0] === '*';
      const value = def ? raw.slice(1) : raw;
      if (!SAFE_OPTION.test(value)) return null;
      const item = { value, label: labelFor(value), def };
      if (bucket === 'paperSizes') Object.assign(item, dimensionsForPaper(value) || {});
      return item;
    }).filter(Boolean);
    if (choices.length) {
      out[bucket] = choices;
      seen.add(bucket);
      if (bucket === 'quality') out.qualityKey = key;
    }
  });
  return out;
}

const WINDOWS_FEATURES = { tray: 'psk:PageInputBin', mediaType: 'psk:PageMediaType', quality: 'psk:PageOutputQuality', paperSize: 'psk:PageMediaSize' };

function windowsLabel(name) {
  const s = String(name || '').replace(/^[^:]+:/, ''), key = s.toLowerCase();
  const known = { isoa0: 'A0', isoa1: 'A1', isoa2: 'A2', isoa3: 'A3', isoa4: 'A4', isoa5: 'A5', isoa6: 'A6', northamericaletter: 'Letter', northamericalegal: 'Legal', northamericatabloid: 'Tabloid', northamericanexecutive: 'Executive', isob4: 'B4', isob5: 'B5' };
  return known[key] || s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
}

function mapWindowsCapabilities(features) {
  const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const out = { direct: true, win: true, tray: [], mediaType: [], quality: [], paperSizes: [], feats: {}, meta: {}, qualityKey: 'ticket' };
  for (const key of Object.keys(WINDOWS_FEATURES)) {
    const f = arr(features).find(x => x && x.name === WINDOWS_FEATURES[key]);
    if (!f) continue;
    out.feats[key] = { feature: f.name, featureUri: f.uri || '' };
    const options = arr(f.options).filter(o => o && o.name && !/^psk:(None|NotAvailable)$/i.test(o.name)).map(o => ({
      value: o.name, label: (o.display && String(o.display).trim()) || windowsLabel(o.name), uri: o.uri || '',
      widthMm: Number(o.widthMm) || 0, heightMm: Number(o.heightMm) || 0, def: !!o.def,
    }));
    const target = key === 'paperSize' ? 'paperSizes' : key;
    out[target] = key === 'paperSize' ? options.filter(o => o.widthMm > 0 && o.heightMm > 0) : options;
    if (/^psk:(AutoSelect|Automatic)$/i.test((out[target][0] || {}).value)) out[target] = out[target].slice(1);
    out[target].forEach(o => { out.meta[key + '|' + o.value] = o.uri; });
  }
  return out;
}

function buildLpArgs(o) {
  const safe = value => typeof value === 'string' && SAFE_OPTION.test(value);
  const copies = Math.min(99, Math.max(1, parseInt(o && o.copies, 10) || 1));
  const args = ['-d', String(o.printer), '-n', String(copies)];
  const sides = { one: 'one-sided', long: 'two-sided-long-edge', short: 'two-sided-short-edge' }[o.sides] || 'one-sided';
  args.push('-o', 'sides=' + sides);
  if (safe(o.paperSize)) args.push('-o', 'media=' + o.paperSize);
  if (safe(o.tray)) args.push('-o', 'InputSlot=' + o.tray);
  if (safe(o.mediaType)) args.push('-o', 'MediaType=' + o.mediaType);
  if (safe(o.quality) && safe(o.qualityKey)) args.push('-o', o.qualityKey + '=' + o.quality);
  else if (o.qualityLevel) args.push('-o', 'print-quality=' + ({ draft: 3, normal: 4, best: 5 }[o.qualityLevel] || 4));
  if (o.color === false) args.push('-o', 'print-color-mode=monochrome');
  if (typeof o.title === 'string' && o.title) args.push('-t', o.title.slice(0, 80));
  return args;
}

module.exports = { SAFE_OPTION, parseLpOptions, dimensionsForPaper, mapWindowsCapabilities, buildLpArgs };
