# Guidelines compliance checklist

FRZ PDF Express by **Faraz Ahammed CM / FRZ Generations** is built to follow government open-source and open-standards guidelines, using the **Guidelines for Indian Government Websites and Apps (GIGW 3.0)**, **WCAG 2.1 Level AA** and open-source licensing practice as its yardstick.

> **Honest status:** this is a developer self-assessment. It is **not** an official certification. GIGW 3.0 conformance is confirmed by an audit (for example by STQC or another empanelled auditor), and a department deploying this app should also obtain its own security audit. Items marked "Needs official action" cannot be done by the developer alone. Replace this note with the audit certificate details once obtained.

GIGW 3.0 focus areas (from guidelines.india.gov.in): Quality, Accessibility, Cybersecurity, Lifecycle management.

| Area | Requirement | Status | Evidence in this repository |
|---|---|---|---|
| Licence | OSI-approved open-source licence, copyright notice preserved | Done | `LICENSE` (MIT), `NOTICE`, headers in every source file, `tools/check-notices.py` |
| Licence | Third-party components identified with licences | Done | `THIRD_PARTY_NOTICES.md`, `vendor/licenses/` |
| Open standards | HTML5/CSS/JS, PDF, PNG/JPEG/WebP, ZIP, DOCX/XLSX/PPTX, QR (ISO/IEC 18004) | Done | no proprietary runtime or plug-in |
| Accessibility | WCAG 2.1 AA — automated check (axe-core) on landing page, app home, policies page and the new tool screens, light and dark themes | Done: 0 violations at last run | see "How it was tested" below |
| Accessibility | Keyboard operation, visible focus, skip link, labelled controls, live status messages, reduced motion | Done | `accessibility.js`, CSS `:focus-visible`, `skip-link` |
| Accessibility | Independent audit incl. screen-reader testing of every tool | Needs official action | PDF page-preview tools (viewer, organise, crop, sign) are visual; limitations stated in `policies.html#accessibility` |
| Accessibility | Multiple Indian languages | Partly | OCR and text tools handle Malayalam; the **interface is English only** |
| Quality | Policy pages: accessibility statement, privacy, terms, copyright, help, contact, security contact | Done | `policies.html`, `.well-known/security.txt` |
| Quality | Responsive, works offline, fast (no external fonts/CDNs) | Done | all assets in `vendor/`, service worker |
| Privacy | No personal data collected; no cookies, analytics or third-party calls | Done | strict CSP on all pages; verified no external requests in browser and desktop tests |
| Cybersecurity | Content Security Policy, no inline objects, `no-referrer`, no eval | Done | `<meta http-equiv="Content-Security-Policy">` |
| Cybersecurity | Dependency inventory with pinned versions | Done | `vendor/README.md` |
| Cybersecurity | Application security audit / VAPT before government hosting | Needs official action | |
| Cybersecurity | Hosting: security headers (HSTS, `frame-ancestors`, `X-Content-Type-Options`) must be set by the web server | Needs official action | meta CSP cannot set `frame-ancestors`; configure at the host |
| Lifecycle | Version control, documentation, contribution and vulnerability process | Done | `README.md`, `CONTRIBUTING.md`, `SECURITY.md` |
| Lifecycle | Domain, hosting and ownership details, official branding and approvals | Needs official action | the app states it is not an official government site unless the deploying body says so |
| Policy | Which state/department policy applies (for example the Kerala IT policy / KSUM / OpenForge onboarding rules) | Needs official action | confirm the exact policy documents with the receiving body and cite them here |

## How it was tested

- axe-core 4 with the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` rule sets, run in a headless Chromium on `index.html`, `policies.html`, `app.html` (home, merge, OCR, watermark, compress and all new tool screens), in dark and light themes.
- Functional tests of the new tools in Chromium (resize to a size limit, QR round-trip decode incl. Malayalam, SHA-256 against a known vector, OCR with the bundled language data, Indian number-to-words, age arithmetic).
- Desktop shell run under a virtual display (Linux) with a PDF passed on the command line.
- Automated tests do not replace manual assistive-technology testing.
