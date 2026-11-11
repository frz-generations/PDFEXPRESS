# Desktop packaging

The Electron shell wraps the same browser app, served from local project files through a private `app://` scheme. Renderer Node integration is disabled; context isolation, sandboxing and web security are enabled. Navigation and the app protocol are limited to local content. Permission and IPC handlers now verify the expected app window and origin; camera video is allowed only for the tools page and microphone, screen capture and other web permissions are denied. Clipboard sanitized writes are retained for existing copy workflows.

Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations — MIT License (see `../LICENSE`, `../NOTICE`).

## Build and test

Requires Node.js 20+ and internet access for the initial npm dependency/Electron download. Node.js 22 is used by the included GitHub Actions workflow.

```sh
npm ci                   # reproducible dependencies from package-lock.json
npm test                 # Electron security and printer-capability regression tests
npm run test:static      # project/catalog/CSP and attribution checks
npm audit --audit-level=high
npm start                # run from source
npm run dist:linux       # .deb -> dist/
npm run dist:win         # NSIS Setup .exe + Portable .exe -> dist/
```

Building Windows installers on Linux needs Wine with 32-bit support (for example, `wine32:i386`) so that the installer's uninstaller and icon can be generated. Building on Windows does not require Wine.

## Behaviour

- Opening a `.pdf` with the app (or `frz-pdf-express file.pdf`) shows it in the PDF Viewer. Opening another PDF re-uses the window. PDFs opened in the Viewer are stored in the local app profile's IndexedDB for “Recent files” until removed or cleared.
- The installers register the app as a PDF handler but do not force it to be the default.
- Camera permission is requested from the local tools page for the Scan to PDF camera action; microphone and screen-capture access are not granted by the Electron shell.
- The app assets and document processing run locally. Local Viewer history is still retained as described above.
- The print window shows the selected printer's reported paper sizes, paper sources, media types and quality choices when the operating system exposes them. Linux uses the selected CUPS queue's `lpoptions` choices for direct PDF jobs. Windows queries the installed driver and applies supported choices through its PrintTicket; **Driver Properties** opens that driver's own Windows settings window.
- **System print dialog…** prepares the current job and opens the native operating-system print dialog. Use it when a printer or driver does not expose a capability list, or when you need other settings supplied by Windows/CUPS. The dialog can choose a printer independently of the app's printer selector.
- Paper, tray and quality options vary by installed printer and driver. A size list is not available in every configuration. Where discovery fails, use the native print dialog or Windows Driver Properties; no option is represented as supported unless the app receives it from the selected queue.
- The current Windows installers are unsigned. Windows SmartScreen may warn; add your organisation's code-signing certificate through a reviewed release workflow before distributing under its identity. macOS is not an installer target in the supplied workflow.
- A passing source test or `npm audit` does not certify the packaged application or deployment.

## Install the .deb

```sh
sudo apt install ./frz-pdf-express_1.1.0_amd64.deb
```

In the desktop app, printing goes through its existing printer workflow. The direct CUPS and Windows PrintTicket branches are source-tested but cannot be exercised in this Linux sandbox against a real printer or a Windows driver. Verify tray selection, paper size, quality, duplex, driver Properties and the native-dialog fallback on each target OS and representative printer before deployment.
