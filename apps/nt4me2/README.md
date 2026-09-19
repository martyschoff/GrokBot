# nt4me2 (Bible Vision)

Chrome/player for the English NT listener. Live audio and `live.json` on S3 (`nt4me2`) stay with Kimberly — this tree does not touch AWS.

## Local preview

From `apps/nt4me2/`:

```
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/` (parchment home) or `http://127.0.0.1:4173/player.html?book=galatians&chapter=1`.

## Menu

Top-level: **Text**, **Volume**, **Book & Chapter**, **Settings**, **Help**.

**Settings** sits just above Help. **Exegete** is a Settings submenu (not top-level). Artwork holds the first picture still — there is no rotation control.

Settings holds Voice (British / American), Bible, Greek, Belief, the sew toggles, and Exegete.

**Bible:** Berean (default, listed first) and KJV only. NIV is not offered.

**Exegete** voices: Matthew Henry, Albert Barnes, Henry Alford, Charles Spurgeon, John Wesley, beside the locked closed-commentary row.

## Settings + sew (Galatians 1 and 2)

Chapter audio is sewn in the player from those toggles plus Greek. A missing fragment is skipped (silence). The player never invents a spoken stub. Missing OT Ref is silence.

Fixture fragments shipped for Galatians 1:

| key | file | notes |
| --- | --- | --- |
| reading | `/data/audio/galatians-1.mp3` | British chapter |
| reading-american | `/data/audio/galatians-1-american.mp3` | American chapter |
| greek | `/data/audio/galatians-1-greek.mp3` | only if Greek: on |
| otref | `/data/audio/galatians-1-otref.mp3` | only if OT Ref: on |
| teaching | `/data/audio/galatians-1-teaching.mp3` | only if Teaching: on |
| westminster | — | omitted on purpose (silence) |
| rccatechism | — | omitted on purpose (silence) |

Galatians 2 is live-capable with the same sew slots. Shipped hooks are British / American reading paths only; teaching, westminster, rccatechism/ccc, and OT Ref stay silent until Kimberly mounts files.

Sew order: reading → greek → otref → teaching → westminster → rccatechism.

Translations are content hooks: `berean` (default) and `kjv`, under `/data/{version}/{book}/{chapter}/`. Exegete fixture cards live at `data/kjv/galatians/{1,2}/exegete/`.

## How Kimberly wires real Galatians 1–2 audio

Merge into S3 `data/live.json` (do not drop other books):

```json
{
  "books": {
    "galatians": [1, 2]
  },
  "fragments": {
    "galatians": {
      "1": {
        "reading": "/data/audio/galatians-1.mp3",
        "reading-american": "/data/audio/galatians-1-american.mp3",
        "greek": "/data/audio/galatians-1-greek.mp3",
        "otref": "/data/audio/galatians-1-otref.mp3",
        "teaching": "/data/audio/galatians-1-teaching.mp3",
        "westminster": "/data/audio/galatians-1-westminster.mp3",
        "rccatechism": "/data/audio/galatians-1-rccatechism.mp3"
      },
      "2": {
        "reading": "/data/audio/galatians-2.mp3",
        "reading-american": "/data/audio/galatians-2-american.mp3",
        "greek": "/data/audio/galatians-2-greek.mp3",
        "teaching": "/data/audio/galatians-2-teaching.mp3",
        "westminster": "/data/audio/galatians-2-westminster.mp3",
        "rccatechism": "/data/audio/galatians-2-rccatechism.mp3"
      }
    }
  }
}
```

Or keep `/data/fragments.json` as an overlay (chrome already ships Galatians 1 and 2 maps). Optional: the same keys on `/data/berean|kjv/galatians/{n}/now-live.json` under `"fragments"`.

Convention paths if a JSON key is omitted: `/data/audio/galatians-{n}-{key}.mp3`, with `-american` before the section key for the American voice (`galatians-1-american-otref.mp3`). Existing Brit/Am `galatians-1.mp3` / `galatians-1-american.mp3` / `-nogrk` names stay valid for the reading piece.

If a section has no real content, omit the file and the key. Do not upload a stub clip.
