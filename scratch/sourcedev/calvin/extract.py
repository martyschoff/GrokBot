#!/usr/bin/env python3
"""Extract one genuine brief Calvin quote per NT chapter from CCEL plain texts.

Sources: Calvin Translation Society volumes (public domain) downloaded from
the Christian Classics Ethereal Library as /tmp/ccel/calcom31..45.txt.
No sentence is composed; quotes are verbatim excerpts from the files.
"""
import json
import os
import re

CCEL = os.environ.get("CCEL_DIR", "/tmp/ccel")
OUT = os.path.join(os.environ.get("CALVIN_BUILD", "/tmp/calvin-build"), "quotes.json")

BOOKS = [
    # id, text name, volumes, chapters, style
    ("matthew", "Matthew", ["calcom31", "calcom32", "calcom33"], 28, "harmony"),
    ("mark", "Mark", ["calcom31", "calcom32", "calcom33"], 16, "harmony"),
    ("luke", "Luke", ["calcom31", "calcom32", "calcom33"], 24, "harmony"),
    ("john", "John", ["calcom34", "calcom35"], 21, "epistle"),
    ("acts", "Acts", ["calcom36", "calcom37"], 28, "epistle"),
    ("romans", "Romans", ["calcom38"], 16, "epistle"),
    ("1corinthians", "1 Corinthians", ["calcom39", "calcom40"], 16, "epistle"),
    ("2corinthians", "2 Corinthians", ["calcom40"], 13, "epistle"),
    ("galatians", "Galatians", ["calcom41"], 6, "epistle"),
    ("ephesians", "Ephesians", ["calcom41"], 6, "epistle"),
    ("philippians", "Philippians", ["calcom42"], 4, "epistle"),
    ("colossians", "Colossians", ["calcom42"], 4, "epistle"),
    ("1thessalonians", "1 Thessalonians", ["calcom42"], 5, "epistle"),
    ("2thessalonians", "2 Thessalonians", ["calcom42"], 3, "epistle"),
    ("1timothy", "1 Timothy", ["calcom43"], 6, "epistle"),
    ("2timothy", "2 Timothy", ["calcom43"], 4, "epistle"),
    ("titus", "Titus", ["calcom43"], 3, "epistle"),
    ("philemon", "Philemon", ["calcom43"], 1, "epistle"),
    ("hebrews", "Hebrews", ["calcom44"], 13, "epistle"),
    ("james", "James", ["calcom45"], 5, "epistle"),
    ("1peter", "1 Peter", ["calcom45"], 5, "epistle"),
    ("2peter", "2 Peter", ["calcom45"], 3, "epistle"),
    ("1john", "1 John", ["calcom45"], 5, "epistle"),
]

STOP_EN = {"the", "and", "of", "to", "that", "which", "is", "for", "he", "we",
           "his", "not", "with", "but", "this", "they", "as", "be", "it", "in"}


def paragraphs(text):
    """Split into (start_offset, paragraph_text) with soft-wrapped lines joined."""
    out = []
    buf = []
    start = 0
    offset = 0
    for line in text.splitlines(keepends=True):
        if line.strip():
            if not buf:
                start = offset
            buf.append(line.strip())
        else:
            if buf:
                out.append((start, " ".join(buf)))
                buf = []
        offset += len(line)
    if buf:
        out.append((start, " ".join(buf)))
    return out


def english_score(p):
    words = re.findall(r"[a-z]+", p.lower())
    if not words:
        return 0.0
    hits = sum(1 for w in words if w in STOP_EN)
    return hits / len(words)


def is_footnote(p):
    return p.startswith("[") or p.lower().startswith("footnotes")


VERSE_START = re.compile(r"^(?:\d{1,3}|[lI])\.\s")
VERSE_START_NODOT = re.compile(r"^\d{1,3}\s+[A-Z]")
INLINE_VNUM = re.compile(r"\s\d{1,3}\.\s")


