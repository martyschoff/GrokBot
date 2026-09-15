# nt4me2 (Daily chapter)

Static New Testament chapter player. This folder is the web root: HTML, CSS, and JS live here; chapter media and JSON are loaded from `/data/` at runtime.

Cache-bust query on `index.html` is `?v=20260904a`. Bump that string when `assets/app.css` or `assets/app.js` change.

## Preview

```bash
cd apps/nt4me2
python3 -m http.server 8080
```

Open http://localhost:8080/. Serving from the repo root 404s `/assets/app.css` and `/assets/app.js`.

Chrome without a pack: title **Daily reading**, empty-art copy, Play/Repeat/Back/Next, Art Interpretation, hamburger menu (Version, Greek, Volume, book/chapter start, Help).

To load the checked-in fixtures:

```bash
cp -R examples/data data
python3 -m http.server 8080
```

That pack has no MP3s, so Play stays idle and the hint stays **Waiting on the audio.** Art, captions, Help, and Art Interpretation should populate from the example JSON.

## Data pack

All fetches use `cache: "no-store"`. Paths below are from the web root unless `window.PACK_BASE` is set (no trailing slash). With a pack base, the player prefixes `/data/…` and skips `/api/now`.

| Path | Required | Role |
| --- | --- | --- |
| `/data/live.json` | Yes, for Next/Back and the book picker | Which book IDs have live chapter numbers |
| `/data/now-live.json` | Default chapter when nothing is picked | Current title, book, chapter, audio, art |
| `/data/kjv/<book>/<n>/now-live.json` | After a book/chapter pick or a completed-chapter restore | Same shape as `now-live.json`, pinned to that chapter |
| `/data/books.json` | Optional | NT catalog for the picker. Missing file → built-in 27-book list |
| `/data/help.txt` | Optional | Menu → Help. Missing file → **Waiting on the help.** |
| `/data/art/interpretations.json` | Optional | Map art filename → approved card |
| `/data/art/<card>` | Per approved row | Interpretation card JSON |
| `/data/audio/<stem><n>.mp3` | Per live chapter | Spoken chapter (Greek on) |
| `/data/audio/<stem><n>-nogrk.mp3` | Per live chapter | Spoken chapter (Greek off) |

`live.json` is the allow-list. The picker can show a book as live only when this table has at least one chapter `>= 1`. `NT_FALLBACK` in `assets/app.js` marks Romans and 1 Corinthians `live: true` for labels only; chapters still will not play unless they appear in `live.json`.

### `live.json`

Object of book id → chapter numbers. Either a top-level map or a `{ "books": { … } }` wrapper. Each value is an array of ints or `{ "chapters": [ … ] }`. Non-numeric and `< 1` entries are dropped; the rest are sorted.

See `examples/data/live.json`.

### `now-live.json`

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Header. Also used to infer book/chapter if `book` / `chapter` are missing (`Romans 8`, `1 Corinthians 13`) |
| `book` | string | Book id (`romans`, `1corinthians`, …) |
| `chapter` | number | Chapter number |
| `audio` | string | Absolute URL, or a root-relative path rewritten by `mediaUrl()` |
| `hymn` | string | Ignored while `HYMN_ENABLED` is `false` |
| `art` | array | Slideshow items (see below) |
| `waiting_audio` | bool | If true (or `audio` empty) and the chapter is live, player synthesizes `/data/audio/<stem><n>.mp3` |
| `waiting_art` | bool | Reserved; empty `art` already shows the empty-art state |
| `waiting_hymn` | bool | Hint text only, and only if hymns are enabled |

Art item:

| Field | Type | Notes |
| --- | --- | --- |
| `src` | string | Image URL or root-relative path |
| `file` | string | Optional. Index key into `interpretations.json`. Defaults to the filename of `src` |
| `title`, `place`, `artist` | string | Caption. Artist `unknown` (any case) or empty displays as `unknown` |

If a chapter was picked explicitly and that `now-live.json` is missing, the player **does not** fall back to root `now-live.json` (that file is treated as Romans). It synthesizes title/audio from `live.json` + `audioStem()`.

See `examples/data/now-live.json` and `examples/data/kjv/romans/1/now-live.json`.

### Audio stems

`audioStem()` only maps two books in this tree. Any other live book needs a stem added here or a complete `audio` URL on the chapter JSON.

| Book id | Greek-on file | Greek-off file |
| --- | --- | --- |
| `romans` | `/data/audio/romans-<n>.mp3` | `/data/audio/romans-<n>-nogrk.mp3` |
| `1corinthians` | `/data/audio/1cor-<n>.mp3` | `/data/audio/1cor-<n>-nogrk.mp3` |

### `books.json`

```json
{
  "version": "KJV",
  "books": [
    { "id": "romans", "label": "Romans", "live": true, "chapters": 16 }
  ]
}
```

`live` on a catalog row is ignored. The picker enables a book only when `live.json` lists chapters for that `id`. `chapters` is the button count; if live chapters go higher, the picker expands to that max.

### Art interpretations

`/data/art/interpretations.json` is a map keyed by art filename:

```json
{
  "example-open-access.svg": {
    "status": "approved",
    "card": "example-card.json"
  }
}
```

Only `status === "approved"` with a non-empty `card` lights the Art Interpretation button green. The card is fetched from `/data/art/<card>` (leading slashes stripped).

Card JSON:

| Field | Type | Notes |
| --- | --- | --- |
| `status` | string | Must be `approved` or the card is ignored |
| `sources_header` | string[] | Gold lines above the body |
| `body` | string | Paragraphs split on blank lines |
| `citations` | object[] | `author`, `title`, `publication`, `date` joined with `", "`. `url` starting `http://` or `https://` becomes a link |

See `examples/data/art/example-card.json`.

## Optional host APIs

Used only when `PACK_BASE` is empty. Failures are ignored; the player keeps working from files + `localStorage`.

### `GET /api/now`

Same JSON as `now-live.json`. Tried before `/data/now-live.json` on the default (unpicked) path.

### `GET /api/prefs` → `{ "hearGreek": true }`

### `POST /api/prefs` `Content-Type: application/json`

Body `{ "hearGreek": true }`. Volume is local only; it is not posted.

## Browser storage

| Key | Value |
| --- | --- |
| `daily-chapter-hear-greek` | `"1"` or `"0"` |
| `daily-chapter-voice-volume` | `0`–`1` string |
| `daily-chapter-completed` | `{"book":"romans","chapter":1}` written when voice `ended` |

On boot, a completed chapter is restored only if that book/chapter is still in `live.json`.

Host `hearGreek` from `GET /api/prefs` wins over `localStorage` when the GET succeeds.

## Runtime notes

- Default book id is `romans`. Default version label is KJV; NIV is a disabled menu row.
- Slideshow advances every 12.5s (`ART_MS`). Opening Art Interpretation freezes the slideshow and pauses voice.
- `load()`, `loadIndex()`, and `loadLiveTable()` poll every 15s.
- `window.PACK_BASE` is read at runtime. Set it in a small inline script before `assets/app.js` if the pack is not at the site root.
