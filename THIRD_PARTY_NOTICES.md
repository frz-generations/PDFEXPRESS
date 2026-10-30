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

The installers in `desktop/` additionally contain **Electron 44.9.0** (MIT) and
the Chromium and Node.js components it bundles. Their licences are shipped inside
each installer as `LICENSE` and `LICENSES.chromium.html`. Build tooling
(electron-builder) is not shipped.

Licences were read from the package metadata and licence files at the versions
above; please re-verify before a formal release.