def looks_like_verse_block(p):
    """Verse text paragraphs: start with 'N. ' (or OCR 'l.') and either stay
    short or contain further inline verse numbers (John style). Some volumes
    print verse text as 'N Text' without the dot; short ones are verse text."""
    if VERSE_START.match(p):
        body = VERSE_START.sub("", p)
        words = len(body.split())
        inline = len(INLINE_VNUM.findall(p))
        if inline >= 1:
            return True
        return words <= 55
    if VERSE_START_NODOT.match(p) and len(p.split()) <= 40:
        return True
    return False


def clean_quote(q):
    q = re.sub(r"\[\d+\]", "", q)
    q = re.sub(r"\s+", " ", q).strip()
    q = q.replace(" ,", ",").replace(" .", ".").replace(" ;", ";")
    return q


SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z\u201c\"'(])")


def first_sentences(p, min_words=18, max_words=80):
    """Verbatim leading sentences of a comment paragraph, skipping the lemma
    marker, between min and max words, always ending at a sentence boundary."""
    p = clean_quote(p)
    # drop a leading verse marker like '3. ', '1 ' (no dot),
    # or 'Matthew 3:2. ' / 'Mark 4:21, 22. '
    p = re.sub(r"^\d{1,3}\.\s+", "", p)
    p = re.sub(r"^(?:[123] )?[A-Z][a-z]+ \d{1,3}:\d{1,3}(?:[-,]\s?\d{1,3})*[.,]?\s+", "", p)
    p = re.sub(r"^\d{1,3}\s+(?=[A-Z])", "", p)
    # drop a leading lemma that ends in 'etc.' followed by a dash
    p = re.sub(r"^[A-Za-z][^.;]{0,60}, etc\.?,? ?(?:--)? ?(?=[A-Z])", "", p)
    p = p.replace(" -- ", " — ")
    sents = SENT_SPLIT.split(p)
    # If the first 'sentence' is a lemma ending in 'etc.', skip it.
    while sents and re.search(r",? etc\.$", sents[0].strip()):
        sents = sents[1:]
    if not sents:
        return ""
    picked = []
    count = 0
    for s in sents:
        w = len(s.split())
        if picked and count + w > max_words:
            break
        picked.append(s)
        count += w
        if count >= min_words:
            break
    if not picked:
        return ""
    if count > 110:  # single monster sentence; reject, caller may try next para
        return ""
    return " ".join(picked).strip()


def load(vol):
    with open(os.path.join(CCEL, vol + ".txt"), encoding="utf-8", errors="replace") as f:
        return f.read()


def pericope_positions(text, name):
    """Offsets of pericope header paragraphs like 'Romans 1:1-7' or
    'Hebrews Chapter 3:1-6' (own line). Philemon has no chapter number:
    'Philemon 1-7' / 'Philemon Verses 8-14'."""
    if name == "Philemon":
        rx = re.compile(r"^   Philemon (?:Verses )?(\d{1,3})(?:-\d{1,3})?\s*$", re.M)
        return [(m.start(), 1, int(m.group(1))) for m in rx.finditer(text)]
    rx = re.compile(r"^   %s (?:Chapter )?(\d{1,3}):(\d{1,3})(?:-\d{1,3}(?::\d{1,3})?)?\s*$"
                    % re.escape(name), re.M)
    return [(m.start(), int(m.group(1)), int(m.group(2))) for m in rx.finditer(text)]


def quote_from_section(section):
    paras = paragraphs(section)
    verse_seen = False
    for off, p in paras[1:]:
        if is_footnote(p):
            continue
        if english_score(p) < 0.18:
            continue  # Latin or headings
        if looks_like_verse_block(p):
            verse_seen = True
            continue
        if not verse_seen and len(p.split()) < 40:
            continue
        q = first_sentences(p)
        if q and len(q.split()) >= 12:
            return q
    return ""


