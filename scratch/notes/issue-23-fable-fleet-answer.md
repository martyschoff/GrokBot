# Fable's revised answer to issue #23 — full fleet, 4 Oct 2026 survey

Revised against the live read-only survey posted as a comment on <https://github.com/martyschoff/GrokBot/issues/23> (4 Oct 2026, ~6:50 PM ET), which replaces the short machine list in the issue body. This file supersedes the first version of this note. Tower3 facts come only from the 3 Oct block (it was offline at the survey); WIN-DL8TC2NPBCM was not surveyed, so nothing below concerns it. **Nothing in this note should be applied by anyone until Martin has discussed it.** Posted as a note in PR #24 because the agent's GitHub token still cannot comment on issues.

What the full survey corrects in my first answer: 3080a has a 3.7 TB D: with ~3.6 TB free, so weight/work storage there is not a weakness; tower2 carries an RTX 4080 SUPER and has ample free disk; nimo128 is a Ryzen AI MAX+ 395 with Radeon 8060S and 64 GB (no NVIDIA card), so Qwen 72B there is CPU/iGPU inference, not CUDA; upthread64 exists (second Threadripper 3960X, 3060 Ti + RX 580); the Mac mini is an M4 Pro with 48 GB and 20 GPU cores; MartyNPC1 is a Snapdragon Surface with no local Llama and Ollama banned.

## 1. What is actually weak (given Cursor already does the coding)

**The 3080a host is still the mismatch, but the list shrinks to CPU, RAM, and PCIe.** Four cores and 16 GB feeding eight 3080s remains the ceiling, and the two GEIL sticks are rated DDR4-3200 CL16 but run at 2133 — XMP appears off, on a BIOS from April 2020. Enabling XMP (or a RAM upgrade) is the cheapest meaningful improvement to that box, but any BIOS change is a machine change, so it is a discussion item for Martin, not an action. Disk is no longer on the weak list there.

**The near-full drives moved to tower1 and upthread64, and they are the fleet's most likely near-term failure.** tower1 shows C: 36 GB, D: 37 GB, E: 38 GB free; upthread64 shows C: 30 GB, G: 52 GB of 7452, H: 76 GB, I: 39 GB free. Nearly-full Windows C: drives break updates and temp-heavy jobs. Meanwhile mlsfs sits on roughly 78 TB free (I: 62.5 TB, S: 11 TB, E: 4.6 TB) and nimo128 has a nearly empty 32 TB D:. The fleet's storage is inverted: the two 24-core Threadrippers are packed, the archive machines are empty.

