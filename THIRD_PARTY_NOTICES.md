# Third-party notices

FRZ PDF Express's own code is MIT-licensed (see `LICENSE`). The files below are
**bundled in `vendor/`** so the app needs no internet connection and contacts no
third-party server. They keep their own licences; copies are in `vendor/licenses/`.

| Component | Version | Licence | Source |
|---|---|---|---|
| pdf-lib | 1.17.1 | MIT | https://github.com/Hopding/pdf-lib |
| PDF.js | 3.11.174 | Apache-2.0 | https://github.com/mozilla/pdf.js |
| JSZip | 3.10.1 | MIT or GPL-3.0 (dual; used under MIT) | https://github.com/Stuk/jszip |
| Tesseract.js | 5.0.4 | Apache-2.0 | https://github.com/naptha/tesseract.js |
| Tesseract.js Core | 5.0.0 | Apache-2.0 | https://github.com/naptha/tesseract.js-core |
| Tesseract language data (English, Malayalam) | tessdata "best" 4.0.0 | Apache-2.0 (data); npm wrapper MIT | https://github.com/tesseract-ocr/tessdata_best |
| SheetJS (xlsx) | 0.18.5 | Apache-2.0 | https://github.com/SheetJS/sheetjs |
| PptxGenJS | 3.12.0 | MIT | https://github.com/gitbrent/PptxGenJS |
| @pdf-lib/fontkit | 1.1.1 | MIT | https://github.com/Hopding/fontkit |
| Noto Sans, Noto Sans Malayalam (fonts, used for Unicode text in converted PDFs) | via Fontsource | SIL Open Font License 1.1 | https://fontsource.org |
| Inter, Fraunces, IBM Plex Mono (fonts) | via Fontsource 5.3.0 | SIL Open Font License 1.1 | https://fontsource.org |

## Desktop installers (.deb / .exe)

<<<<<<< HEAD
The supplied archive contains desktop build sources, not prebuilt installers.
The current desktop lockfile selects **Electron 44.10.2** (MIT), which bundles
Chromium and Node.js components into installers when built. Those upstream
component licence materials are part of the Electron runtime; verify the
resulting package's `LICENSE` and `LICENSES.chromium.html` before release.
The pinned `electron-builder` 26.18.0 dependency is build tooling, not shipped
application runtime.
=======
The installers in `desktop/` additionally contain **Electron 44.9.0** (MIT) and
the Chromium and Node.js components it bundles. Their licences are shipped inside
each installer as `LICENSE` and `LICENSES.chromium.html`. Build tooling
(electron-builder) is not shipped.
>>>>>>> 0f24d202aa411c19baf13ae2e4dbe86d860c2ed7

Licences were read from the package metadata and licence files at the versions
above; please re-verify before a formal release.
