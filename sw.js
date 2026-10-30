/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations (https://github.com/frz-generations).
 * Created by FRZ Generations as an open-source application, following government open-source guidelines.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 */
const CACHE_NAME = 'frz-pdf-express-v20';
const APP_SHELL = [
  './',
  './index.html',
  './app.html',
  './converters.js',
  './officeconv.js',
  './device.js',
  './advanced-tools.js',
  './scan-phone.js',
  './site-enhancements.js',
  './viewer.js',
  './vendor/fontkit.min.js',
  './vendor/fonts/noto/NotoSans-400.woff',
  './vendor/fonts/noto/NotoSans-700.woff',
  './vendor/fonts/noto/NotoSansMalayalam-400.woff',
  './vendor/fonts/noto/NotoSansMalayalam-700.woff',
  './print.js',
  './accessibility.js',
  './policies.html',
  './site.webmanifest',
  './routes.json',
  './llms.txt',
  './LICENSE',
  './NOTICE',
  './brand-logo.png',
  './favicon-32.png',
  './favicon-16.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
];

const LIBRARY_URLS = [
  './vendor/pdf-lib.min.js',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './vendor/jszip.min.js',
  './vendor/xlsx.full.min.js',
  './vendor/pptxgen.min.js',
  './vendor/tesseract/tesseract.min.js',
  './vendor/tesseract/worker.min.js',
  './vendor/fonts/fonts.css',
  // Large OCR engine and language files are cached the first time OCR is used.
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await Promise.allSettled(LIBRARY_URLS.map(async url => {
      const response = await fetch(url);
      if (response.ok) await cache.put(url, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('frz-pdf-express-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const request = event.request;
  const url = new URL(request.url);

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(request)) || (await caches.match('./app.html')) || (await caches.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (cached) return cached;
      throw error;
    }
  })());
});
