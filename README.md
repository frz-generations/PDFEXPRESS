<<<<<<< HEAD
# FRZ PDF Express

**An open-source application by FRZ Generations** — a 33-tool PDF, image and document toolkit for browser and optional Windows/Linux desktop use. The project keeps its existing HTML/CSS/JavaScript architecture, bundled libraries, FRZ branding and local-processing design. Selected files are handled by the client on the device running the app; this source contains no remote document-processing backend.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Important storage detail:** PDFs opened in the PDF Viewer are stored in that local browser/app profile's IndexedDB for the “Recent files” feature until removed or the history is cleared. The viewer has “Remove” and “Clear history” controls. See [Policies: privacy and local storage](policies.html#privacy). No government approval, GIGW/WCAG/BIS conformity, security clearance, or STQC certification is claimed for this source version.

## Credit and licence

The original code is credited to **Faraz Ahammed CM / FRZ Generations**, who are its sole creators. Third-party libraries, fonts and OCR data retain their authors' licences; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md), `vendor/README.md` and `vendor/licenses/`.

Released under the [MIT License](LICENSE). Preserve the copyright and permission notice and the FRZ attribution in [`NOTICE`](NOTICE) when using, copying or redistributing this project. Mark modified versions as modified and do not imply FRZ Generations endorses them. See the notice for the original suggested wording.

## Tools

- **Organise:** merge, split, reorder, delete pages, rotate, insert blank pages, extract pages and add page numbers
- **Convert:** image-to-PDF, phone scan-to-PDF, PDF-to-images, spreadsheet/CSV-to-PDF, PPTX-to-PDF, PDF-to-image-based-PPTX, PDF-to-XLSX, DOCX-to-PDF, PDF-to-DOCX and PDF-to-Markdown
- **Edit and sign:** watermark, highlight, add text, redact, fill and overlay, flatten, crop, visual signature
- **Read and extract:** PDF viewer, OCR (English and Malayalam), fast text extraction and PDF metadata editing
- **Compare and improve:** compare selectable text, compress to a target size and repair PDFs

The landing-page catalog is checked to contain 33 unique tool entries. The source project remains the reference for exact individual tool inputs and output formats.

## Processing limitations

- PDF “Crop” changes the visible crop box; it does not remove content outside that box. Use a tool that actually redacts content when removal is intended, and verify the result.
- “Sign PDF” adds a visual signature image, not a certificate-based digital signature.
- PDF comparison operates on selectable text, not visual page layout. OCR may be required before extracting scanned documents.
- Office conversions are text-focused. PPTX and DOCX exports do not reproduce the source visual layout; spreadsheet-to-PDF formatting and table reconstruction can differ from the original. Review all outputs before relying on them. PDF pages to PPTX are image-based slides.
- Large files depend on device memory and browser/runtime capabilities. Camera access is requested only after the explicit “Start rear camera” action in the phone Scan to PDF tool.
- The interface is English-only; accessible behavior and generated-document conformance have not been independently validated.

See [`llms.txt`](llms.txt) for a concise capability description, [`policies.html`](policies.html) for user-facing notices, [`DATA-FLOW-AND-RETENTION.md`](DATA-FLOW-AND-RETENTION.md) for the source-reviewed data-flow map, and [`GUIDELINES-COMPLIANCE.md`](GUIDELINES-COMPLIANCE.md) for the requirement and evidence crosswalk.

## Run the web app locally

Serve the project folder from an HTTP static server (for example, `python3 -m http.server`) and open `index.html`. Libraries, fonts and OCR language data are bundled in the project. The web app can operate offline after its assets have been loaded/cached. When hosted, the web server or hosting provider still controls transport, HTTP security headers, and ordinary request logs.

## Desktop installers (.deb for Linux, .exe for Windows)

The `desktop/` folder wraps the same app in Electron. Use the existing target scripts and pinned dependency lockfile:

```sh
cd desktop
npm ci
npm test
npm run test:static
npm audit --audit-level=high
npm run dist:linux       # Linux .deb
npm run dist:win         # Windows installers; building Windows targets from Linux requires Wine
```

The desktop package version is `1.1.0`, as supplied in the source archive. Dependency updates and release rebuilds should be tested against the exact desktop version and target OS. See [`desktop/README.md`](desktop/README.md), [`desktop/package.json`](desktop/package.json), and [`desktop/package-lock.json`](desktop/package-lock.json).

