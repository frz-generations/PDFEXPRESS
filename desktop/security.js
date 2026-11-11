/*
 * FRZ PDF Express — Electron security policy helpers
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations
 * Sole creators: Faraz Ahammed CM / FRZ Generations.
 * SPDX-License-Identifier: MIT
 * Keep this notice and the original creator credit; see LICENSE and NOTICE.
 */
'use strict';

const APP_PROTOCOL = 'app:';
const APP_HOST = 'local';
const APP_DOCUMENT_PATH = '/app.html';

function parseUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  try { return new URL(value); } catch (_) { return null; }
}

function isTrustedAppUrl(value) {
  const url = parseUrl(value);
  return !!url && url.protocol === APP_PROTOCOL && url.hostname === APP_HOST &&
    !url.username && !url.password && !url.port;
}

function isTrustedAppDocument(value) {
  const url = parseUrl(value);
  return isTrustedAppUrl(value) && url.pathname === APP_DOCUMENT_PATH;
}

function isTrustedMainFrameEvent(event, expectedWebContents) {
  if (!event || !expectedWebContents || event.sender !== expectedWebContents || !event.senderFrame) return false;
  if (!expectedWebContents.mainFrame || event.senderFrame !== expectedWebContents.mainFrame) return false;
  return isTrustedAppDocument(event.senderFrame.url);
}

function isTrustedPermissionContext(webContents, expectedWebContents, requestingUrl, details = {}) {
  if (!webContents || !expectedWebContents || webContents !== expectedWebContents || details.isMainFrame === false) return false;
  const requested = parseUrl(requestingUrl);
  const mainFrameUrl = expectedWebContents.mainFrame && expectedWebContents.mainFrame.url;
  if (!isTrustedAppDocument(mainFrameUrl) || !requested || !isTrustedAppUrl(requestingUrl)) return false;
  if (requested.pathname === APP_DOCUMENT_PATH) return true;
  // Permission checks may provide an origin URL rather than a document URL.
  return details.isMainFrame === true && requested.pathname === '/';
}

function mayGrantPermissionRequest(permission, details = {}) {
  if (permission === 'clipboard-sanitized-write') return true;
  if (permission !== 'media' || !Array.isArray(details.mediaTypes)) return false;
  return details.mediaTypes.includes('video') && !details.mediaTypes.includes('audio');
}

function mayGrantPermissionCheck(permission, details = {}) {
  if (permission === 'clipboard-sanitized-write') return true;
  return permission === 'media' && details.mediaType === 'video' && details.isMainFrame === true;
}

module.exports = {
  APP_PROTOCOL,
  APP_HOST,
  APP_DOCUMENT_PATH,
  isTrustedAppUrl,
  isTrustedAppDocument,
  isTrustedMainFrameEvent,
  isTrustedPermissionContext,
  mayGrantPermissionRequest,
  mayGrantPermissionCheck,
};
