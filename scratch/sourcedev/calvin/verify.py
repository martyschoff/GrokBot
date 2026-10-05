#!/usr/bin/env python3
"""Prove every extracted quote is a verbatim substring of its CCEL source
volume (after the declared cleaning: footnote markers removed, whitespace
collapsed, ' -- ' rendered as an em dash). Any miss is a fabrication alarm."""
import json
import re

import os
CCEL = os.environ.get("CCEL_DIR", "/tmp/ccel")
BUILD = os.environ.get("CALVIN_BUILD", "/tmp/calvin-build")


def normalize(t):
    t = re.sub(r"\[\d+\]", "", t)
    t = t.replace(" -- ", " — ")
    t = re.sub(r"\s+", " ", t)
    t = t.replace(" ,", ",").replace(" .", ".").replace(" ;", ";")
    return t


quotes = json.load(open(os.path.join(BUILD, "quotes.json")))
cache = {}
bad = []
for key, row in quotes.items():
    if not row:
        continue
    vol = row["volume"]
    if vol not in cache:
        cache[vol] = normalize(open(f"{CCEL}/{vol}.txt", encoding="utf-8",
                                    errors="replace").read())
    if normalize(row["quote"]) not in cache[vol]:
        bad.append(key)

print("checked:", sum(1 for r in quotes.values() if r))
print("verbatim failures:", bad or "none")
