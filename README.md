# GrokBot

App sources for Martin's Grok Bot projects. App trees live under `apps/<app>/`.

Initial seed includes live `nt4me2` player source under `apps/nt4me2/`.

## Workflow

Fixes to the NT app (the `nt4me2` player, the house player, and the NT chrome) are not done until CADev has independently QA'd them. See [`apps/nt4me2/WORKFLOW.md`](apps/nt4me2/WORKFLOW.md).

That file also holds the LOCKED standing rules for DESKTOP-TJ1RMNK (8×3080): Kimberly owns model loads and the harness (Whisper on GPU 0, seven Kokoro workers on GPUs 1–7, remake bats); Qmanager reports status and copies packs only; status comes from the LAN `:8767` page, a short on-machine `status.json`, or one ~20s Shell; reconnect the Grok Bot desktop app after reboot before harness work.
