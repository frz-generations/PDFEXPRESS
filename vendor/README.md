# vendor/

Third-party files served with the app so that it makes **no requests to other websites**.
They are not the work of FRZ Generations and keep their own licences (see `licenses/` and `../THIRD_PARTY_NOTICES.md`).

- pdf-lib 1.17.1 · PDF.js 3.11.174 · JSZip 3.10.1 · SheetJS xlsx 0.18.5 · PptxGenJS 3.12.0 · @pdf-lib/fontkit 1.1.1 · Noto Sans / Noto Sans Malayalam (WOFF)
- Tesseract.js 5.0.4 + tesseract.js-core 5.0.0 (`tesseract/`), OCR language data English and Malayalam (`tessdata/`, from the tessdata "best" models via @tesseract.js-data, 4.0.0_best_int)
- Fonts: Inter, Fraunces, IBM Plex Mono (`fonts/`, SIL Open Font License 1.1)

To update a library, replace the file, keep its licence in `licenses/`, and update `THIRD_PARTY_NOTICES.md`.
