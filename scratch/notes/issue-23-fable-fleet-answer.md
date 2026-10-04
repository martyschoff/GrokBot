# Fable's answer to issue #23 — what to tweak across the fleet once the New Testament audio is done

Answer to <https://github.com/martyschoff/GrokBot/issues/23>. Posted as a note in a PR because the agent's GitHub token cannot comment on issues (read-only for issue writes); the content below is the comment as written.

Fable here. I read `main`, the `house-disk-audio` branch (`apps/house-disk-audio/serve.py` + README), the `nt4me2` player tree and its README (sew paths, fragment matrix, Kimberly's `live.json` merge flow), the freeOverheard ledgers/skills, and the machine list in this issue. Answers to the four questions, in order.

## 1. What is actually weak

**The 3080a host, not its GPUs.** An i3-9100 (4 cores), 16 GB DDR4-2133, PCIe gen 2, and a single 250 GB SATA SSD are all undersized relative to eight 3080s. A 70 GB weight file barely fits on that disk next to the OS and `D:\kokoro-nt`, loads at SATA speed (minutes per model load), and 16 GB of system RAM is less than a quarter of the weight size you'd stream through it. Whatever the GPUs do next, the host is the ceiling. If any money is spent, it's RAM and an NVMe drive for this box, not more GPUs.

**Finished audio has one copy.** The NT mp3s land in `I:\house-disk-audio\nt\audio\` on mlsfs, and that Storage Spaces volume is one machine. The repo carries the player, Kimberly carries the S3 live set, but the master Kokoro output sits in a single place. A scheduled one-way copy (robocopy to a disk on another tower, or into the S3 flow Kimberly already runs for `nt4me2`) is the cheapest fix for the biggest real risk here.

**No machine-checkable manifest of what "done" means.** `apps/nt4me2/README.md` defines an enumerable expected-file set — book × chapter × {kjv,bsb} × {greekon,greekoff} × {british,american} mains, plus westminster/ccc/ot-ref/exegete fragments. Nothing in the tree lists which of those files exist. A checked-in manifest (or a tiny script that scans `I:\house-disk-audio\nt\audio\` against the convention) would let Kimberly verify completeness mechanically before merging `live.json`, instead of by eye.

**Two small weaknesses in `serve.py` on the `house-disk-audio` branch** (noting only; this issue asked for no code change):
- Its CORS headers advertise `Range` and expose `Content-Range`, but Python's `SimpleHTTPRequestHandler` doesn't actually serve byte ranges — it returns 200 with the full body. Seeking inside a long chapter mp3 from a tailnet player will re-download the file. A range-capable handler is a one-file tweak when wanted.
- The default `--root` is `I:\`, which exposes the entire 67 TB share read-only to everyone on the tailnet. Scoping it to `I:\house-disk-audio` serves the same audio with less surface.

**Several "do not stop / do not log off / do not reboot" machines with no heartbeat.** mlsfs's server, the Whisper server on GPU 0, Hermes on the Mac mini at 9119 — all are load-bearing and all fail silently. A trivial tailnet status check (ping each port, write one line) running on mlsfs would catch outages before a person does.

## 2. What I would change after the NT audio finishes

**Run a Whisper QC pass over the finished audio before anything new starts.** GPUs 1–7 become free, GPU 0 already runs Whisper. Point batch Whisper at every finished mp3 in `I:\house-disk-audio\nt\audio\`, transcribe, and diff against the Berean/KJV source text. The player's own rules ("no stub, no tone, no substitute") assume the files that exist are right; this is the only way to know that at scale, and it flags bad sews before Kimberly wires them live. It's also the single best match between what this fleet has (lots of independent 10 GB GPUs) and what the repo actually needs.

**Use the 8×3080 as eight independent single-GPU workers, not one glued-together big machine.** PCIe gen 2 with no NVLink punishes anything that needs inter-GPU bandwidth, and punishes nothing that doesn't. Independent workers — Whisper QC, further Kokoro batches (the fragment matrix has many empty slots: exegete voices, OT refs, Westminster/CCC across books), embeddings, or an 8B-class model per GPU (the issue already notes Qwen3-8B needs no tensor split on these cards) — get full value from the box as-is.

**Add the backup job and the manifest from §1.** Both are a few lines, both protect months of GPU time.

**If Hermes needs a local model endpoint, tower3 is the right host for it** — one 3080, 64 GB RAM, 12 cores; a single-GPU 8B-class model there serves Hermes without touching the 8×3080 box or competing with `gpt-oss:120b` on tower1.

## 3. What I would not change

- GPU 0 stays on Whisper; the Kokoro queue runs untouched to completion; no second job on GPUs 1–7 until then.
- The mlsfs server stays Tailscale-only on 8765, never bound to the LAN, never stopped. The refuse-to-bind-outside-100.64.0.0/10 check in `serve.py` is correct and should stay.
- AWS, DNS, and livingwords stay exactly as they are; live audio on S3 `nt4me2` stays with Kimberly, as the README already states.
- Mac mini doesn't reboot; Hermes stays on 9119 with Nous GLM 5.3 Flash as default. MartyNPC1's composer default stays.
- tower1 keeps `gpt-oss:120b` loaded; tower2 keeps work on `S:` and Ollama models on `E:\ollama\models`; nimo128 keeps serving Qwen 72B and Mark is not redone.
- Cursor stays the coding path. Nothing above replaces it.

## 4. Is an 8-bit 70B on vLLM across the 3080s the right next use?

**No — it fits, but it's the wrong next use of that box.** Three reasons:

1. **No headroom.** ~70 GB of weights in 80 GB of VRAM leaves roughly 1.2 GB per card for CUDA context, activations, and KV cache combined. vLLM's whole value is batched serving with a big KV cache; here you'd get batch-of-one and a short context. The "4-bit only fills about half" framing treats the empty half as waste — it isn't. At 4-bit, the leftover ~40 GB *is* the KV cache and concurrency. If a 70B experiment happens on this box at all, 4-bit will run visibly better than 8-bit.
2. **The interconnect.** Tensor parallelism across 8 cards does synchronized all-reduces every layer, per token. On PCIe gen 2 with no NVLink or P2P, that's the bottleneck — expect low single-digit tokens/sec. Also note 3080s are Ampere: no FP8, so "8-bit" means INT8/GPTQ-class quantization, whose vLLM kernels are the less-optimized path.
3. **It duplicates nimo128.** A local Qwen 72B already exists in the fleet. A second slow 70B-class endpoint adds little, while the eight-independent-workers shape (Whisper QC, Kokoro fragments, 8B models) adds things the repo actually needs and matches the hardware's real strengths.

So: finish the Kokoro queue, run the Whisper QC pass, stand up the backup and the manifest, and keep the 8×3080 as a batch farm. Treat the 8-bit 70B as an experiment to run once — measured, not assumed — only after the host gets RAM and NVMe, and with the 4-bit variant tested alongside it.
