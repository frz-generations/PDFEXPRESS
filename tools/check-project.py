#!/usr/bin/env python3
# FRZ PDF Express — static security and integrity checks
# Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations
# SPDX-License-Identifier: MIT
"""Run dependency-free repository checks: python3 tools/check-project.py"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
ERRORS: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        ERRORS.append(message)


class MarkupInventory(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.scripts: list[str] = []
        self.links: list[str] = []
        self.csp: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        if tag == "script" and values.get("src"):
            self.scripts.append(values["src"] or "")
        if tag in {"link", "img", "iframe", "source", "audio", "video"}:
            value = values.get("href") if tag == "link" else values.get("src")
            if value:
                self.links.append(value)
        if tag == "meta" and (values.get("http-equiv") or "").lower() == "content-security-policy":
            self.csp = values.get("content") or ""


def main() -> int:
    landing = (ROOT / "index.html").read_text(encoding="utf-8")
    app_source = (ROOT / "app.html").read_text(encoding="utf-8")
    catalog_ids: dict[str, list[str]] = {}
    for page_name, source in (("index.html", landing), ("app.html", app_source)):
        catalog_match = re.search(r"const\s+TOOLS\s*=\s*\[(.*?)^\s*\];", source, flags=re.DOTALL | re.MULTILINE)
        check(catalog_match is not None, f"{page_name}: missing tool catalog")
        ids = re.findall(r"\{\s*id:\s*'([^']+)'", catalog_match.group(1) if catalog_match else "")
        catalog_ids[page_name] = ids
        check(len(ids) == 33, f"{page_name}: expected 33 catalog tools, found {len(ids)}")
        check(len(ids) == len(set(ids)), f"{page_name}: tool catalog contains duplicate IDs")
    check(catalog_ids["index.html"] == catalog_ids["app.html"], "Landing and app tool catalogs differ in IDs or order")
    policy_source = (ROOT / "policies.html").read_text(encoding="utf-8").lower()
    check("local recent-files history" in landing.lower() and "local recent-files history" in app_source.lower(), "Landing and app must disclose local Viewer history")
    check("indexeddb" in policy_source and "clear history" in policy_source, "Privacy page must disclose IndexedDB and history deletion")
    check("nothing you open here is ever saved anywhere" not in app_source.lower(), "App retains an inaccurate zero-retention claim")
    check("keeps slide layout, shapes, pictures and tables" not in app_source.lower(), "App retains an unsupported PPTX fidelity claim")
    check("keeps formatting, tables, pictures, headers and footers" not in app_source.lower(), "App retains an unsupported DOCX fidelity claim")

    package_config = json.loads((ROOT / "desktop" / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((ROOT / "desktop" / "package-lock.json").read_text(encoding="utf-8"))
    print_source = (ROOT / "print.js").read_text(encoding="utf-8")
    print_helpers = (ROOT / "desktop" / "print-capabilities.js").read_text(encoding="utf-8")
    service_worker = (ROOT / "sw.js").read_text(encoding="utf-8")
    check(package_config.get("version") == "1.1.0", "Desktop package version is inconsistent with supplied source version 1.1.0")
    check("print-capabilities.js" in package_config.get("build", {}).get("files", []), "Electron package must include platform print capability helpers")
    check(all(f'id="{control}"' in print_source for control in ("prPaper", "prTray", "prMType", "prQual", "prSystemPrint")), "Print workflow must expose paper, tray, media, quality and native system-dialog controls")
    check("PageMediaSize" in print_helpers and "media=" in print_helpers, "Printer helper must map Windows media size and standard CUPS media options")
    check("Math.min(1200" in print_source, "Print quality selector must not silently cap the advertised 1200-DPI setting")
    check("frz-pdf-express-v26" in service_worker and "'./print.js'" in service_worker, "Changed print workflow must be precached under an incremented service-worker cache version")
    lock_root = lock.get("packages", {}).get("", {})
    check(lock.get("lockfileVersion") == 3, "Expected npm lockfile version 3")
    check(lock_root.get("devDependencies") == package_config.get("devDependencies"), "Lockfile root dependencies do not match desktop/package.json")

    sbom = json.loads((ROOT / "SBOM.spdx.json").read_text(encoding="utf-8"))
    check(sbom.get("spdxVersion") == "SPDX-2.3", "SBOM must use SPDX 2.3")
    sbom_packages = sbom.get("packages", [])
    npm_package_count = sum(1 for package in lock.get("packages", {}) if package.startswith("node_modules/"))
    recorded_npm_count = sum(1 for package in sbom_packages if str(package.get("downloadLocation", "")).startswith("https://registry.npmjs.org/"))
    check(recorded_npm_count == npm_package_count, f"SBOM npm package count differs from lockfile ({recorded_npm_count} vs {npm_package_count})")
    package_names_versions = {(package.get("name"), package.get("versionInfo")) for package in sbom_packages}
    for name, version in package_config.get("devDependencies", {}).items():
        check((name, version) in package_names_versions, f"SBOM missing direct dependency {name}@{version}")
    sbom_files = {item.get("fileName"): item for item in sbom.get("files", [])}
    expected_vendor_files = {p.relative_to(ROOT).as_posix() for p in (ROOT / "vendor").rglob("*") if p.is_file() and p.name != "README.md"}
    recorded_vendor_files = {name.removeprefix("./") for name in sbom_files if isinstance(name, str) and name.startswith("./vendor/")}
    check(recorded_vendor_files == expected_vendor_files, "SBOM vendor file list differs from the supplied vendor snapshot")
    for relative in sorted(expected_vendor_files):
        item = sbom_files.get(f"./{relative}", {})
        checksums = item.get("checksums", [])
        expected_hash = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
        check(any(c.get("algorithm") == "SHA256" and c.get("checksumValue") == expected_hash for c in checksums), f"SBOM SHA-256 does not match {relative}")
    sbom_ids = [sbom.get("SPDXID"), *(item.get("SPDXID") for item in sbom_packages), *(item.get("SPDXID") for item in sbom.get("files", []))]
    check(len(sbom_ids) == len(set(sbom_ids)), "SBOM has duplicate SPDX identifiers")
    known_ids = set(sbom_ids)
    for relation in sbom.get("relationships", []):
        check(relation.get("spdxElementId") in known_ids, "SBOM relationship uses an unknown source SPDX identifier")
        check(relation.get("relatedSpdxElement") in known_ids, "SBOM relationship uses an unknown target SPDX identifier")

    for name in ("index.html", "app.html", "policies.html"):
        parser = MarkupInventory()
        source = (ROOT / name).read_text(encoding="utf-8")
        parser.feed(source)
        parser.close()
        check(parser.csp is not None, f"{name}: missing meta Content-Security-Policy")
        if parser.csp is not None:
            csp = parser.csp
            check("default-src 'self'" in csp, f"{name}: CSP does not default to same-origin")
            check("object-src 'none'" in csp, f"{name}: CSP must block plugin/object content")
            check("base-uri 'self'" in csp, f"{name}: CSP must restrict base-uri")
            check("form-action 'self'" in csp, f"{name}: CSP must restrict form-action")
            check("'unsafe-eval'" not in csp, f"{name}: CSP must not enable unsafe-eval")
            connect = re.search(r"(?:^|;\s*)connect-src\s+([^;]+)", csp)
            if connect:
                tokens = connect.group(1).split()
                check(not any(token.startswith("https:") or token.startswith("http:") or token == "*" for token in tokens),
                      f"{name}: connect-src allows a remote origin")
        for src in parser.scripts:
            parsed = urlparse(src)
            check(not parsed.scheme and not src.startswith("//"), f"{name}: non-local script source {src}")
        for src in parser.links:
            parsed = urlparse(src)
            check(not parsed.scheme and not src.startswith("//"), f"{name}: non-local asset reference {src}")

    main_process = (ROOT / "desktop" / "main.js").read_text(encoding="utf-8")
    ipc_handlers = list(re.finditer(r"ipcMain\.handle\(", main_process))
    check(len(ipc_handlers) == 9, f"Expected 9 existing desktop IPC channels, found {len(ipc_handlers)}")
    for index, match in enumerate(ipc_handlers):
        end = ipc_handlers[index + 1].start() if index + 1 < len(ipc_handlers) else len(main_process)
        handler = main_process[match.start():end]
        channel = re.search(r"ipcMain\.handle\(\s*['\"]([^'\"]+)", handler)
        channel_name = channel.group(1) if channel else f"handler #{index + 1}"
        check("fromMain(e)" in handler, f"Desktop IPC channel {channel_name} lacks trusted main-frame validation")

    for target in ("desktop/security.js", "desktop/test/security.test.js", "desktop/print-capabilities.js", "desktop/test/print-capabilities.test.js", "PRINTING-SOURCES.md", "tools/check-project.py", "tools/generate-sbom.py", "desktop/package-lock.json", "SBOM.spdx.json"):
        check((ROOT / target).is_file(), f"Missing expected security regression artifact: {target}")

    if ERRORS:
        print("PROJECT CHECK FAILED")
        for error in ERRORS:
            print(f" - {error}")
        return 1
    print("OK: 33 unique tools; HTML CSP, local scripts, Electron IPC guards, platform print capabilities and SPDX lockfile/vendor hashes validated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
