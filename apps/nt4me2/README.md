# nt4me2 (Bible Vision)

Chrome/player for the English NT listener. Live audio on S3 `nt4me2` stays with Kimberly — this tree does not touch AWS.

## Local / mini preview

From `apps/nt4me2/`:

```
python3 -m http.server 8787
```

Open `http://127.0.0.1:8787/` or `http://127.0.0.1:8787/player.html?book=galatians&chapter=1`.

## Settings + sew (Galatians 1 and 2)

Top-level menu: Text, Volume, Book & Chapter, **Settings**, Help.

Settings holds Voice, Bible (Berean default, then KJV), Greek, Belief, **Exegete**, plus on/off OT Ref, Teaching, Westminster, RC Catechism.

Exegete voices (on/off): Matthew Henry, Albert Barnes, Henry Alford, Spurgeon, Wesley. Closed commentaries stay locked.

Artwork does not rotate.

Chapter audio is sewn from the selected Bible × Voice main read, then Greek (if on), OT Ref (if on and present), Teaching, Westminster, RC Catechism, then any on exegete-* fragments. Missing pieces, including OT Ref, are silence — no stub.

### Main-read paths (berean/kjv × american/british)

`/data/audio/galatians-{1|2}-{berean|kjv}-{british|american}.mp3`

Examples: `galatians-1-berean-british.mp3`, `galatians-2-kjv-american.mp3`.

### Fragment paths

`/data/audio/galatians-{1|2}-teaching.mp3`  
`/data/audio/galatians-{1|2}-westminster.mp3`  
`/data/audio/galatians-{1|2}-rccatechism.mp3`  
`/data/audio/galatians-{1|2}-exegete-{matthew-henry|albert-barnes|henry-alford|spurgeon|wesley}.mp3`  
`/data/audio/galatians-{1|2}-ot-ref.mp3` — omit if empty (silence).

Greek (optional): `galatians-{1|2}-greek.mp3`.

## How Kimberly wires real audio

Merge into S3 `data/live.json` (do not drop other books):

```json
{
  "books": { "galatians": [1, 2] },
  "fragments": {
    "galatians": {
      "1": {
        "reading-berean-british": "/data/audio/galatians-1-berean-british.mp3",
        "reading-berean-american": "/data/audio/galatians-1-berean-american.mp3",
        "reading-kjv-british": "/data/audio/galatians-1-kjv-british.mp3",
        "reading-kjv-american": "/data/audio/galatians-1-kjv-american.mp3"
      },
      "2": {
        "reading-berean-british": "/data/audio/galatians-2-berean-british.mp3",
        "reading-berean-american": "/data/audio/galatians-2-berean-american.mp3",
        "reading-kjv-british": "/data/audio/galatians-2-kjv-british.mp3",
        "reading-kjv-american": "/data/audio/galatians-2-kjv-american.mp3"
      }
    }
  }
}
```

Convention paths above work if JSON keys are omitted. If a section has no real content (especially OT Ref), omit the file and the key. Do not upload a stub clip.

Local `data/live.json` marks `galatians: [1, 2]`. When merging that into S3, keep every other live book.
