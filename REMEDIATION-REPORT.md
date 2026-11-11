# FRZ PDF Express — source remediation report

**Review date:** 8 November 2026  
**Product source version:** 1.1.0 (not bumped; this is an unreleased source working copy)  
**Scope:** repository remediation for possible institutional review; no installer was built, no service was deployed and no government acceptance is asserted.

## Executive summary

The supplied project was kept as the source of truth. Its HTML/CSS/JavaScript architecture, FRZ Generations branding, client-side processing approach, two 33-tool catalogs, existing tool code and workflows were preserved. No file from the source archive was removed. The main concrete hardening change is to the Electron trust boundary: privileged IPC, app protocol resolution and permissions are constrained and covered by local regression tests. The most important transparency fixes disclose the PDF Viewer’s on-device IndexedDB history and correct inaccurate Office-layout and “never saved” copy. Source checks, tests, SPDX validation and read-only browser preview all passed.

**Not a clean security bill of health:** the patched desktop dependency tree has no high/critical finding at the recorded npm advisory snapshot, but npm still reports six **moderate** `minimatch`-related findings through the build-tool dependency tree. They remain open and are documented below. No claim of WCAG/BIS/GIGW conformity, independent security audit, STQC certification, government approval, or departmental acceptance is made.

## Input and preservation evidence

Input archive: `/home/ubuntu/upload/FRZ-PDF-Express-source(18).zip`  
SHA-256: `52054408bd9b7004cdec2c2776701da785ae0466761991886c904a0afe4f16cf`

A file-by-file content-hash comparison found **87 original files, 23 modified files, 13 added files and 0 removed files** in the current remediation copy. Both `index.html` and `app.html` still have the same 33 unique tool IDs in the same order; the browser preview displayed the complete 33-tool catalogs. Brand/logo assets and bundled PDF/OCR/document-processing libraries are unchanged. Product version remains 1.1.0. The 13 additions comprise documentation, source-check/SBOM tools, the pinned npm lockfile, Electron security helper/tests, and the printer capability helper, regression tests and platform-source note.

## Code and documentation changes

| Area | Change made |
|---|---|
| Electron IPC | All nine privileged `ipcMain.handle` channels—including default-PDF status/change, printing, printer access and save-copy—validate the sender against the expected window, custom scheme, main frame and tools document. The static regression gate now checks every registered channel for the guard. |
| Electron URL and filesystem boundary | Validate parsed `app://local` URLs rather than string prefixes; reject spoofed host/credentials/ports; block navigation away from the app; decode then resolve protocol paths under the packaged app root and reject traversal/out-of-root paths. |
| Electron permissions | Deny by default. Keep the product’s explicit Scan to PDF camera-video flow and sanitized clipboard-write workflow; deny microphone/audio, screen capture and unknown permissions. Permission context is bound to the expected app window/origin and main-frame video request. |
| Web policy | Existing same-origin page CSPs are tested; `object-src 'none'` is retained/explicit on the tools page without removing blob frame/worker/media capabilities used by the existing PDF printing, OCR and camera workflows. All page scripts and asset references checked by the static gate are local. Deployment HTTP headers still require host configuration. |
| User-visible privacy | Landing page, tools page, first-run update notice, About text, README and privacy page disclose that PDFs opened in the Viewer are stored in the local browser/app profile’s IndexedDB for Recent files until removed or history is cleared. This is distinguished from the other tool panels’ processing and from host/device logging. No promise of secure erasure is made. |
| Capability accuracy | Corrected the PowerPoint/Word-to-PDF cards and structured metadata to state that their text-focused conversions do not preserve complex layout/graphics. Corrected the false statement that nothing opened is ever saved. Removed claims of completed accessibility scans/conformance, audits or government-guideline compliance where no evidence was supplied. |
| Dependency and evidence inventory | Locked exact Electron 44.10.2 and electron-builder 26.18.0 in `desktop/package.json`/`package-lock.json`; added a local SPDX 2.3 generator and snapshot `SBOM.spdx.json` containing the npm lock components and hashes for all 42 shipped vendor/license/font/OCR files. Updated the third-party inventory without changing bundled assets or licences. |
| CI | Preserved existing Linux `.deb` and Windows installer workflow triggers and artifact targets. Added notice, static/security, Node regression and high-or-higher npm audit gates; release jobs use the npm lockfile. CI was reviewed but not run from this local review. |
| Institutional documents | Added applicability-qualified requirement/evidence crosswalk, source-reviewed data-flow and retention map, primary-source notes, and a deployment/pilot checklist. They separate repository evidence from operator/department proof that is absent from the archive. |

