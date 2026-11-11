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