## Security and validation

Run the local project checks with:

```sh
python3 tools/check-project.py
python3 tools/check-notices.py
cd desktop && npm ci --ignore-scripts && npm test && npm audit --audit-level=high
```

These are source-tree checks, unit regression tests, and package advisory checks; they are **not** a penetration test, production audit, accessibility evaluation, or proof of compliance. As of the audit on 11 November 2026, the lockfile reports **0 high/critical and 6 moderate** findings, all through the build-tool `minimatch` dependency tree. The high-severity gate passes; npm's reported force fix would downgrade `electron-builder` to 24.13.3, so this remediation did not force a breaking builder downgrade or apply an unreviewed semver override. Treat those moderate findings as unresolved build-tool risk and recheck the full audit before release; registry findings can change. The existing desktop installer workflow runs notice/static/security checks, locks dependency installation to the lockfile, and gates builds on the high-severity audit threshold. Review `.github/workflows/build-desktop.yml`; hosted actions remain external workflow dependencies that the repository owner must monitor and pin as required by their supply-chain policy.

Before institutional deployment, complete the [deployment readiness checklist](INSTITUTIONAL-PILOT-CHECKLIST.md). It identifies production controls that cannot be evidenced by a source archive: applicability, independent security audit/clearance, server headers/logging, ownership, user testing, procurement and release signing. This work makes no claim that those controls have been completed.

## Files

`index.html` landing page · `app.html` tools · `policies.html` privacy/accessibility/terms/licence · `viewer.js` PDF viewer and local Recent-files history · `converters.js`, `officeconv.js`, `advanced-tools.js`, `scan-phone.js`, `site-enhancements.js`, `accessibility.js` modules · `sw.js` offline cache · `vendor/` bundled third-party files · `desktop/` Electron packaging, security and printer-capability helpers/tests · `tools/check-project.py`, `tools/check-notices.py` and `tools/generate-sbom.py` · `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, `SBOM.spdx.json`, `GUIDELINES-COMPLIANCE.md`, `RESEARCH-SOURCES.md`, `PRINTING-SOURCES.md`, `DATA-FLOW-AND-RETENTION.md`, `REMEDIATION-REPORT.md`, `INSTITUTIONAL-PILOT-CHECKLIST.md`.

## Contact

FRZ Generations — [frzgenerations@gmail.com](mailto:frzgenerations@gmail.com)

## Printing and editing in the viewer

The existing PDF Viewer retains its print and editing workflows: print ranges, multiple pages per side, folded and “cut & pin” booklets, save imposed layout as a vector PDF, save-edited-copy workflow, undo/redo, page actions, and supported zoom/file shortcuts. Review output before printing or sharing. The local viewer retention is described above and in [Policies](policies.html#privacy).

## File names, phones and installing

Generated filenames include the action and the `frz` suffix (for example, `report-bookletfrz.pdf`); the suffix is not inserted into the PDF by that filename convention. Phone downloads depend on the browser/OS and normally go to Downloads. `device.js` performs device/browser detection locally and may offer the configured official app download link and browser installation steps. The desktop app does not display website installation prompts. Review the `OFFICIAL_APP_URL` constant in `device.js` before publishing a copy.

## Printing on Windows

The desktop print window shows paper sizes, trays, paper types and quality modes when the selected Windows printer driver reports them. Paper dimensions are used in the print layout; supported size/tray/type/quality choices are sent through the Windows PrintTicket helper. **Driver Properties…** opens the printer manufacturer's native settings panel. **System print dialog…** opens the operating-system dialog for settings not exposed by the driver capability list. Windows direct printing renders pages as images. The web version cannot read installed printer-driver settings.

## Printing on Ubuntu/Linux

When available, the selected CUPS printer queue's `lpoptions` list supplies its paper sizes, input trays, media types and quality/resolution values. The app passes selected values with the print job (`media=` for size and advertised queue options for other settings). If CUPS capability discovery or direct job submission is unavailable, use **System print dialog…** to select a printer and its native settings. Printer/driver combinations vary; the Windows and CUPS code paths have regression tests, but this source-only task did not test a physical printer, a Windows host or each Ubuntu desktop environment. See [`desktop/README.md`](desktop/README.md) and [`PRINTING-SOURCES.md`](PRINTING-SOURCES.md).
=======
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
>>>>>>> 0f24d202aa411c19baf13ae2e4dbe86d860c2ed7
