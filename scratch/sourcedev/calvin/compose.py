#!/usr/bin/env python3
"""Compose the consolidated John Calvin exegete speak texts.

One JSON per NT chapter, shaped like the other exegete files
(data/kjv/<book>/<chapter>/exegete/<id>.json). Bodies are written to be
read aloud later: no URLs, no pronunciation guides, no stress apostrophes.
Quotes come verbatim from quotes.json (verified against the CCEL files);
Institutes references come from institutes.json (read out of the Beveridge
text, never from memory). Chapters Calvin did not cover say he is silent.
"""
import json
import os

BUILD = os.environ.get("CALVIN_BUILD", "/tmp/calvin-build")
OUTROOT = os.environ.get("CALVIN_OUT", "/workspace/apps/nt4me2/data/kjv")

QUOTES = json.load(open(os.path.join(BUILD, "quotes.json")))
INST = json.load(open(os.path.join(BUILD, "institutes.json")))

# book id -> (label, chapters, work title, translator, harmony?)
BOOKS = [
    ("matthew", "Matthew", 28, "Commentary on a Harmony of the Evangelists", "William Pringle", True),
    ("mark", "Mark", 16, "Commentary on a Harmony of the Evangelists", "William Pringle", True),
    ("luke", "Luke", 24, "Commentary on a Harmony of the Evangelists", "William Pringle", True),
    ("john", "John", 21, "Commentary on the Gospel according to John", "William Pringle", False),
    ("acts", "Acts", 28, "Commentary upon the Acts of the Apostles", "Christopher Fetherstone", False),
    ("romans", "Romans", 16, "Commentary on the Epistle to the Romans", "John Owen", False),
    ("1corinthians", "1 Corinthians", 16, "Commentary on the Epistles to the Corinthians", "John Pringle", False),
    ("2corinthians", "2 Corinthians", 13, "Commentary on the Epistles to the Corinthians", "John Pringle", False),
    ("galatians", "Galatians", 6, "Commentary on Galatians and Ephesians", "William Pringle", False),
    ("ephesians", "Ephesians", 6, "Commentary on Galatians and Ephesians", "William Pringle", False),
    ("philippians", "Philippians", 4, "Commentary on Philippians, Colossians, and Thessalonians", "John Pringle", False),
    ("colossians", "Colossians", 4, "Commentary on Philippians, Colossians, and Thessalonians", "John Pringle", False),
    ("1thessalonians", "1 Thessalonians", 5, "Commentary on Philippians, Colossians, and Thessalonians", "John Pringle", False),
    ("2thessalonians", "2 Thessalonians", 3, "Commentary on Philippians, Colossians, and Thessalonians", "John Pringle", False),
    ("1timothy", "1 Timothy", 6, "Commentary on the Epistles to Timothy, Titus, and Philemon", "William Pringle", False),
    ("2timothy", "2 Timothy", 4, "Commentary on the Epistles to Timothy, Titus, and Philemon", "William Pringle", False),
    ("titus", "Titus", 3, "Commentary on the Epistles to Timothy, Titus, and Philemon", "William Pringle", False),
    ("philemon", "Philemon", 1, "Commentary on the Epistles to Timothy, Titus, and Philemon", "William Pringle", False),
    ("hebrews", "Hebrews", 13, "Commentary on the Epistle to the Hebrews", "John Owen", False),
    ("james", "James", 5, "Commentaries on the Catholic Epistles", "John Owen", False),
    ("1peter", "1 Peter", 5, "Commentaries on the Catholic Epistles", "John Owen", False),
    ("2peter", "2 Peter", 3, "Commentaries on the Catholic Epistles", "John Owen", False),
    ("1john", "1 John", 5, "Commentaries on the Catholic Epistles", "John Owen", False),
    # silent set
    ("2john", "2 John", 1, "", "", False),
    ("3john", "3 John", 1, "", "", False),
    ("jude", "Jude", 1, "", "", False),
    ("revelation", "Revelation", 22, "", "", False),
]

SPOKEN_LABEL = {
    "1 Corinthians": "First Corinthians", "2 Corinthians": "Second Corinthians",
    "1 Thessalonians": "First Thessalonians", "2 Thessalonians": "Second Thessalonians",
    "1 Timothy": "First Timothy", "2 Timothy": "Second Timothy",
    "1 Peter": "First Peter", "2 Peter": "Second Peter",
    "1 John": "First John", "2 John": "Second John", "3 John": "Third John",
}

SINGLE_CHAPTER = {"philemon", "2john", "3john", "jude"}


