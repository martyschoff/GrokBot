#!/usr/bin/env python3
"""Map each NT chapter to the Institutes passage (Beveridge translation,
CCEL text) that cites it most often. Citations are read from the text
itself; nothing is assigned from memory."""
import json
import re
from collections import defaultdict

import os
SRC = os.path.join(os.environ.get("CCEL_DIR", "/tmp/ccel"), "institutes.txt")
OUT = os.path.join(os.environ.get("CALVIN_BUILD", "/tmp/calvin-build"), "institutes.json")

BOOK_WORDS = {"FIRST.": 1, "SECOND.": 2, "THIRD.": 3, "FOURTH.": 4}

ABBR = [
    ("1 Corinthians", "1corinthians"), ("2 Corinthians", "2corinthians"),
    ("1 Cor", "1corinthians"), ("2 Cor", "2corinthians"),
    ("1 Thessalonians", "1thessalonians"), ("2 Thessalonians", "2thessalonians"),
    ("1 Thess", "1thessalonians"), ("2 Thess", "2thessalonians"),
    ("1 Timothy", "1timothy"), ("2 Timothy", "2timothy"),
    ("1 Tim", "1timothy"), ("2 Tim", "2timothy"),
    ("1 Peter", "1peter"), ("2 Peter", "2peter"),
    ("1 Pet", "1peter"), ("2 Pet", "2peter"),
    ("1 John", "1john"), ("2 John", "2john"), ("3 John", "3john"),
    ("Matthew", "matthew"), ("Matth", "matthew"), ("Mt", "matthew"),
    ("Mark", "mark"), ("Luke", "luke"), ("John", "john"), ("Acts", "acts"),
    ("Romans", "romans"), ("Rom", "romans"),
    ("Galatians", "galatians"), ("Gal", "galatians"),
    ("Ephesians", "ephesians"), ("Eph", "ephesians"),
    ("Philippians", "philippians"), ("Philip", "philippians"),
    ("Philemon", "philemon"), ("Philem", "philemon"), ("Phil", "philippians"),
    ("Colossians", "colossians"), ("Col", "colossians"),
    ("Titus", "titus"), ("Tit", "titus"),
    ("Hebrews", "hebrews"), ("Heb", "hebrews"),
    ("James", "james"), ("Jas", "james"), ("Jude", "jude"),
    ("Revelation", "revelation"), ("Rev", "revelation"),
]
ABBR_MAP = {a: b for a, b in ABBR}
REF_RX = re.compile(
    r"\b(%s)\.?,? ?(\d{1,3}):(\d{1,3})" % "|".join(re.escape(a) for a, _ in ABBR))

CHAPTER_RX = re.compile(r"^ {1,4}CHAPTER (\d+)\.", re.M)
SECTION_RX = re.compile(r"^ {3}(\d{1,3})\. ", re.M)


def main():
    text = open(SRC, encoding="utf-8", errors="replace").read()
    start = text.index("BOOK FIRST.")
    end = re.search(r"^BOOK 1$", text, re.M).start()
    text = text[start:end]

    # position markers: (offset, kind, value)
    marks = []
    for m in re.finditer(r"^\s*BOOK (FIRST\.|SECOND\.|THIRD\.|FOURTH\.)", text, re.M):
        marks.append((m.start(), "book", BOOK_WORDS[m.group(1)]))
    for m in CHAPTER_RX.finditer(text):
        marks.append((m.start(), "chapter", int(m.group(1))))
    for m in SECTION_RX.finditer(text):
        marks.append((m.start(), "section", int(m.group(1))))
    marks.sort()

    counts = defaultdict(lambda: defaultdict(int))
    sections = {}
    book = chap = sec = 0
    mi = 0
    for m in REF_RX.finditer(text):
        while mi < len(marks) and marks[mi][0] < m.start():
            _o, kind, val = marks[mi]
            if kind == "book":
                book, chap, sec = val, 0, 0
            elif kind == "chapter":
                chap, sec = val, 0
            else:
                sec = val
            mi += 1
        if not book or not chap:
            continue
        bid = ABBR_MAP[m.group(1)]
        ch = int(m.group(2))
        key = "%s:%d" % (bid, ch)
        counts[key][(book, chap)] += 1
        sections.setdefault((key, book, chap), sec)

    out = {}
    for key, cmap in counts.items():
        (bk, ch), n = max(cmap.items(), key=lambda kv: (kv[1], -kv[0][0], -kv[0][1]))
        out[key] = {"book": bk, "chapter": ch, "citations": n,
                    "section": sections.get((key, bk, ch), 0)}
    with open(OUT, "w") as f:
        json.dump(out, f, indent=1, sort_keys=True)
    total = sum(len(v) for v in counts.values())
    print("NT chapters with Institutes citations:", len(out))
    for probe in ("romans:8", "romans:9", "john:1", "ephesians:1", "hebrews:9",
                  "matthew:6", "1corinthians:11", "galatians:2"):
        print(probe, "->", out.get(probe))


if __name__ == "__main__":
    main()
