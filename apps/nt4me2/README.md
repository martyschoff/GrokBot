# nt4me2 (Bible Vision)

Chrome/player for the English NT listener. Live audio and `live.json` on S3 (`nt4me2`) stay with Kimberly — this tree does not touch AWS.

## Local preview

From `apps/nt4me2/`:

```
python3 -m http.server 4173
```

Open `http://127.0.0.1:4173/` (parchment home) or `http://127.0.0.1:4173/player.html?book=galatians&chapter=1`.

## Settings + sew (Galatians 1)

Menu → **Settings** holds Voice, Bible, Greek, Belief, plus on/off **OT Ref**, **Teaching**, **Westminster**, **RC Catechism** (green when on).

Chapter audio is sewn in the player from those toggles plus Greek. A missing fragment is skipped (silence). The player never invents a spoken stub.

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

Sew order: reading → greek → otref → teaching → westminster → rccatechism.

## How Kimberly wires real Galatians 1 audio

Merge into S3 `data/live.json` (do not drop other books):

```json
{
  "books": {
    "galatians": [1]
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
      }
    }
  }
}
```

Or keep `/data/fragments.json` as an overlay (chrome already ships a Galatians 1 map). Optional: the same keys on `/data/kjv/galatians/1/now-live.json` under `"fragments"`.

Convention paths if a JSON key is omitted: `/data/audio/galatians-1-{key}.mp3`, with `-american` before the section key for the American voice (`galatians-1-american-otref.mp3`). Existing Brit/Am `galatians-1.mp3` / `galatians-1-american.mp3` / `-nogrk` names stay valid for the reading piece.

If a section has no real content, omit the file and the key. Do not upload a stub clip.
