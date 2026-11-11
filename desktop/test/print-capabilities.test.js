/*
 * FRZ PDF Express — printer capability regression tests
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations
 * Sole creators: Faraz Ahammed CM / FRZ Generations.
 * SPDX-License-Identifier: MIT
 * Keep this notice and the original creator credit; see ../LICENSE and ../NOTICE.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseLpOptions, buildLpArgs, dimensionsForPaper, mapWindowsCapabilities } = require('../print-capabilities');

test('CUPS output exposes only advertised paper, tray, media and quality choices', () => {
  const caps = parseLpOptions([
    'PageSize/Media Size: *iso_a4_210x297mm iso_a3_297x420mm na_letter_8.5x11in',
    'InputSlot/Media Source: *Auto Tray1 PhotoTray',
    'MediaType/Media Type: *Plain Glossy',
    'Resolution/Output Resolution: *300dpi 600dpi 1200dpi',
    'OutputMode/Output Mode: *Color Gray',
  ].join('\n'));
  assert.deepEqual(caps.paperSizes.map(x => x.value), ['iso_a4_210x297mm', 'iso_a3_297x420mm', 'na_letter_8.5x11in']);
  assert.deepEqual(caps.tray.map(x => x.value), ['Auto', 'Tray1', 'PhotoTray']);
  assert.deepEqual(caps.mediaType.map(x => x.value), ['Plain', 'Glossy']);
  assert.deepEqual(caps.quality.map(x => x.value), ['300dpi', '600dpi', '1200dpi']);
  assert.equal(caps.qualityKey, 'Resolution');
  assert.equal(caps.paperSizes[0].def, true);
  assert.equal(caps.paperSizes[1].def, false);
  assert.deepEqual(dimensionsForPaper('iso_a4_210x297mm'), { widthMm: 210, heightMm: 297 });
  assert.deepEqual(dimensionsForPaper('na_letter_8.5x11in'), { widthMm: 215.9, heightMm: 279.4 });
});

test('CUPS parser does not mislabel color mode as print quality or accept unsafe options', () => {
  const caps = parseLpOptions([
    'OutputMode/Output Mode: *Color Gray',
    'InputSlot/Media Source: *Auto Bad$(command) Tray_2',
    'PageSize/Media Size: *A4;touch',
  ].join('\n'));
  assert.deepEqual(caps.quality, []);
  assert.deepEqual(caps.tray.map(x => x.value), ['Auto', 'Tray_2']);
  assert.deepEqual(caps.paperSizes, []);
});

test('CUPS job arguments carry only selected, safe printer-reported options', () => {
  const args = buildLpArgs({
    printer: 'Office Printer', copies: 3, sides: 'long', paperSize: 'iso_a4_210x297mm',
    tray: 'Tray1', mediaType: 'Glossy', quality: '600dpi', qualityKey: 'Resolution',
    color: false, title: 'Quarterly report',
  });
  assert.deepEqual(args, [
    '-d', 'Office Printer', '-n', '3', '-o', 'sides=two-sided-long-edge',
    '-o', 'media=iso_a4_210x297mm', '-o', 'InputSlot=Tray1', '-o', 'MediaType=Glossy',
    '-o', 'Resolution=600dpi', '-o', 'print-color-mode=monochrome', '-t', 'Quarterly report',
  ]);
});

test('unsafe option values are ignored and copy count is bounded', () => {
  const args = buildLpArgs({
    printer: 'Queue', copies: 900, sides: 'unknown', paperSize: 'A4; rm -rf', tray: 'Tray 1',
    mediaType: 'Plain', quality: '600dpi', qualityKey: 'Resolution', qualityLevel: 'draft',
  });
  assert.deepEqual(args, [
    '-d', 'Queue', '-n', '99', '-o', 'sides=one-sided', '-o', 'MediaType=Plain',
    '-o', 'Resolution=600dpi',
  ]);
});

test('Windows PrintCapabilities expose only sized media and preserve driver feature tokens', () => {
  const caps = mapWindowsCapabilities([
    { name: 'psk:PageMediaSize', uri: 'psk-uri', options: [
      { name: 'psk:ISOA4', uri: 'psk-uri', widthMm: 210, heightMm: 297, def: true },
      { name: 'psk:NorthAmericaLetter', uri: 'psk-uri', widthMm: 215.9, heightMm: 279.4 },
      { name: 'psk:CustomMediaSize', uri: 'psk-uri', widthMm: 0, heightMm: 0 },
    ] },
    { name: 'psk:PageInputBin', uri: 'psk-uri', options: [{ name: 'psk:AutoSelect' }, { name: 'psk:Tray2', display: 'Rear tray', uri: 'psk-uri' }] },
    { name: 'psk:PageMediaType', uri: 'psk-uri', options: [{ name: 'psk:Plain', display: 'Plain paper' }] },
    { name: 'psk:PageOutputQuality', uri: 'psk-uri', options: [{ name: 'psk:Draft' }, { name: 'psk:High' }] },
  ]);
  assert.equal(caps.win, true);
  assert.deepEqual(caps.paperSizes.map(x => [x.value, x.label, x.def]), [['psk:ISOA4', 'A4', true], ['psk:NorthAmericaLetter', 'Letter', false]]);
  assert.equal(caps.feats.paperSize.feature, 'psk:PageMediaSize');
  assert.equal(caps.meta['paperSize|psk:ISOA4'], 'psk-uri');
  assert.deepEqual(caps.tray.map(x => x.value), ['psk:Tray2']);
  assert.deepEqual(caps.mediaType.map(x => x.value), ['psk:Plain']);
  assert.deepEqual(caps.quality.map(x => x.value), ['psk:Draft', 'psk:High']);
  assert.equal(caps.qualityKey, 'ticket');
});
