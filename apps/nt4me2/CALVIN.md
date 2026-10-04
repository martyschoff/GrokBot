# John Calvin — consolidated CCEL commentary (issue 25)

One enhanced Calvin note per New Testament chapter, consolidated from the
public-domain Calvin Translation Society commentaries and the Beveridge
Institutes as published by the Christian Classics Ethereal Library (CCEL).
Calvin is wired **in parallel** to the existing exegete voices — nothing was
removed or replaced. Westminster and the RC Catechism keep their own slots.

## What is where

- Speak texts: `data/kjv/<book>/<chapter>/exegete/john-calvin.json`, one per
  chapter for all 260 NT chapters (same shape as the other exegete files:
  `id`, `title`, `chapter`, `source`, `body`, plus `status` and citation
  fields). The `body` is the spoken text.
- Coverage manifest: `data/kjv/john-calvin-manifest.json` lists, per book,
  which chapters carry a real note and which say Calvin is silent.
- Wiring: `assets/app.js` adds `{ id: "john-calvin", label: "Calvin" }` to
  `EXEGETE_VOICES` (the Settings panel, persistence, and Random probing are
  all generated from that list); `assets/sew.js` adds `john-calvin` to
  `EXEGETE_IDS` and maps it to the audio file stem `calvin`.
- Consolidation pipeline (reproducible): `scratch/sourcedev/calvin/`.

## Rules the bodies follow

- Every quote is a verbatim excerpt from the CCEL text of the Calvin
  Translation Society volumes (19th-century translators: William Pringle,
  John Pringle, John Owen, Christopher Fetherstone) — never a modern
  copyrighted edition, never a reconstruction from memory. A verification
  pass proves each quote is a substring of the downloaded source.
- Each note cites the work and the place: the commentary volume, translator,
  and the verse where the comment stands, plus the Institutes book and
  chapter when the Beveridge text itself cites that NT chapter (the mapping
  is read out of the Institutes text, not assigned editorially).
- Chapters Calvin did not cover say he is silent; no line is invented for
  him. Silent set: Revelation 1–22, 2 John, 3 John, and Jude. Note: CCEL
  does carry Calvin on Jude (Commentaries on the Catholic Epistles); it is
  left out here per the issue instruction, and the Jude file says "not
  carried" rather than claiming Calvin wrote nothing.
- Matthew, Mark, and Luke come from the Harmony of the Evangelists, so a
  note may quote the comment standing at the parallel passage; the body says
  "in the section that includes" when so.
- No URLs in any spoken body. No pronunciation guides, so no stress
  apostrophes. No modern weapon metaphors in the framing.

## How Kimberly cuts the audio (unchanged pipeline, new stem)

This tree does not touch AWS, DNS, netfs, Kokoro, or GPU 0, and no existing
audio is regenerated. When the Calvin bodies are cut to audio and mounted,
the player probes the same convention paths as the other exegetes:

- `/data/audio/<stem><chapter>-exegete-calvin.m4a` (preferred, Safari-safe)
- `/data/audio/<stem><chapter>-exegete-calvin.mp3`
- `-american` variants first when Voice:American, e.g.
  `/data/audio/galatians-1-exegete-calvin-american.mp3`
- or a `fragments` key `exegete-john-calvin` in `now-live.json` / `live.json`.

Until those files exist, selecting Calvin behaves like any other exegete with
no audio: the slot is skipped — no stub, no tone, no substitute voice. For
silent chapters the body is a short spoken line saying Calvin is silent;
cut it or omit the file, either works (a missing file is skipped).