**Finished NT audio still has one copy.** The mp3s land in `I:\house-disk-audio\nt\audio\` on mlsfs and exist nowhere else locally (I: is otherwise essentially empty). This remains the biggest risk to the thing all the GPU time is producing. The survey makes the fix easier than before: 3080a's D: (3.6 TB free) or tower2's S:/G: are natural second copies on *different* machines; mlsfs's own S: would be a weaker same-machine mirror.

**Memory clocks are low fleet-wide.** 3080a, tower2 (96 GB), upthread64 (mixed 3200/3600-rated sticks), and tower3 all run DDR4 at 2133. For CPU-side inference and data shuffling that is real bandwidth left on the table; tower1 at DDR4-3600 shows what the platform can do. Same caveat: BIOS changes are Martin's call.

**Repo-side gaps are unchanged from the first note.** No machine-checkable manifest against the `apps/nt4me2` sew-path convention (book × chapter × {kjv,bsb} × {greekon,greekoff} × {british,american} plus fragments); `serve.py` on the `house-disk-audio` branch advertises `Range` in CORS but `SimpleHTTPRequestHandler` never serves byte ranges, and its default `--root I:\` exposes the whole share to the tailnet; and there is no heartbeat for the must-stay-up ports, of which the survey now lists four — Whisper 8080, house audio 8765, Hermes 9119, FreeToken 1919 — plus the loaded `gpt-oss:120b` on tower1.

**Minor:** upthread64's RX 580 contributes nothing to this workload; its usable part is the 3060 Ti (8 GB). MartyNPC1 is correctly out of the inference picture.

## 2. What I would change after the New Testament audio finishes (for discussion, not application)

**Whisper QC pass first.** The queue is nearly done (one file rendering at survey time, 1 John 5 American). Once it finishes, point batch Whisper at GPUs 1–7, transcribe every finished mp3 in `I:\house-disk-audio\nt\audio\`, and diff against the Berean/KJV source text. The player's "no stub, no substitute" rules assume existing files are right; this verifies it at scale before Kimberly wires `live.json`.

**Second copy of the finished audio**, per §1 — a scheduled one-way copy from mlsfs I: to 3080a D: or a tower2 volume.

**Rebalance storage.** Move cold/archive data off tower1's and upthread64's full volumes onto mlsfs (I: or S:) or nimo128's 32 TB D: over the tailnet. This un-cramps the two 24-core/48-thread Threadrippers, which are the fleet's best CPU workers and currently its most disk-starved machines.

**Keep the 8×3080 as eight independent single-GPU workers.** PCIe gen 2 with no NVLink punishes anything that needs inter-GPU traffic and nothing that doesn't. Independent Kokoro batches (the fragment matrix still has empty exegete / OT-ref / Westminster / CCC slots), Whisper QC, embeddings, or an 8B-class model per GPU all fit 10 GB cards perfectly.

**If Hermes needs a local model endpoint, the full survey changes the best answer.** tower2's RTX 4080 SUPER (16 GB) is now clearly the best inference GPU in the fleet and is otherwise lightly used — a fast 8–14B class model there serves Hermes well, coexisting with FreeToken and the S:/E: layout. The Mac mini M4 Pro (48 GB unified, 20 GPU cores) comfortably runs ~30B-class quantized models via MLX/llama.cpp if Martin prefers Hermes's model on Hermes's own machine. Tower3 (one 3080, offline at survey) drops to spare.

**Manifest and heartbeat**, as in the first note: a checked-in expected-file manifest plus a tiny tailnet status check (mlsfs pinging the four service ports and writing one line).

## 3. What I would not change

- GPU 0 stays on Whisper; the Kokoro queue runs untouched to completion; no second job on GPUs 1–7 until it is done.
- The mlsfs house audio server stays Tailscale-only on 8765, never bound to the LAN, never stopped; `serve.py`'s refuse-to-bind-outside-100.64.0.0/10 check stays.
- AWS, DNS, and livingwords stay as they are; live audio on S3 `nt4me2` stays with Kimberly.
- Mac mini does not reboot (FileVault); Hermes stays on 9119 with Nous GLM 5.3 Flash as default. MartyNPC1 keeps no local Llama and never runs Ollama.
- tower1 keeps `gpt-oss:120b` loaded; tower2 keeps work files on `S:\GrokBot` / `S:\Hermes`, Ollama models on `E:\ollama\models`, nothing on C:, and FreeToken on 1919.
- nimo128 keeps its local Qwen 72B; Mark's Greek-on redo is done and is not redone.
- Cursor stays the coding path; nothing above replaces it.
- No machine is changed from the survey itself, and no recommendation here is applied until Martin discusses it. Nothing is said about WIN-DL8TC2NPBCM.

## 4. Is an 8-bit 70B on vLLM across the 3080s the right next use?

**Still no — with one correction and one strengthened alternative.**

The correction: storage is no longer an objection. D: on 3080a holds 70 GB of weights many times over. The remaining objections stand and are decisive:

1. **No headroom.** ~70 GB of weights in 80 GB of VRAM leaves ~1.2 GB per card for CUDA context, activations, and KV cache. vLLM's value is batched serving with a large KV cache; this configuration gets batch-of-one and a short context. At 4-bit the leftover ~40 GB *becomes* KV cache and concurrency — "only fills half" is the feature, not the flaw.
2. **The interconnect.** Tensor parallelism across eight cards does synchronized all-reduces every layer, per token, over PCIe gen 2 with no NVLink or P2P: expect low single-digit tokens/sec. And 3080s are Ampere — no FP8 — so "8-bit" means INT8/GPTQ-class quantization on vLLM's less-optimized kernels.
3. **The host.** Four cores and 16 GB at 2133 is below vLLM's comfort for an engine managing eight workers.

The strengthened alternative: the full fleet shows better homes for 70B-class work than TP=8 on this box. nimo128 (64 GB, Ryzen AI MAX+ 395) already runs Qwen 72B — slower CPU/iGPU inference, but standing. If a faster NVIDIA-backed 70B is wanted, tower1 — 128 GB of DDR4-3600 plus two 3080s — would run a 4-bit 70B with partial GPU offload (llama.cpp/Ollama) likely as well as or better than 8-bit TP=8 over gen-2 risers, though it must coexist with the locked `gpt-oss:120b`, which makes it a scheduling question for Martin rather than a recommendation.

So the shape I'd argue for: finish the queue, run the Whisper QC pass, stand up the second copy, the manifest, and the heartbeat, rebalance the full disks toward mlsfs/nimo128, and keep the 8×3080 as a batch farm of eight independent workers. Treat the 8-bit 70B as a one-off measured experiment — 4-bit tested alongside it — only after the host question (RAM, and XMP if Martin approves BIOS changes) is settled, and only after Martin has discussed all of the above.
