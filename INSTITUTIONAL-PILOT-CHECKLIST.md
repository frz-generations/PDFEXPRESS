# Institutional pilot and release-readiness checklist

**Use:** planning aid for an institution considering the supplied FRZ PDF Express source. It is not evidence of approval, audit, conformance, legal compliance or procurement acceptance. Record a named owner, evidence link, tested version, date and disposition for each applicable item. Re-check current law, GIGW, BIS, CERT-In, STQC, state/sector requirements and procurement terms before release.

## 1. Scope, ownership and governance

- [ ] Record the sponsoring department, intended service/users, public versus intranet access, applicable state/sector, and exact pilot/production environment.
- [ ] Document who owns the deployed service, commissioned the code, controls release decisions, operates hosting, maintains support and holds change authority. Determine whether this is a private proposal, government-owned/commissioned app, or a vendor-hosted part of a government service; obtain the department's GIGW scope decision where unclear.
- [ ] Identify accountable service owner and Web Information Manager where GIGW applies. Approve ownership/contact, content lifecycle, help and feedback, accessibility, security, privacy, incident response, continuity/contingency and records-retention policies.
- [ ] Confirm procurement/RFP/contract/hosting instructions and whether pre-production security clearance, annual/change-triggered audit, STQC/CQW assessment, SBOM format/update cadence, support SLAs or other deliverables are mandatory for this version.
- [ ] Preserve FRZ Generations attribution and MIT / third-party notices. Do not apply government logos, emblem, domain names, “official,” certification marks, endorsement or acceptance language without documented authority.

## 2. Accessibility and user experience

- [ ] Determine applicability of the RPwD Act/Rules, Rule 15 and current amended BIS IS 17802 Parts 1 and 2; check current editions/amendments and any sector-specific rules.
- [ ] Inventory all routes, modals, file-selection workflows, validation/errors, zoom/responsive modes, viewer canvas tools, printable/generated documents and any integrated third-party content.
- [ ] Conduct qualified manual assessment against all applicable WCAG 2.1 A/AA criteria and relevant GIGW checkpoints; map BIS IS 17802 requirements separately. Automated scans are a triage tool, not a conformance verdict.
- [ ] Run complete tool journeys using keyboard-only access, current screen readers, magnification, reflow/zoom, and relevant mobile assistive technology. Include people with disabilities in test planning and record environment/results.
- [ ] Assess focus/reading order, keyboard traps, semantic names/roles/states, errors/status announcements, contrast, touch/pointer alternatives, document formats and the accessibility of exported PDFs/other outputs.
- [ ] Obtain any accessibility review required by the procuring department or certification path. If applying for STQC WQCS, confirm the current rules, audit scope, auditor credentials/prerequisites and exact evaluated release; do not substitute a repository check for the process.

## 3. Application and supply-chain security

- [ ] Re-run the source checks from a clean clone: `python3 tools/check-project.py`, `python3 tools/check-notices.py`, then `cd desktop && npm ci --ignore-scripts && npm test && npm audit --audit-level=high`.
- [ ] Read the full audit output, including moderate/low advisories and deprecations; record disposition, owner, expiry and mitigation for each item. The current source workflow fails on high-or-higher npm audit findings; a lower threshold is not a zero-finding result.
- [ ] Compare `SBOM.spdx.json` against the resolved lockfile, bundled vendor files, exact packaged dependencies and licence notices. Regenerate it for each source release and verify the installed runtime in each installer.
- [ ] Review source changes, trust boundaries, untrusted PDF/image/Office parser inputs, renderer and IPC paths, permissions, CSP, custom protocol routes, file system path handling, external navigation and any new egress.
- [ ] Build the Linux and Windows targets from the exact lockfile in a controlled environment. Exercise file open, camera capture, file drops, print, accessibility flows, offline operation, Recent file add/remove/clear, uninstall and profile cleanup on real supported platforms.
- [ ] Arrange an authorized, scoped independent application and hosting security assessment before production where required (including any valid GIGW safe-to-host/security-clearance requirement). Fix findings and obtain a retest; repository unit tests and npm advisory checks are not a VAPT.
- [ ] Establish patch ownership and response service levels for Electron, browser/runtime, bundled parsers, OCR/WASM, Office libraries, GitHub Actions, fonts and other transitive software; monitor advisories and maintain per-release SBOM/VEX where required.
- [ ] Review release workflow: use immutable/pinned CI actions where required, least-privilege build tokens, protected release approvals, reproducible dependencies, signatures/provenance, artifact hashes, immutable release storage and rollback policy.