## Verification performed

| Check | Result |
|---|---|
| Source-archive comparison | 87 baseline files; 23 modified; 13 added; 0 removed. |
| Catalog and repository static check (`python3 tools/check-project.py`) | **Pass.** Confirms 33 matching unique IDs in both catalogs, CSP properties, no external HTML script/resource tags, retention copy, all nine Electron IPC guards, npm/lock consistency, SPDX inventory count and vendor hashes. |
| Notices check (`python3 tools/check-notices.py`) | **Pass.** MIT licence, original author/FRZ credit and notices intact. |
| Electron policy helper tests (`cd desktop && npm test`) | **Pass: 6/6 Node test cases**, including origin/host spoofing, trusted frame/document, camera-only request, microphone/screen/unknown deny and fail-closed contexts. |
| Project aggregate check (`npm run test:static`) | **Pass.** Runs the project and attribution/notices checks. |
| JavaScript syntax (`node --check`, project-owned JS outside `vendor/` and `node_modules/`) | **Pass: 15 files.** |
| SPDX parser/validator | **Pass: 0 diagnostics** using `spdx-tools` against the generated SPDX 2.3 document. Contains 295 package records and 42 vendor-file entries with SHA-1 identification and SHA-256 integrity hashes; the project static check independently verifies the SHA-256 values against the shipped files. |
| npm security audit | **High-or-higher CI gate passes; full audit still has 6 moderate findings, 0 high, 0 critical.** Details and limitation below. |
| Browser smoke test | Landing and tools pages rendered from the temporary local preview; retained branding and complete tool catalog visible. The Viewer-retention notice and corrected Office cards appeared. Browser `performance` resources were all from the preview’s own origin (**zero external asset origins observed**) and no page console errors were observed in this read-only load. No document was uploaded or opened in this browser test. |
| Static source data-flow review | No remote document-processing endpoint, XMLHttpRequest, `sendBeacon`, WebSocket or EventSource path was found outside bundled vendor code. Observed fetches were same-origin resources/Service Worker requests; Electron protocol `net.fetch` resolves a local `file:` URL. Converter font requests use relative `vendor/` paths. This is source/network-observation evidence, **not** a packet capture involving an actual selected PDF. |

The default cross-origin/resource and permission results apply to this source copy and test environment only. No full browser support matrix, actual PDF regression suite, screen-reader run, platform permission test, Electron runtime integration test, signed installer build or hosted CI run was completed.

## Dependency advisory residual

The original archive used Electron 44.9.0. The registry advisory `GHSA-jr5w-w6x2-84p9` identifies a high-severity Electron issue affecting versions through 44.9.0 and lists 44.9.1 or later as patched. The source lock now selects Electron **44.10.2**, the same existing Electron major line. The post-update npm audit reports **zero high/critical** findings.

The full advisory output also reports one moderate `minimatch` denial-of-service advisory (`GHSA-g3hv-75wg-m249`) across six affected builder/dependency package records, including `@electron/universal` and the `electron-builder` build graph. These are desktop build-time tools in the lockfile, not bundled web-app libraries; they are nonetheless relevant to CI/build inputs and are not marked resolved. The registry's forced fix proposes downgrading electron-builder to 24.13.3, a major-version change from the pinned 26.18.0; no force downgrade or unchecked override was applied. The workflow presently blocks high-or-higher findings, not these moderate ones. Review the complete current audit output and close/accept the residual risk with a named owner before a production build.

## Applicable but unverified deployment obligations

