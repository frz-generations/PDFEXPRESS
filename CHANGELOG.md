# Changelog

Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations — MIT License.

## 1.1.0

### Added
- **Compress PDF by target size.** The quality selector is replaced by a size box (KB / MB, with 500 KB, 1, 2, 5 and 10 MB shortcuts). The app lowers photo quality step by step and keeps the gentlest setting that fits. If the PDF has too little image data to reach the target, it saves the smallest size possible and says so. Pages are never flattened.
- Desktop app: the close button now asks to save a copy or discard when files have unsaved edits, and closes immediately when nothing was edited.
- Layout-preserving Word, Excel and PowerPoint to PDF; paste copied Excel cells; trim trailing empty cells and choose a range.
- Acrobat-style print dialog (page sizing, poster, multiple pages per sheet, booklet, duplex, copies, gray).
- Phone support: device detection, install/official-app notice (web only), downloads named `<file>-<action>frz.<ext>`.

### Fixed
- Phones: file chooser no longer fires twice when tapping an upload area; heavy libraries (spreadsheet, PowerPoint) load only when needed; blur and animations reduced on phones.
- Viewer ribbon wraps on phones so every button is visible.
- "PDF to images" zip name no longer repeats the file name.
