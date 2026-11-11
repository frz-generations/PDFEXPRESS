# Changelog

Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations — MIT License.

## Unreleased — local source remediation (8–11 November 2026; product version remains 1.1.0)

- Hardened the Electron app protocol, origin-bound IPC handlers (including default-PDF actions), and deny-by-default permission checks; added Node regression tests. This source copy was not packaged into installers.
- Updated exact desktop build dependencies to Electron 44.10.2 and electron-builder 26.18.0, added a lockfile/audit gate, and generated an SPDX 2.3 snapshot SBOM. The current registry audit reports no high/critical findings but still reports six moderate minimatch-related build-tool findings; see `REMEDIATION-REPORT.md`.
- Disclosed PDF Viewer IndexedDB Recent-files retention and user deletion controls in the app, landing page and policies; corrected conversion-fidelity and unsupported audit/approval claims; added source-based crosswalk and institutional readiness documentation.
- Exposed printer-reported paper size, tray, media type and quality controls in the existing print window for Electron's Windows and CUPS/Linux paths; added a native system print-dialog route when app-level discovery is unavailable. Reported capabilities are driver/queue dependent; no feature-parity or hardware-test claim is made.
- Added CUPS and Windows PrintCapabilities mapping tests, preserved the driver Properties workflow, used reported paper dimensions in layout, and prevented unsupported quality/paper values from being sent as if advertised.
- Incremented the service-worker cache version so existing offline clients re-fetch the modified print workflow. No new installer was built; the desktop product version remains 1.1.0.

## 1.1.0

### Added
- **Compress PDF by target size.** The quality selector is replaced by a size box (KB / MB, with 500 KB, 1, 2, 5 and 10 MB shortcuts). The app lowers photo quality step by step and keeps the gentlest setting that fits. If the PDF has too little image data to reach the target, it saves the smallest size possible and says so. Pages are never flattened.
- Print dialog now has Acrobat-style sub-windows: **Properties** (Layout: orientation, both sides, page order; Paper/Quality: paper source, media, Better/Draft/Best, colour, and an **Advanced…** options list for paper size, copies, print quality, colour mode, borderless, scaling) and **Advanced Print Setup** (colour management, Print As Image, Simulate Overprinting, Print to File).
- **Windows desktop: printer-driver settings.** Where the selected driver reports them, paper source, media type, quality modes and paper sizes are read through PrintCapabilities and applied through the existing PrintTicket path. Available options and semantics vary by driver; this is not a claim of Adobe feature parity. Linux uses queue-reported CUPS options when available.
- **Windows: native Driver Properties.** The app can open the selected printer driver's own Properties window and pass the returned device settings to its print helper. Driver capabilities and the native dialog remain dependent on the installed driver; a system print dialog is also available.
- Desktop app: the close button now asks to save a copy or discard when files have unsaved edits, and closes immediately when nothing was edited.
- Text-focused Word, Excel and PowerPoint to PDF exports (output layout may differ from the source); paste copied Excel cells; trim trailing empty cells and choose a range.
- Acrobat-style print dialog (page sizing, poster, multiple pages per sheet, booklet, duplex, copies, gray).
- Phone support: device detection, install/official-app notice (web only), downloads named `<file>-<action>frz.<ext>`.

### Fixed
- Compress PDF: now also shrinks JPEG photos tagged with ICC or grayscale colour spaces (previously skipped, so many PDFs saw no change), and, when the size still can't be reached, can rebuild pages as images (optional tick box) so the chosen size is met.
- Phones: file chooser no longer fires twice when tapping an upload area; heavy libraries (spreadsheet, PowerPoint) load only when needed; blur and animations reduced on phones.
- Viewer ribbon wraps on phones so every button is visible.
- "PDF to images" zip name no longer repeats the file name.