def spoken(label):
    return SPOKEN_LABEL.get(label, label)


def spoken_anchor(anchor):
    """'Romans 8:1' -> 'Romans 8, verse 1' with spoken ordinals."""
    book_part, _, verse = anchor.rpartition(":")
    name, _, ch = book_part.rpartition(" ")
    return "%s %s, verse %s" % (spoken(name), ch, verse)


def silent_body(bid, label, ch):
    opener = "John Calvin on %s." % spoken(label) if bid in SINGLE_CHAPTER \
        else "John Calvin on %s, chapter %d." % (spoken(label), ch)
    if bid == "revelation":
        reason = "He wrote no commentary on the book of Revelation."
    elif bid == "jude":
        reason = "No Calvin commentary is carried for Jude in this reading."
    else:
        reason = "He wrote no commentary on this epistle."
    return "%s Calvin is silent here. %s" % (opener, reason)


def note_body(bid, label, ch, work, translator, harmony, q, inst):
    opener = "John Calvin on %s." % spoken(label) if bid in SINGLE_CHAPTER \
        else "John Calvin on %s, chapter %d." % (spoken(label), ch)
    anchor = q["anchor"]
    where = "in the section that includes %s" % spoken_anchor(anchor) if harmony \
        else "at %s" % spoken_anchor(anchor)
    quote = q["quote"]
    if not quote.endswith((".", "!", "?")):
        quote += "."
    parts = [
        opener,
        "In his %s, in the %s translation, Calvin writes %s: %s" % (
            work, translator, where, quote),
    ]
    if inst:
        parts.append(
            "In the Institutes of the Christian Religion, in the Henry "
            "Beveridge translation, Calvin draws on this chapter again in "
            "Book %d, chapter %d." % (inst["book"], inst["chapter"]))
    return " ".join(parts)


def main():
    manifest = {"id": "john-calvin", "title": "John Calvin", "books": {}}
    total_notes = total_silent = 0
    for bid, label, nch, work, translator, harmony in BOOKS:
        notes, silent = [], []
        for ch in range(1, nch + 1):
            key = "%s:%d" % (bid, ch)
            q = QUOTES.get(key)
            inst = INST.get(key)
            if work and q:
                body = note_body(bid, label, ch, work, translator, harmony, q, inst)
                status = "note"
                src = ("Public domain. Consolidated from John Calvin, %s, "
                       "translated by %s, Calvin Translation Society, and the "
                       "Institutes of the Christian Religion, translated by "
                       "Henry Beveridge; both as published by the Christian "
                       "Classics Ethereal Library." % (work, translator))
                notes.append(ch)
            else:
                body = silent_body(bid, label, ch)
                status = "silent"
                if bid == "jude":
                    # Calvin did write on Jude (Commentaries on the Catholic
                    # Epistles); it is deliberately not carried in this set.
                    src = ("Public domain. A Calvin commentary on Jude exists in "
                           "the Calvin Translation Society set at the Christian "
                           "Classics Ethereal Library, but it is not carried in "
                           "this reading.")
                else:
                    src = ("Public domain. John Calvin left no commentary for this "
                           "chapter in the Calvin Translation Society set at the "
                           "Christian Classics Ethereal Library.")
                silent.append(ch)
            row = {
                "id": "john-calvin",
                "title": "John Calvin",
                "chapter": "%s %d" % (label, ch),
                "source": src,
                "status": status,
                "body": body,
            }
            if status == "note":
                row["cite"] = {"work": work, "translator": translator,
                               "at": q["anchor"], "ccel_volume": q["volume"]}
                if inst:
                    row["institutes"] = {
                        "book": inst["book"], "chapter": inst["chapter"],
                        "section": inst["section"],
                        "citations_of_this_chapter": inst["citations"],
                        "translator": "Henry Beveridge",
                    }
            outdir = os.path.join(OUTROOT, bid, str(ch), "exegete")
            os.makedirs(outdir, exist_ok=True)
            with open(os.path.join(outdir, "john-calvin.json"), "w") as f:
                json.dump(row, f, indent=2, ensure_ascii=False)
                f.write("\n")
        manifest["books"][bid] = {"label": label, "chapters": nch,
                                  "notes": notes, "silent": silent}
        total_notes += len(notes)
        total_silent += len(silent)
    manifest["totals"] = {"chapters": total_notes + total_silent,
                          "notes": total_notes, "silent": total_silent}
    with open(os.path.join(OUTROOT, "john-calvin-manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print("notes:", total_notes, "silent:", total_silent)


if __name__ == "__main__":
    main()
