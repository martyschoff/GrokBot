# nt4me2 workflow: fix, then independent QA

This is the workflow Kimberly and the fleet follow for the NT app (`ntapp`): the `nt4me2` player in this tree, the house player, and the NT chrome (menus, Settings, Beliefs, art rotation, audio selection).

NT Kokoro on the 8×3080 follows the LOCKED standing rules in the next section.

## LOCKED — 8×3080 standing rules (DESKTOP-TJ1RMNK)

Martin confirmed the partition on 5 Oct 2026. The three rules below are locked standing rules for this machine. They stay in force until Martin changes them.

**Machine:** DESKTOP-TJ1RMNK (8× RTX 3080 10 GB). Tailscale is typically `100.124.236.23`.

### 1. Kimberly owns models and the harness

Kimberly loads models and changes the harness.

**Standing harness:**

- **GPU 0** — Whisper voice server.
- **GPUs 1–7** — **seven** Kokoro workers (one chapter / one job per GPU; data parallel). Not Ollama layer-split for this lane.
- When Kimberly sets or changes that harness, she **remakes the bats**.

**Qmanager (Q)** reports status and copies packs only. Qmanager does not start or stop GPU workers, load models, or change the harness layout.

**Exception (only when Martin says):** stop Whisper and use all eight GPUs for a vLLM / Llama tensor-parallel run. Otherwise do not steal cards 1–7 from Kokoro while the NT batch is the standing job.

Keep NT Kokoro going on GPUs 1–7 until Martin says suspend. On suspend, finish only a reasonable chapter/book mark, then hold until the following Saturday.

### 2. How to read status (Cursor Shell on TJ1RMNK hangs)

Cursor Shell on TJ1RMNK often hangs. Do not rely on a long Shell for status.

Prefer one of these:

- **(a) LAN status page.** The local Whisper/Kokoro status page on the LAN at port **8767** (on the machine, or `http://100.124.236.23:8767` over Tailscale). It reports Whisper, Kokoro workers, and GPU use. `nimo serverstatus` asks that page, not only Ollama on 11434.
- **(b) `status.json` on the machine.** When a brief Shell works, read the short `status.json` it writes on the machine.
- **(c) One capped Shell.** One Shell capped at about **20 seconds**, killed if it hangs.

Do not take GPU numbers from Ollama or llama. `martynpc1-coder` `/api/generate` cannot run `nvidia-smi`. Figures that call returns are invented, not a measurement.

### 3. After reboot, reconnect Grok Bot before harness work

The Grok Bot desktop app may not auto-start after a reboot. Reconnect Grok Bot on DESKTOP-TJ1RMNK before any harness work (loading models, remaking bats, or changing which GPU runs Whisper or Kokoro).

## Rule

**Always QA independently.** After any code or content fix, a different agent verifies it before anyone treats it as done. For ntapp that agent is **CADev**.

- The fixer does not self-declare done. "Fixed" means "ready for QA", not "shipped".
- CADev runs the check against the build the fixer names (for example the house player at `?v=houseN`, or a PR branch).
- Only after CADev reports PASS does the fixer (or Kimberly) tell Martin it is done.

## Steps

1. **Fix.** Whoever has the job makes the change. That can be a local coder on the coding ladder, CADev on a PR, Ritchie, or Kimberly for content (art tags, `pictures.json`, audio files).
2. **Bump the cache key.** Change the `?v=` string (`index.html` here, `?v=houseN` on the house player) so QA cannot pick up a stale copy.
3. **Hand off to CADev.** Send:
   - what changed (files, or the content entries touched)
   - the exact URL or branch to test (`?v=` included)
   - pass criteria, written as checks CADev can run (for example "Beliefs = evangelical: neither Coronation is in the eligible pool")
   - anything out of scope (for example "AWS untouched; do not check AWS")
4. **CADev QAs.** Read-only. CADev does not edit files while doing QA. The report gives PASS or FAIL for each criterion, the evidence (paths, pool dumps, screenshots), and the root cause plus a fix hint for anything that fails.
5. **On FAIL:** the fixer fixes it, bumps `?v=` again, and returns to step 3. Repeat until every criterion passes.
6. **On PASS:** report done to Martin with CADev's verdict. Content goes to AWS only when Martin asks, and Kimberly does that step.

## What CADev covers

| Area | Examples |
| --- | --- |
| House player | Settings toggles (tracks that should skip when a toggle is off), Beliefs filter (`tradition: rc` art pool on load and on a mid-session switch), art rotation, audio picks |
| NT chrome (`apps/nt4me2/`) | Menu, Settings, Beliefs, Interpretation, book/chapter picker, Back/Next, Art Interpretation |
| Content fixes | `pictures.json` tags, art filenames, chapter JSON, audio file mapping |

## CADev's coding role is unchanged

QA is an added duty. CADev's place on the coding ladder stays as it was:

- Coding ladder: local first (nimoCoder / 64upCoder / 48coder) → **CADev** → Ritchie. Martin can override by telling Kim `local first`, `cadev`, or `ritchie`.
- Models: Anthropic only. The default is the cheapest Haiku, Sonnet when there is a clear reason, and Opus only with Martin's written request. Money-out rule: subscription allotments only, never on-demand.
- Repo: `github.com/martyschoff/GrokBot`. **PRs only.** CADev never merges, deploys, or pushes to `main`.
- Each job ends with a completion report and an update to the sheet.

A single change never has the same agent as both fixer and QA. If CADev wrote the fix, a different agent does the independent QA. The default fallback is Ritchie, unless Martin names someone else.

## Repo hygiene

- Work goes on a feature branch and gets a PR into `main`. No direct commits to `main` and no force-push.
- This workflow never touches AWS.