## 4. Hosting and operations

- [ ] Confirm HTTPS, approved hosting location/provider, system hardening, data classification, network and IAM boundaries, monitoring/log access, backup/restore, availability and incident/continuity procedures.
- [ ] Set and verify appropriate HTTP response headers at the hosting server: Content-Security-Policy (including `frame-ancestors`), `X-Content-Type-Options`, `Referrer-Policy`, and a least-privilege `Permissions-Policy`. Apply HSTS only when the domain and HTTPS configuration are correct and the operator approves the policy. Meta CSP in HTML cannot set `frame-ancestors`.
- [ ] Disable directory listing; ensure local assets are served with safe content types, cache rules and no sensitive dynamically generated content. Verify Service Worker scope and update strategy at the chosen base path. Retest the live host headers and browser request behavior.
- [ ] Determine the operator's CERT-In Direction scope. For covered entities and systems, implement specified six-hour reporting readiness, secure 180-day India log retention, NIC/NPL-traceable clock synchronisation and a current CERT-In Point of Contact. Keep operator logs distinct from document contents and comply with the actual direction and legal advice.
- [ ] Define who reviews security alerts, handles user reports, patches the host, restores service, contacts CERT-In or regulators, preserves evidence, notifies affected people when required, and communicates outage/support details.

## 5. Privacy, records and data-protection roles

- [ ] Trace actual files and images through input, processing, local settings, IndexedDB Viewer history, output, browser downloads, OS print/share, telemetry/diagnostics, host logs, backups and support. Verify no undocumented script/API is added in the deployed copy.
- [ ] Identify personal, sensitive, confidential, archival, client, staff, student, patient or citizen records that could be processed. Record who determines purposes/means and whether the institution, software publisher, host or support provider acts as a Data Fiduciary, Data Processor, separate operator or neither for each flow.
- [ ] Approve user notice, lawful processing basis, user rights/complaints contact, purpose and retention policy, local history/clear controls, permitted file types and shared-device instructions. Treat the 2026/2027 DPDP commencement schedule accurately and check subsequent notifications at the deployment date.
- [ ] Confirm retention/deletion, backup/legal-hold, audit logging, support access, breach escalation, vendor processor clauses, data residency and incident-notification obligations for the service and host.
- [ ] Ensure Viewer local IndexedDB history persistence and deletion are tested on the supported browser/Electron profile. Local removal is not secure wipe from device backups or snapshots.

## 6. Release sign-off

- [ ] Record product/source version, commit/tree hash, lockfile hash, SBOM, compiler/Node/Electron versions, OS targets, signing/notarization evidence and artifact SHA-256 for each delivered package.
- [ ] Verify installer signing/publisher identity, update channel, artifact authenticity, rollback process and the actually embedded Electron runtime. The supplied Windows installers are unsigned; signing is a release task, not a repository claim.
- [ ] Store the applicable security clearance/audit report, accessibility report, retest report, departmental scope and acceptance decision, hosting-header/log evidence and named service owner for the exact production version.
- [ ] Publish only reviewed statements: no “compliant,” “approved,” “secure,” “accessible” or government-accepted claims unless the responsible authority has issued valid evidence for the identified system/version/scope.

## Primary guidance references

- [GIGW 3.0 scope and objective](https://guidelines.india.gov.in/scope-and-objective/) and [detailed guidelines](https://guidelines.india.gov.in/guidelines/).
- [RPwD Amendment Rules 2023](https://divyangjan.depwd.gov.in/upload/uploadfiles/files/RPwD%20(Amendment)%20Rules%2C%202023%20-%20Accessibility%20standards%20on%20ICT%20products%20and%20Services_compressed.pdf).
- [CERT-In section 70B Directions](https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf) and [government entity security guidance](https://www.cert-in.org.in/PDF/guidelinesgovtentities.pdf).
- [DPDP Act commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) and [Digital Personal Data Protection Rules 2025](https://egazette.gov.in/WriteReadData/2025/267650.pdf?v=20261014100519).
- See [`RESEARCH-SOURCES.md`](RESEARCH-SOURCES.md) for date-bound applicability notes and additional official standards/references.
