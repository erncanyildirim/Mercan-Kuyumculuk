#!/usr/bin/env python3
"""Adds/updates a ?v=<stamp> query on every /assets/ CSS and JS reference of the static site,
including module imports, so a deploy never mixes a cached old file with new pages.

usage: python3 tools/web/stamp_assets.py            (run before each web deploy)
"""
import pathlib
import re
import time

ROOT = pathlib.Path(__file__).resolve().parents[2] / "webApp/src/webMain/resources"
STAMP = time.strftime("%Y%m%d%H%M")

# href/src="/assets/x.css|js" and import specifiers "./x.js", "../assets/x.js", "/assets/x.js"
PATTERN = re.compile(r'''((?:/assets/|\.\./assets/|\./)[\w.-]+\.(?:css|js))(?:\?v=\d+)?(["'])''')

changed = 0
for path in list(ROOT.rglob("*.html")) + list(ROOT.rglob("*.js")):
    if "admin" not in path.parts and "assets" not in path.parts and path.suffix == ".js":
        continue  # the Compose build output and other scripts are left alone
    text = path.read_text(encoding="utf-8")
    new = PATTERN.sub(lambda m: f"{m.group(1)}?v={STAMP}{m.group(2)}", text)
    if new != text:
        path.write_text(new, encoding="utf-8")
        changed += 1
print(f"stamped {changed} files with v={STAMP}")