def extract_epistle(bid, name, vols, nch):
    results = {}
    texts = [load(v) for v in vols]
    for ch in range(1, nch + 1):
        found = None
        for vi, text in enumerate(texts):
            pos = pericope_positions(text, name)
            # lowest verse first: the harmony's file order is not verse order
            starts = sorted([p for p in pos if p[1] == ch], key=lambda p: p[2])
            for start, _c, v1 in starts:
                nxt = [p[0] for p in pos if p[0] > start]
                end = min(nxt) if nxt else len(text)
                q = quote_from_section(text[start:end])
                if q:
                    found = {
                        "quote": q,
                        "anchor": "%s %d:%d" % (name, ch, v1),
                        "volume": vols[vi],
                        "method": "epistle-first-comment",
                    }
                    break
            if found:
                break
        results[ch] = found
    return results


HARMONY_KEY = re.compile(r"^(Matthew|Mark|Luke) (\d{1,3}):(\d{1,3})")


def extract_harmony(name, vols, nch):
    results = {}
    texts = [(v, load(v)) for v in vols]
    # comment paragraphs keyed by gospel ref, in reading order per volume
    keyed = []  # (vol, book, ch, v, para)
    for v, text in texts:
        for off, p in paragraphs(text):
            if is_footnote(p):
                continue
            m = HARMONY_KEY.match(p)
            if m and len(p.split()) > 45 and english_score(p) >= 0.18:
                keyed.append((v, m.group(1), int(m.group(2)), int(m.group(3)), p))
    # epistle-style pass on the lowercase pericope subheaders first
    epistle_like = extract_epistle(name.lower(), name, vols, nch)
    for ch in range(1, nch + 1):
        found = epistle_like.get(ch)
        if found:
            found["method"] = "harmony-pericope"
        for v, b, c, vs, p in keyed:
            if found:
                break
            if b == name and c == ch:
                q = first_sentences(p)
                if q and len(q.split()) >= 12:
                    found = {
                        "quote": q,
                        "anchor": "%s %d:%d" % (name, ch, vs),
                        "volume": v,
                        "method": "harmony-keyed",
                    }
                    break
        if not found:
            # fallback: pericope ALLCAPS header mentioning this chapter; first
            # long comment after it (keyed to a parallel gospel)
            hdr = re.compile(r"^   [A-Z0-9:; \-]*%s (\d{1,3}):\d" % name.upper(), re.M)
            for v, text in texts:
                for m in hdr.finditer(text):
                    if int(m.group(1)) != ch:
                        continue
                    seg = text[m.start():m.start() + 20000]
                    for off, p in paragraphs(seg)[1:]:
                        km = HARMONY_KEY.match(p)
                        if km and len(p.split()) > 45 and english_score(p) >= 0.18:
                            q = first_sentences(p)
                            if q and len(q.split()) >= 12:
                                found = {
                                    "quote": q,
                                    "anchor": "%s %s:%s (parallel to %s %d)" % (
                                        km.group(1), km.group(2), km.group(3), name, ch),
                                    "volume": v,
                                    "method": "harmony-parallel",
                                }
                            break
                    if found:
                        break
                if found:
                    break
        results[ch] = found
    return results


# Hand-picked verbatim excerpts where the automatic pick hit an OCR defect.
# Each quote is copied from the downloaded CCEL file, never from memory.
OVERRIDES = {
    "john:18": {
        "quote": ("The chief thing to be considered is, the intention of the "
                  "Evangelist in pointing out the place; for his object was, to "
                  "show that Christ went to death willingly. He came into a place "
                  "which, he knew, was well known to Judas."),
        "anchor": "John 18:1",
        "volume": "calcom35",
        "method": "manual-verbatim",
    },
}


def main():
    all_out = {}
    for bid, name, vols, nch, style in BOOKS:
        if style == "harmony":
            res = extract_harmony(name, vols, nch)
        else:
            res = extract_epistle(bid, name, vols, nch)
        for ch, row in res.items():
            key = "%s:%d" % (bid, ch)
            all_out[key] = OVERRIDES.get(key, row)
        missing = [c for c, r in res.items() if not r]
        print("%-16s %d chapters, missing: %s" % (bid, nch, missing or "none"))
    with open(OUT, "w") as f:
        json.dump(all_out, f, indent=1)
    print("wrote", OUT, "entries:", len(all_out),
          "with quotes:", sum(1 for v in all_out.values() if v))


if __name__ == "__main__":
    main()
