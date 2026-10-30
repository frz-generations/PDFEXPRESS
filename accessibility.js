/*!
 * FRZ PDF Express — an open-source application by FRZ Generations
 * Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations. All rights reserved except as granted by the MIT License.
 * Sole creators: Faraz Ahammed CM / FRZ Generations.
 * SPDX-License-Identifier: MIT
 * Any use, copy, modification or redistribution must keep this notice and credit
 * "Faraz Ahammed CM / FRZ Generations" (see LICENSE and NOTICE).
 *
 * Accessibility helpers: keyboard operation for drop zones, live-region roles
 * for progress messages, and a labelled main landmark.
 */
(() => {
  'use strict';
  function enhance(root) {
    root.querySelectorAll('.dropzone').forEach(zone => {
      if (zone.dataset.a11y) return;
      zone.dataset.a11y = '1';
      zone.setAttribute('tabindex', '0');
      zone.setAttribute('role', 'button');
      zone.addEventListener('keydown', e => {
        if (e.target !== zone) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zone.click(); }
      });
    });
    root.querySelectorAll('.status').forEach(el => { if (!el.hasAttribute('role')) { el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); } });
    root.querySelectorAll('svg:not([aria-hidden]):not([role])').forEach(svg => { if (!svg.closest('[aria-label]')) svg.setAttribute('aria-hidden', 'true'); });
  }
  const run = () => enhance(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
