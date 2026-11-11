# Security policy

<<<<<<< HEAD
FRZ PDF Express is a client-side web application with an optional Electron desktop shell. The supplied project contains no remote document-processing API or FRZ-hosted application backend. A website operator, browser, operating system or desktop profile may have its own logging, cache and backup behavior; selected files opened in the PDF Viewer are retained locally in IndexedDB for Recent files until removed or cleared (see [Privacy and local storage](policies.html#privacy)).

## Report a vulnerability

Email **frzgenerations@gmail.com** (see `.well-known/security.txt`). Include the affected release/source version, OS/browser/Electron version, steps to reproduce and impact. Do not send personal or confidential documents; provide a sanitized minimal sample or describe the issue. Please allow reasonable time for coordinated remediation before public disclosure.

## Source-level controls and evidence limits

The project includes a browser Content Security Policy, no-referrer policy, bundled assets, and Electron `contextIsolation`, renderer sandbox, and restricted permission/IPC checks. The desktop checks are covered by local Node unit tests. These source controls and tests are not a penetration test, external audit, security clearance, production configuration review, or proof that a deployed build is secure. Deployment headers, TLS, infrastructure, server logs and incident response depend on the operator.

Run local checks with `python3 tools/check-project.py`, `python3 tools/check-notices.py` and `cd desktop && npm ci --ignore-scripts && npm test && npm audit --audit-level=high`. Results apply only to that source snapshot and the registry data available at test time.

## Supported release

Report issues against the latest source or installer release that the maintainers provide. The supplied source version is 1.1.0. Verify the actual bundled Electron runtime, operating systems, signatures and updater channel for each packaged release; unsigned installers are not suitable for assuming publisher authenticity. No product security certification or independent audit is claimed by this policy.
=======
FRZ PDF Express is a static, offline-capable web application (and an Electron desktop shell around it). It has no server component and sends no data anywhere.

- Report vulnerabilities by email to **frzgenerations@gmail.com** (see also `.well-known/security.txt`). Please include steps to reproduce and the browser/OS.
- Please allow reasonable time for a fix before public disclosure.
- Built-in protections: a strict Content Security Policy on every page (no external origins), `no-referrer`, no cookies or analytics, files processed in memory only, desktop shell with `contextIsolation`, `sandbox`, blocked navigation and a private `app://` scheme.
- Supported version: the latest release.
>>>>>>> 0f24d202aa411c19baf13ae2e4dbe86d860c2ed7
