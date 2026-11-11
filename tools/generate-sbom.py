#!/usr/bin/env python3
# FRZ PDF Express — SPDX 2.3 snapshot inventory generator
# Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations
# SPDX-License-Identifier: MIT
"""Generate SBOM.spdx.json from the npm v3 lockfile and bundled vendor files."""
from __future__ import annotations

import base64
import fnmatch
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor"
LOCK_PATH = ROOT / "desktop" / "package-lock.json"
OUT = ROOT / "SBOM.spdx.json"

# Component metadata from THIRD_PARTY_NOTICES.md and vendor/README.md. File paths
# are checked against the shipped snapshot; unresolved versions are not guessed.
VENDOR_COMPONENTS = [
    {"name": "pdf-lib", "version": "1.17.1", "license": "MIT", "url": "https://github.com/Hopding/pdf-lib", "patterns": ["pdf-lib.min.js", "licenses/pdf-lib.LICENSE.md.txt"]},
    {"name": "PDF.js (pdfjs-dist)", "version": "3.11.174", "license": "Apache-2.0", "url": "https://github.com/mozilla/pdf.js", "patterns": ["pdf.min.js", "pdf.worker.min.js", "licenses/pdfjs-dist.LICENSE.txt"]},
    {"name": "JSZip", "version": "3.10.1", "license": "MIT", "url": "https://github.com/Stuk/jszip", "patterns": ["jszip.min.js", "licenses/jszip.LICENSE.txt"]},
    {"name": "Tesseract.js", "version": "5.0.4", "license": "Apache-2.0", "url": "https://github.com/naptha/tesseract.js", "patterns": ["tesseract/tesseract.min.js", "tesseract/worker.min.js", "licenses/tesseract.js.LICENSE.md.txt"]},
    {"name": "Tesseract.js Core", "version": "5.0.0", "license": "Apache-2.0", "url": "https://github.com/naptha/tesseract.js-core", "patterns": ["tesseract/tesseract-core*.wasm.js", "licenses/tesseract.js-core.LICENSE.txt"]},
    {"name": "Tesseract tessdata best (English and Malayalam)", "version": "4.0.0_best_int", "license": "Apache-2.0", "url": "https://github.com/tesseract-ocr/tessdata_best", "patterns": ["tessdata/eng.traineddata.gz", "tessdata/mal.traineddata.gz"]},
    {"name": "SheetJS (xlsx)", "version": "0.18.5", "license": "Apache-2.0", "url": "https://github.com/SheetJS/sheetjs", "patterns": ["xlsx.full.min.js", "licenses/xlsx.LICENSE.txt"]},
    {"name": "PptxGenJS", "version": "3.12.0", "license": "MIT", "url": "https://github.com/gitbrent/PptxGenJS", "patterns": ["pptxgen.min.js", "licenses/pptxgenjs.LICENSE.txt"]},
    {"name": "@pdf-lib/fontkit", "version": "1.1.1", "license": "MIT", "url": "https://github.com/Hopding/fontkit", "patterns": ["fontkit.min.js"]},
    {"name": "Fontsource fonts (Inter, Fraunces, IBM Plex Mono)", "version": "5.3.0", "license": "OFL-1.1", "url": "https://fontsource.org", "patterns": ["fonts/fonts.css", "fonts/*-latin-*.woff2", "licenses/_fontsource_*.LICENSE.txt"]},
    {"name": "Noto Sans and Noto Sans Malayalam fonts", "version": None, "license": "OFL-1.1", "url": "https://fontsource.org", "patterns": ["fonts/noto/*.woff", "licenses/noto-sans*.LICENSE.txt"]},
]


def spdx_id(kind: str, key: str) -> str:
    label = re.sub(r"[^A-Za-z0-9.-]+", "-", key).strip("-")[:44] or "item"
    suffix = hashlib.sha256(key.encode("utf-8")).hexdigest()[:10]
    return f"SPDXRef-{kind}-{label}-{suffix}"


def valid_license_expression(value: object) -> str:
    if not isinstance(value, str):
        return "NOASSERTION"
    text = value.strip()
    if re.fullmatch(r"[A-Za-z0-9.+-]+(?:\s+(?:AND|OR|WITH)\s+[A-Za-z0-9.+-]+)*", text):
        return text
    return "NOASSERTION"


def sha512_integrity(value: object) -> dict[str, str] | None:
    if not isinstance(value, str):
        return None
    for token in value.split():
        if token.startswith("sha512-"):
            try:
                digest = base64.b64decode(token[7:], validate=True).hex()
                return {"algorithm": "SHA512", "checksumValue": digest}
            except Exception:
                continue
    return None


