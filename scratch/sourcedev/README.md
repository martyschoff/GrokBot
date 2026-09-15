# sourcedev

Research packs for a single chapter. One file per chapter. These are not loaded by the player; they are the notes used to build spoken audio, art lists, and (later) a `now-live.json`.

## File name

`scratch/sourcedev/<book>-<n>-sources.txt`

Book slug matches the player id when possible (`hebrews`, `romans`, `1corinthians`).

## Sections

Follow `hebrews-3-sources.txt`. Keep the headings; leave a section explicit when it is empty.

```
SOURCES:

<Book N> KJV (<verse count> verses)
<bible-api URL>
No ;) or :) in this chapter.

Greek (two words max; spoken file only; SBL not named)
<lemma> = <gloss> (v.<n>)
<biblehub URL>
Pronunciation: …

OT KJV (marked citations only; cap four; no padding)
<OT ref> (Heb <ref>) — "<quotation>"
<bible-api URL>

Commentator (ONE from closed fifteen, or silence):
<name>, "<title>" (<anchor verse>)
<url>
<one-line provenance>

WCF: silent | <note>
CCC: silent | <note>

KJV CHAPTER:

<chapter text as a single block>
```

Rules encoded in the Hebrews 3 pack:

- KJV chapter text is the bible-api KJV string for that chapter, including the API's verse count. No emoticons.
- Greek: at most two lemmas. These are for the spoken file only. Do not name SBL.
- OT: at most four **marked** citations. Do not pad with extra cross-references. Quote the **Hebrews KJV wording** of the citation (the wording the listener hears), not a re-quote of the OT verse if they differ. Implied typology may omit the quote (see Exodus 17 in Hebrews 3).
- Commentator: one name from the closed list of fifteen, or silence. Hebrews 3 uses Spurgeon.
- WCF / CCC: `silent` when that chapter is not among the proof texts / citations; otherwise record the cite.

## Hebrews 3 (checked)

`hebrews-3-sources.txt` was checked against its listed URLs:

| Claim | Check |
| --- | --- |
| 19 KJV verses, bible-api `hebrews+3?translation=kjv` | HTTP 200; packed `KJV CHAPTER` matches the API text exactly (1906 chars) |
| No `;)` or `:)` | None in the chapter block |
| `apostolos` (v.1), `pistos` (v.2) | Two lemmas; Bible Hub 652 and 4103 return HTTP 200 |
| Four OT rows, all Psalm 95 / Exodus 17 via bible-api | Psalm 95 and Exodus 17 return HTTP 200 |
| OT quotes use Hebrews wording | Psalm 95:8 KJV is “heart” (singular); the pack correctly quotes Hebrews 3:8 “hearts” |
| Spurgeon, “Take Heed, Brethren” (Hebrews 3:12) | `https://www.spurgeon.org/sermons/take-heed-brethren` returns HTTP 200 |
| WCF / CCC silent | Recorded as silent in the pack |

Hebrews is in the player catalog but has no `audioStem()` mapping and is not live in this tree. Shipping it as audio still needs a stem (or a full `audio` URL) plus `live.json` / `now-live.json` entries.
