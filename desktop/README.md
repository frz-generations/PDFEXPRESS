# Desktop packaging

Electron shell that runs the web app from local files through a private `app://` scheme: no network access, navigation away from the app is blocked, `contextIsolation` and `sandbox` are on, and only camera (for Scan to PDF) and clipboard-write permissions are granted.

Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations — MIT License (see `../LICENSE`, `../NOTICE`).

## Build

Requires Node.js 20+ and internet access for the first `npm install` (Electron download).

```
npm install
npm start              # run from source
npm run dist:linux     # .deb  → dist/
npm run dist:win       # NSIS Setup .exe + Portable .exe → dist/
```

Building the Windows installer **on Linux** needs `wine` (32-bit support included, e.g. `wine32:i386`) so that the installer's uninstaller can be generated and the icon embedded. Building on Windows needs nothing extra.

## Behaviour

- Opening a `.pdf` with the app (or `frz-pdf-express file.pdf`) shows it in the viewer. The installers register the app as a PDF handler ("Open with"); they do not force it to be the default.
- Only one window/instance runs; opening another PDF re-uses it.
- Installers are **unsigned**. Windows SmartScreen may warn; sign with your organisation's code-signing certificate for distribution (`win.certificateFile` in `package.json`, or your CI's signing step).

## Install the .deb

```
sudo apt install ./frz-pdf-express_1.0.0_amd64.deb
```

In the desktop app, printing goes straight to the chosen printer (no system dialog): copies, colour, one or both sides (automatic or manual), and, on Linux and macOS through CUPS, the printer's own paper tray, paper type and quality. Windows prints through the app itself; tray, paper type and quality are set in the system print window there. Direct printing has not been tested on every printer model.
