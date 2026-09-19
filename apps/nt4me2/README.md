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

Chapter audio is sewn from one Kokoro main (Bible × Greek-on/off × Voice), then OT Ref (if on and present), Teaching, Westminster, RC Catechism. Greek is baked into the main — not a separate sew fragment. Missing pieces, including OT Ref, are silence — no stub. The chapter queue never appends a closer/coda clip (Kokoro mains may still speak “That is the chapter.” in the main file). Exegete is never auto-queued after the main; it plays only when the listener picks a voice under Settings → Exegete, audio-only, with no text overlay on the art.

### Main-read paths (kjv|bsb × greekon|greekoff × british|american)

`/data/audio/galatians-{1|2}-{kjv|bsb}-main-{greekon|greekoff}-{british|american}.mp3`

`bibleVersion` berean → `bsb`, kjv → `kjv`. `hearGreek` on → `greekon`, else `greekoff`.

Examples: `galatians-1-bsb-main-greekon-british.mp3`, `galatians-2-kjv-main-greekoff-american.mp3`.

If a Kokoro main is missing, the player also probes `galatians-{n}-{berean|kjv}-{british|american}.mp3`. RC Catechism also probes `-rccatechism.mp3`; long exegete ids (`exegete-matthew-henry`) still resolve.

### Shared fragment paths

`/data/audio/galatians-{1|2}-teaching.mp3`  
`/data/audio/galatians-{1|2}-westminster.mp3`  
`/data/audio/galatians-{1|2}-ccc.mp3` (rccatechism)  
`/data/audio/galatians-{1|2}-exegete-{henry|barnes|alford|spurgeon|wesley}.mp3`  
`/data/audio/galatians-{1|2}-ot-ref.mp3` — omit if empty (silence).

Exegete settings ids map to file stems: matthew-henry → henry, albert-barnes → barnes, henry-alford → alford.

## How Kimberly wires real audio

Merge into S3 `data/live.json` (do not drop other books):

```json
{
  "books": { "galatians": [1, 2] },
  "fragments": {
    "galatians": {
      "1": {
        "reading-bsb-main-greekon-british": "/data/audio/galatians-1-bsb-main-greekon-british.mp3",
        "reading-kjv-main-greekoff-american": "/data/audio/galatians-1-kjv-main-greekoff-american.mp3"
      },
      "2": {
        "reading-bsb-main-greekon-british": "/data/audio/galatians-2-bsb-main-greekon-british.mp3",
        "reading-kjv-main-greekoff-american": "/data/audio/galatians-2-kjv-main-greekoff-american.mp3"
      }
    }
  }
}
```

Convention paths above work if JSON keys are omitted. If a section has no real content (especially OT Ref), omit the file and the key. Do not upload a stub clip.

Local `data/live.json` marks `galatians: [1, 2]`. When merging that into S3, keep every other live book.