The source archive cannot establish whether a specific institution-owned/commissioned deployment is in GIGW scope, who is its Data Fiduciary/processor/operator, or whether procurement requires particular reviews. The applicable accessibility laws/standards and evidence are not interchangeable: GIGW, applicable RPwD/BIS IS 17802 obligations, WCAG evaluation, user testing and an STQC certificate are separate items. CERT-In log/incident directions depend on the covered entity/system/operator. Host TLS/response headers, India-region logs/retention, backups, monitoring, contact points, incident response, branding/official identity, code signing and procurement controls are outside this repository review.

Before a pilot or production release, obtain the owner’s scope decision, run version-specific packaged tests, complete the applicable accessibility and independent security assessment/clearance, decide the privacy/data-protection roles and records policy, verify host headers/logs/incident duties, remediate or formally accept the moderate npm findings, verify the actual SBOM/installer/runtime, pin CI Actions if required, sign/distribute artifacts under an authorized identity, and retain evidence for the exact release. The [institutional pilot checklist](INSTITUTIONAL-PILOT-CHECKLIST.md) and [applicability crosswalk](GUIDELINES-COMPLIANCE.md) provide the detailed work items.

## Primary-source notes

The dated source and applicability notes with government/Electron links are in [`RESEARCH-SOURCES.md`](RESEARCH-SOURCES.md). Key sources include [GIGW 3.0](https://guidelines.india.gov.in/guidelines/), the [RPwD Amendment Rules 2023](https://divyangjan.depwd.gov.in/upload/uploadfiles/files/RPwD%20(Amendment)%20Rules%2C%202023%20-%20Accessibility%20standards%20on%20ICT%20products%20and%20Services_compressed.pdf), [CERT-In Directions](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf), [CERT-In Government entity guidance](https://www.cert-in.org.in/PDF/guidelinesgovtentities.pdf), the DPDP [commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) and [Rules](https://egazette.gov.in/WriteReadData/2025/267650.pdf?v=20261014100519), and [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).


## Follow-up: printer controls (11 November 2026)

The original print UI and document-imposition workflow were retained. This follow-up fixes the hidden tray/media/quality controls and missing paper-size job setting, adds the selected printer's capability-reported paper sizes and dimensions, supports a clear **System print dialog…** path, and removes placeholder Draft/Normal/Best choices when a printer does not report them. The Windows 1200-DPI choice is no longer silently capped at 600 DPI. A local evidence note is in [`PRINTING-SOURCES.md`](PRINTING-SOURCES.md).

- **CUPS/Linux:** parse the selected queue's `lpoptions -p <queue> -l` output; expose reported media sizes, trays, media types and resolution/quality values; and pass the chosen size via CUPS `media=` plus the selected queue options. Values are syntax-checked; when discovery/submission is unavailable, the native system dialog remains available. The temporary job PDF is removed when the `lp` submission command returns.
- **Windows:** retrieve `System.Printing.PrintCapabilities` for the selected queue, expose named media sizes and the driver's reported dimensions/default, and pass supported paper size, input bin, media type and output quality through the existing PrintTicket helper. Windows Driver Properties remains available, with full-width native HWND passing and clearer failure handling.
- **Shared UI:** paper size is visible in the main print window, and the driver-reported tray/type/quality choices are shown when present. The system-dialog route is available independently of direct-print discovery. Layout and options remain part of the existing print workflow; no feature or processing backend was replaced.
- **Offline delivery:** incremented the service-worker cache from v25 to v26 so installed/offline clients re-fetch the modified, precached `print.js` instead of retaining an older cached version.
- **Privacy/operations:** the Linux temporary print PDF is deleted after the local CUPS submission call completes. Windows image files continue to be managed by the existing Windows helper. This does not imply that the operating system spooler or printer retains no job data.

Verification for this follow-up: **11/11 Node regression tests passed**, including CUPS argument/capability tests, Windows capability-mapping tests and existing Electron security tests; updated static project/notice checks and JavaScript syntax checks passed; `npm audit --audit-level=high` passed with the same **6 moderate, 0 high, 0 critical** build-tool advisories. The sandbox has no selected printer, does not run a Windows printer driver, and has not tested real printer hardware; therefore actual tray switching, duplex, media, colour and physical paper output still require platform/driver acceptance tests. No installers were built, no external deployment was published and no certification or government acceptance is claimed.
