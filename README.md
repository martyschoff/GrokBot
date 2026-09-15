# GrokBot

App sources for Martin's Grok Bot projects. App trees live under `apps/<app>/`.

Initial seed includes live `nt4me2` player source under `apps/nt4me2/`.

## Layout

- `apps/nt4me2/` — Daily chapter player (static HTML/CSS/JS). Serve this folder as the web root. See [`apps/nt4me2/README.md`](apps/nt4me2/README.md) for preview, data pack, and optional APIs.
- `scratch/sourcedev/` — Chapter source packs used to research a reading before audio/art go live. See [`scratch/sourcedev/README.md`](scratch/sourcedev/README.md).

Media, live chapter JSON, and MP3s are not stored in this tree. The player loads them at runtime from `/data/…` (or `window.PACK_BASE + /data/…`) on the host that serves the app.

## Preview

The player resolves `/assets/…` from the site root, so the working directory must be `apps/nt4me2/`:

```bash
cd apps/nt4me2
python3 -m http.server 8080
```

Open http://localhost:8080/. Without a data pack you should see **Daily reading**, **Waiting on open-access art.**, and **Waiting on the audio.** Copy [`apps/nt4me2/examples/data/`](apps/nt4me2/examples/data/) to `apps/nt4me2/data/` to exercise live-chapter JSON, help text, and an example art card.
