# Security policy

FRZ PDF Express is a static, offline-capable web application (and an Electron desktop shell around it). It has no server component and sends no data anywhere.

- Report vulnerabilities by email to **frzgenerations@gmail.com** (see also `.well-known/security.txt`). Please include steps to reproduce and the browser/OS.
- Please allow reasonable time for a fix before public disclosure.
- Built-in protections: a strict Content Security Policy on every page (no external origins), `no-referrer`, no cookies or analytics, files processed in memory only, desktop shell with `contextIsolation`, `sandbox`, blocked navigation and a private `app://` scheme.
- Supported version: the latest release.