def main() -> int:
    if not LOCK_PATH.exists():
        print(f"Missing npm lockfile: {LOCK_PATH}", file=sys.stderr)
        return 1
    lock = json.loads(LOCK_PATH.read_text(encoding="utf-8"))
    root = lock.get("packages", {}).get("", {})
    package_config = json.loads((ROOT / "desktop" / "package.json").read_text(encoding="utf-8"))
    if root.get("devDependencies") != package_config.get("devDependencies"):
        print("package-lock.json root dependencies do not match desktop/package.json", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    app_id = "SPDXRef-Package-FRZ-PDF-Express"
    packages: list[dict[str, object]] = [{
        "name": "FRZ PDF Express",
        "SPDXID": app_id,
        "versionInfo": package_config.get("version", "NOASSERTION"),
        "downloadLocation": "NOASSERTION",
        "filesAnalyzed": False,
        "licenseConcluded": "NOASSERTION",
        "licenseDeclared": "MIT",
        "copyrightText": "Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations",
        "primaryPackagePurpose": "APPLICATION",
        "comment": "Source-project inventory. Package content and deployment artifacts were not independently audited.",
    }]
    relationships: list[dict[str, str]] = [{"spdxElementId": "SPDXRef-DOCUMENT", "relationshipType": "DESCRIBES", "relatedSpdxElement": app_id}]

    for path, info in sorted(lock.get("packages", {}).items()):
        if not path.startswith("node_modules/") or not isinstance(info, dict):
            continue
        name = info.get("name")
        if not name:
            suffix = path[len("node_modules/"):]
            if suffix.startswith("@") and "/" in suffix:
                name = "/".join(suffix.split("/")[-2:])
            else:
                name = suffix.rsplit("/node_modules/", 1)[-1]
        version = str(info.get("version", "NOASSERTION"))
        key = f"{path}@{version}"
        ident = spdx_id("Package", key)
        resolved = info.get("resolved")
        package: dict[str, object] = {
            "name": name,
            "SPDXID": ident,
            "versionInfo": version,
            "downloadLocation": resolved if isinstance(resolved, str) and resolved.startswith("https://") else "NOASSERTION",
            "filesAnalyzed": False,
            "licenseConcluded": "NOASSERTION",
            "licenseDeclared": valid_license_expression(info.get("license")),
            "copyrightText": "NOASSERTION",
            "primaryPackagePurpose": "LIBRARY",
            "externalRefs": [{"referenceCategory": "PACKAGE-MANAGER", "referenceType": "purl", "referenceLocator": f"pkg:npm/{quote(str(name), safe='@/-._')}@{quote(version, safe='.+-')}"}],
        }
        checksum = sha512_integrity(info.get("integrity"))
        if checksum:
            package["checksums"] = [checksum]
        if info.get("dev"):
            package["comment"] = "Installed as a development/build dependency according to package-lock.json."
        packages.append(package)
        relationships.append({"spdxElementId": app_id, "relationshipType": "DEPENDS_ON", "relatedSpdxElement": ident})

    vendor_paths = sorted(p.relative_to(VENDOR).as_posix() for p in VENDOR.rglob("*") if p.is_file() and p.name != "README.md")
    assigned: dict[str, list[str]] = {}
    vendor_packages: list[tuple[dict[str, object], str, list[str]]] = []
    for component in VENDOR_COMPONENTS:
        matching = sorted(path for path in vendor_paths if any(fnmatch.fnmatch(path, pattern) for pattern in component["patterns"]))
        ident = spdx_id("Vendor", str(component["name"]))
        vendor_pkg: dict[str, object] = {
            "name": component["name"],
            "SPDXID": ident,
            "downloadLocation": component["url"],
            "filesAnalyzed": True,
            "licenseConcluded": "NOASSERTION",
            "licenseDeclared": component["license"],
            "copyrightText": "NOASSERTION",
            "primaryPackagePurpose": "LIBRARY",
            "comment": "Vendored component metadata from THIRD_PARTY_NOTICES.md and vendor/README.md; file SHA-256 values describe this supplied snapshot.",
        }
        if component["version"]:
            vendor_pkg["versionInfo"] = component["version"]
        else:
            vendor_pkg["comment"] += " Version not specified in the supplied component inventory; not inferred."
        packages.append(vendor_pkg)
        relationships.append({"spdxElementId": app_id, "relationshipType": "DEPENDS_ON", "relatedSpdxElement": ident})
        vendor_packages.append((component, ident, matching))
        for path in matching:
            assigned.setdefault(path, []).append(ident)

    unassigned = [path for path in vendor_paths if path not in assigned]
    multiple = {path: ids for path, ids in assigned.items() if len(ids) > 1}
    if unassigned or multiple:
        print(f"Vendor file mapping incomplete: unassigned={unassigned}; multiple={multiple}", file=sys.stderr)
        return 1

    files: list[dict[str, object]] = []
    for path in vendor_paths:
        file_id = spdx_id("File", path)
        content = (VENDOR / path).read_bytes()
        digest_sha1 = hashlib.sha1(content).hexdigest()
        digest_sha256 = hashlib.sha256(content).hexdigest()
        files.append({
            "fileName": f"./vendor/{path}",
            "SPDXID": file_id,
            "checksums": [
                {"algorithm": "SHA1", "checksumValue": digest_sha1},
                {"algorithm": "SHA256", "checksumValue": digest_sha256},
            ],
            "licenseConcluded": "NOASSERTION",
            "licenseInfoInFiles": [],
            "copyrightText": "NOASSERTION",
        })
        relationships.append({"spdxElementId": assigned[path][0], "relationshipType": "CONTAINS", "relatedSpdxElement": file_id})

    document = {
        "spdxVersion": "SPDX-2.3",
        "dataLicense": "CC0-1.0",
        "SPDXID": "SPDXRef-DOCUMENT",
        "name": f"FRZ PDF Express {package_config.get('version', 'NOASSERTION')} source snapshot",
        "documentNamespace": f"https://frz-pdf-express.invalid/spdx/{package_config.get('version', 'unknown')}/{hashlib.sha256(LOCK_PATH.read_bytes()).hexdigest()[:16]}",
        "creationInfo": {"created": now, "creators": ["Tool: tools/generate-sbom.py"], "licenseListVersion": "3.25"},
        "documentDescribes": [app_id],
        "packages": packages,
        "files": files,
        "relationships": relationships,
        "annotations": [{
            "annotationType": "OTHER",
            "annotator": "Tool: tools/generate-sbom.py",
            "annotationDate": now,
            "comment": "Generated from desktop/package-lock.json and third-party component inventory in THIRD_PARTY_NOTICES.md. This inventory is not an independent verification of the software, deployment or licence conclusions.",
        }],
    }
    OUT.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(packages)} package records, {len(files)} dual-checksummed vendor file records, lockfile v{lock.get('lockfileVersion')}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
