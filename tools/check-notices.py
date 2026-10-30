#!/usr/bin/env python3
# FRZ PDF Express — an open-source application by FRZ Generations
# Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations
# SPDX-License-Identifier: MIT
"""Checks that the copyright notice and licence credit are still intact.

Run from the project root:  python3 tools/check-notices.py
Exit code 0 = all notices present, 1 = something was removed or altered.
Forks may ADD their own copyright lines; the original lines must remain.
"""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
COPYRIGHT = "Copyright (c) 2026 Faraz Ahammed CM / FRZ Generations"
CREDIT = "Faraz Ahammed CM / FRZ Generations"
SKIP = {"vendor", ".git", "node_modules", "dist"}
SOURCE_EXT = {".html", ".js", ".py"}

problems = []

lic = (ROOT / "LICENSE").read_text(encoding="utf-8") if (ROOT / "LICENSE").exists() else ""
if "MIT License" not in lic or COPYRIGHT not in lic:
    problems.append("LICENSE: MIT text or the original copyright line is missing/altered")
for needed in ("Permission is hereby granted, free of charge", "The above copyright notice and this permission notice shall be included in all",
               "THE SOFTWARE IS PROVIDED \"AS IS\""):
    if needed not in lic:
        problems.append(f"LICENSE: required MIT clause missing: {needed[:40]}...")

notice = (ROOT / "NOTICE").read_text(encoding="utf-8") if (ROOT / "NOTICE").exists() else ""
if CREDIT not in notice:
    problems.append("NOTICE: creator credit is missing")

for path in sorted(ROOT.rglob("*")):
    if not path.is_file() or path.suffix not in SOURCE_EXT or any(part in SKIP for part in path.relative_to(ROOT).parts):
        continue
    head = path.read_text(encoding="utf-8", errors="ignore")[:1500]
    if COPYRIGHT not in head:
        problems.append(f"{path.relative_to(ROOT)}: copyright header missing in first lines")

if problems:
    print("NOTICE CHECK FAILED")
    for p in problems:
        print(" -", p)
    sys.exit(1)
print("OK: copyright notices, LICENSE and credit are intact.")
