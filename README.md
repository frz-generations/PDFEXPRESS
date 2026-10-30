<<<<<<< HEAD
# FRZ PDF Express

**An open-source application by FRZ Generations** — free PDF, image and document tools that run entirely on your device. FRZ Generations provides open-source apps for governments and for anyone who wishes to use them in their own applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

33 tools · no server · no account · no tracking · no third-party requests · works offline · exported files carry **no watermark or branding**.

## Credit

The original code is credited to **Faraz Ahammed CM / FRZ Generations**, who are its sole creators (third-party libraries in `vendor/` belong to their authors). It is based on government open-source and open-standards guidelines — see [`GUIDELINES-COMPLIANCE.md`](GUIDELINES-COMPLIANCE.md) for what is done and what still needs an official audit.

## Licence and reuse — take it, edit it, keep the notice

Released under the [MIT License](LICENSE). Anyone — governments, companies, individuals — may use, copy, edit, publish, distribute and sell it, **provided the copyright notice and licence text stay unchanged** in all copies and substantial portions, and the credit in [`NOTICE`](NOTICE) is given: *"Based on FRZ PDF Express, created by Faraz Ahammed CM / FRZ Generations. Licensed under the MIT License."* Modified versions should say they are modified. You may add your own copyright line for your changes; do not remove or alter the original.

Check that notices are intact after you edit: `python3 tools/check-notices.py`

## Tools

- **Organise:** merge, split, organise/reorder, delete pages, rotate, insert blank pages, extract pages, page numbers
- **Convert:** image→PDF, scan→PDF (phone camera), PDF→images, spreadsheet/CSV→PDF, PPTX→PDF, PDF→PPTX, PDF→XLSX, DOCX→PDF, PDF→DOCX, PDF→Markdown
- **Edit & sign:** add watermark (your own text/image), highlight, add text, redact, fill & overlay, flatten, crop, visual signature
- **Read & extract:** viewer, OCR (English, Malayalam), fast text extraction, edit PDF info
- **Compare & improve:** compare PDFs, compress to a size you choose (KB or MB), repair

Limitations: crop changes the visible crop box and does not erase hidden content; the signature is visual, not a certificate-based digital signature; PDF compare reads selectable text only; Word, Excel and PowerPoint conversions keep layout, styles, tables and pictures but not charts, SmartArt, animations or tracked changes; very large files depend on device memory; the interface is English only.

## Run on the web

Serve the folder from any static web server (for example `python3 -m http.server`) and open `index.html`. Everything needed — libraries, fonts and OCR language data — is in this folder; no internet connection is required.

## Desktop installers (.deb for Linux, .exe for Windows)

The `desktop/` folder wraps the same app in Electron. See [`desktop/README.md`](desktop/README.md).

```
cd desktop && npm install
npm run dist:linux     # dist/frz-pdf-express_1.1.0_amd64.deb
npm run dist:win       # Setup .exe and Portable .exe  (on Linux needs wine)
```

## Files

`index.html` landing page · `app.html` tools · `policies.html` accessibility/privacy/terms/licence · `converters.js`, `advanced-tools.js`, `scan-phone.js`, `site-enhancements.js`, `accessibility.js` modules · `sw.js` offline cache · `vendor/` bundled third-party files · `desktop/` Electron packaging · `tools/check-notices.py` · `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, `GUIDELINES-COMPLIANCE.md`, `SECURITY.md`, `CONTRIBUTING.md`.

## Contact

FRZ Generations — frzgenerations@gmail.com

## Printing from the viewer

The viewer has a built-in print window (Ctrl+P): custom page ranges, several pages per side, a classic folded booklet, and "cut & pin" booklets with any number of pages per side (front and back carry the matching continuous pages). "Download as PDF" saves the imposed layout as a vector PDF. A one-click "Print using default (Ctrl+P) options" button is always shown; the default behaviour can be changed in Settings.

## Editing in the viewer

Undo/redo (Ctrl+Z / Ctrl+Y), a ⋯ menu on every page (redact all text and/or images, delete the page, add a blank page, download the page as an image or PDF, open it in a new tab), pinch and Ctrl +/- zoom, Ctrl+U to open files, and Ctrl+S (or Ctrl+C with nothing selected) to save "name (copy).pdf" — which is then kept up to date as you keep editing. Closing a tab or leaving the viewer asks to Save as copy or Discard only if the document really differs from its saved state. Word, spreadsheet and slide conversions embed Noto Sans and Noto Sans Malayalam so Malayalam text stays real, selectable text.

## File names, phones and installing
- Every PDF the app creates is named `<original name>-<action>frz.pdf` (for example `report-bookletfrz.pdf`, `report-highlightedfrz.pdf`). "frz" is only in the file name, never inside the PDF.
- On phones, files are downloaded (check the Downloads folder). `device.js` detects the device, OS, model and browser locally and, on the website only, offers the official app link and "Install as app" (iPhone/iPad: Safari → Share → Add to Home Screen; other iOS browsers show that this device can't install from them). The desktop app never shows install prompts. Set the official download link in the `OFFICIAL_APP_URL` constant at the top of `device.js`.
=======
# PDFEXPRESS
>>>>>>> eb02d578214cb3907cb8235c7d3c377f690492aa
