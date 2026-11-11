# Requirement research notes

Research cut-off: 8 November 2026. These notes support issue spotting and repository changes; they are not legal advice, audit evidence, or a compliance claim. Re-check live sources and deployment-specific requirements before any government production use.

## GIGW and accessibility

GIGW 3.0's stated scope covers government websites and apps, including Central, State, district and local government. Government organisations are expected to implement GIGW and government-owned websites/apps are expressly expected to conform. A private proposal is not automatically in scope merely because it is proposed; ownership, commissioning, control, operation, procurement and hosting facts matter. The government sponsor must record its scope decision. [1] [2]

The RPwD Rules are a separate binding source. Rule 15 references the GIGW website standard and accessible website documents. The 2023 amendment (G.S.R. 359(E), published 11 May 2023) added Rule 15(1)(c)(iii), requiring covered websites/apps and ICT products/services to meet BIS IS 17802 Parts 1:2021 and 2:2022, as amended. GIGW names WCAG 2.1 AA as its accessibility target. W3C publication status alone is not Indian law; legal force here arises from applicable Indian Rules and government/contract instruments. WCAG checks, BIS conformance assessment, GIGW review, STQC certification, and user testing are distinct activities. [2] [3] [4]

No audit certificate, conformance report or assistive-technology user-test evidence was provided with this source archive. Automated scans alone cannot establish WCAG conformance or an accessible end-to-end process.

## Privacy and DPDP commencement

The DPDP Act uses the defined roles “Data Fiduciary” and “Data Processor.” Role and scope depend on actual processing, identifiable data, purpose/means decisions, and service relationships. Offline software distribution alone does not establish that its publisher is a Fiduciary or processor; an institution may remain responsible for the digital processing it directs locally. As at 8 November 2026, the principal processing duties and operational Rules are scheduled for 13 May 2027, and the next commencement stage is 13 November 2026. These dates are from the commencement notification and final Rules, not a general assumption that all provisions began on enactment. [5] [6]

## CERT-In and secure development

The CERT-In Directions dated 28 April 2022 were issued under IT Act section 70B(6). For covered entities, they require reporting specified incidents within six hours after awareness, secure retention of ICT logs for 180 days in India, traceable time synchronisation, and a point of contact. The precise operator/entity scope matters: a static app publisher is not automatically the operator of a customer’s devices, while a government or corporate host/operator may have independent duties. The CERT-In FAQ is interpretive and expressly does not amend the Direction. [7]

CERT-In government-entity security guidance sets a separate government-scoped application-security and audit baseline; the exact entity, order, tender, and relationship determine its operational force. CERT-In SBOM v2.0, OWASP ASVS/SAMM/Top 10, and NIST SSDF are useful practices; do not describe them as legislation unless an applicable government order or procurement instrument adopts them. [8] [9] [10] [11]

## Electron security and release trust

Electron recommends context isolation, sandboxing, deny-by-default session permissions, parsed origin checks for navigation and IPC, narrow preload APIs, and sender-frame validation. Its Session API distinguishes media requests (camera/microphone via `mediaTypes`) from permission checks (including `mediaType` and `isMainFrame`). These recommendations informed the repository regression fix; passing local unit tests does not establish system security. [12] [13]

Platform signing and update trust depend on OS and distribution channel. Electron support schedules and distribution requirements change; verify the exact embedded runtime and target package. Code signing, notarization, package trust and update integrity are external release controls and cannot be inferred from source files. [14] [15]

## References

[1]: https://guidelines.india.gov.in/scope-and-objective/ "GIGW 3.0 scope and objective"
[2]: https://guidelines.india.gov.in/guidelines/ "GIGW 3.0 detailed guidelines"
[3]: https://divyangjan.depwd.gov.in/upload/uploadfiles/files/RPwD%20(Amendment)%20Rules%2C%202023%20-%20Accessibility%20standards%20on%20ICT%20products%20and%20Services_compressed.pdf "Rights of Persons with Disabilities Amendment Rules 2023 Gazette text"
[4]: https://www.w3.org/TR/WCAG21/ "W3C Web Content Accessibility Guidelines 2.1"
[5]: https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf "DPDP Act commencement notification G.S.R. 843(E)"
[6]: https://egazette.gov.in/WriteReadData/2025/267650.pdf?v=20261014100519 "Digital Personal Data Protection Rules 2025 G.S.R. 846(E)"
[7]: https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf "CERT-In Directions under section 70B dated 28 April 2022"
[8]: https://www.cert-in.org.in/PDF/guidelinesgovtentities.pdf "CERT-In Guidelines on Information Security Practices for Government Entities"
[9]: https://www.cert-in.org.in/PDF/TechnicalGuidelines-on-SBOM,QBOM%26CBOM,AIBOM_and_HBOM_ver2.0.pdf "CERT-In technical guidelines on SBOM and related bills of materials, version 2.0"
[10]: https://asvs.owasp.org/ "OWASP Application Security Verification Standard"
[11]: https://csrc.nist.gov/pubs/sp/800/218/final "NIST Secure Software Development Framework SP 800-218"
[12]: https://www.electronjs.org/docs/latest/tutorial/security "Electron security recommendations"
[13]: https://www.electronjs.org/docs/latest/api/session "Electron Session API permission handlers"
[14]: https://releases.electronjs.org/schedule "Electron release schedule"
[15]: https://www.electronjs.org/docs/latest/tutorial/code-signing "Electron code signing"
[16]: https://www.stqc.gov.in/en/website-quality-certification-0 "STQC Website Quality Certification Scheme"
