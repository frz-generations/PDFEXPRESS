/*
 * FRZ PDF Express — Electron security regression tests
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations
 * Sole creators: Faraz Ahammed CM / FRZ Generations.
 * SPDX-License-Identifier: MIT
 * Keep this notice and the original creator credit; see LICENSE and NOTICE.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isTrustedAppUrl,
  isTrustedAppDocument,
  isTrustedMainFrameEvent,
  isTrustedPermissionContext,
  mayGrantPermissionRequest,
  mayGrantPermissionCheck,
} = require('../security');

test('trusted app URL parsing rejects host, credential, scheme, and port spoofing', () => {
  for (const value of ['app://local/', 'app://local/app.html']) {
    assert.equal(isTrustedAppUrl(value), true, value);
  }
  for (const value of [
    'https://local/app.html',
    'app://local.evil/app.html',
    'app://local@evil.example/app.html',
    'app://evil.example@local/app.html',
    'app://local:8443/app.html',
    'APP://LOCAL/app.html',
    'app:local/app.html',
    'not a URL',
    '',
    null,
  ]) assert.equal(isTrustedAppUrl(value), false, String(value));
});

test('privileged app document is limited to the actual tools page', () => {
  assert.equal(isTrustedAppDocument('app://local/app.html'), true);
  assert.equal(isTrustedAppDocument('app://local/policies.html'), false);
  assert.equal(isTrustedAppDocument('blob:app://local/app.html'), false);
  assert.equal(isTrustedAppDocument('app://local.evil/app.html'), false);
});

test('IPC is accepted only from the expected main frame and tools document', () => {
  const frame = { url: 'app://local/app.html' };
  const contents = { mainFrame: frame };
  assert.equal(isTrustedMainFrameEvent({ sender: contents, senderFrame: frame }, contents), true);
  assert.equal(isTrustedMainFrameEvent({ sender: {}, senderFrame: frame }, contents), false);
  assert.equal(isTrustedMainFrameEvent({ sender: contents, senderFrame: { url: frame.url } }, contents), false);
  assert.equal(isTrustedMainFrameEvent({ sender: contents, senderFrame: { url: 'app://local/policies.html' } }, contents), false);
  assert.equal(isTrustedMainFrameEvent({ sender: contents, senderFrame: null }, contents), false);
  assert.equal(isTrustedMainFrameEvent(null, contents), false);
});

test('permission context requires the expected Electron window and main app origin', () => {
  const frame = { url: 'app://local/app.html' };
  const contents = { mainFrame: frame };
  assert.equal(isTrustedPermissionContext(contents, contents, 'app://local/app.html'), true);
  assert.equal(isTrustedPermissionContext(contents, contents, 'app://local/', { isMainFrame: true }), true);
  assert.equal(isTrustedPermissionContext({}, contents, 'app://local/app.html'), false);
  assert.equal(isTrustedPermissionContext(contents, contents, 'app://local.evil/app.html'), false);
  assert.equal(isTrustedPermissionContext(contents, contents, 'app://local/policies.html'), false);
  assert.equal(isTrustedPermissionContext(contents, contents, 'app://local/app.html', { isMainFrame: false }), false);
  assert.equal(isTrustedPermissionContext(contents, contents, 'blob:app://local/app.html'), false);
  assert.equal(isTrustedPermissionContext(contents, contents, undefined, { isMainFrame: true }), false);
});

test('media request grants camera only, never microphone, screen capture, or unknown permissions', () => {
  assert.equal(mayGrantPermissionRequest('media', { mediaTypes: ['video'] }), true);
  assert.equal(mayGrantPermissionRequest('media', { mediaTypes: ['audio'] }), false);
  assert.equal(mayGrantPermissionRequest('media', { mediaTypes: ['audio', 'video'] }), false);
  assert.equal(mayGrantPermissionRequest('media', {}), false);
  assert.equal(mayGrantPermissionRequest('display-capture', { mediaTypes: ['video'] }), false);
  assert.equal(mayGrantPermissionRequest('geolocation', {}), false);
  assert.equal(mayGrantPermissionRequest('clipboard-sanitized-write', {}), true);
});

test('permission checks require a main-frame video request and deny unknown contexts', () => {
  assert.equal(mayGrantPermissionCheck('media', { mediaType: 'video', isMainFrame: true }), true);
  assert.equal(mayGrantPermissionCheck('media', { mediaType: 'audio', isMainFrame: true }), false);
  assert.equal(mayGrantPermissionCheck('media', { mediaType: 'unknown', isMainFrame: true }), false);
  assert.equal(mayGrantPermissionCheck('media', { mediaType: 'video', isMainFrame: false }), false);
  assert.equal(mayGrantPermissionCheck('media', { mediaType: 'video' }), false);
  assert.equal(mayGrantPermissionCheck('notifications', { isMainFrame: true }), false);
  assert.equal(mayGrantPermissionCheck('clipboard-sanitized-write', {}), true);
});
