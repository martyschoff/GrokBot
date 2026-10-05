# Calvin consolidation pipeline (issue 25)

Builds the per-chapter John Calvin exegete speak texts under
`apps/nt4me2/data/kjv/<book>/<chapter>/exegete/john-calvin.json` from the
public-domain CCEL texts. Nothing is written from memory: quotes are verbatim
excerpts from the downloaded files and a verification step proves it.

Run order (defaults: sources in `/tmp/ccel`, intermediates in
`/tmp/calvin-build`; override with `CCEL_DIR`, `CALVIN_BUILD`, `CALVIN_OUT`):

1. `sh fetch.sh` — download the sixteen CCEL plain texts (Calvin Translation
   Society commentary volumes calcom31–45 and the Beveridge Institutes).
2. `python3 extract.py` — one verbatim quote per covered NT chapter
   (235 chapters), anchored to the verse where the comment stands.
3. `python3 institutes.py` — map each NT chapter to the Institutes book and
   chapter that cites it most often, read from the Beveridge text itself.
4. `python3 verify.py` — fail loudly if any quote is not a verbatim substring
   of its source volume. Expected output: `verbatim failures: none`.
5. `python3 compose.py` — write the 260 speak-text JSONs (235 notes,
   25 silent) and `john-calvin-manifest.json` into the app data tree.

Coverage: Calvin has no commentary on Revelation, 2 John, or 3 John; those
chapters say he is silent. Jude is also marked silent per the issue
instruction, though CCEL does carry Calvin on Jude (Commentaries on the
Catholic Epistles, trans. John Owen) — flag to Martin if it should be added.

Spoken-body rules enforced by `compose.py`: no URLs, no pronunciation
guides (hence no stress apostrophes), quotes cited by work, translator, and
verse, Institutes cited by book and chapter, silence stated rather than
invented lines.
