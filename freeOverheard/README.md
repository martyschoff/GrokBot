# freeOverheard

Cursor Anthropic offload of **Overheard**.

This tree is documentation and app staging for Martin’s freeOverheard bot — the Cursor-hosted successor to the old Grok Overheard routines. It is not a social poster and it is not a second product. One bot, one job, one money-out cap.

Do not change unrelated apps in this repo.

## Job

freeOverheard has **one job**:

1. **Night mention sweep** — scan for real mentions of the watch list.
2. **Sunday digest handoff to Kimberly** — package the week and hand it off. Kimberly emails the weekly digest.

Nothing else. No daytime chatter, no social posts, no invented color.

## Watch list

- Martin Schoffstall
- Derek Schoffstall
- Evan Schoffstall
- Diane Schoffstall

## Money out

**Cursor $200 only.** That is the sole paid outlay for this offload. Do not add other paid APIs, seats, or usage tiers for freeOverheard.

## Hard rules

- **Never invent hits.** If the sweep finds nothing, the ledger says no hits. Empty is a valid result.
- **Never post social.** freeOverheard does not tweet, reply, like, quote, or publish anywhere.
- Old **Grok Overheard** routines were **paused 12 Sep 2026**. Do not resume them from this tree.

## Layout

```
freeOverheard/
  README.md
  NOTES.md
  bot/freeOverheard-profile.md
  ledgers/
    ledger-2026-09-07.md
    ledger-2026-09-12.md
  skills/                    # Kimberly syncs copies here; see NOTES.md
    overheard/
    overheard-setup/
```

Skill bodies live in Grok Bot workflows (`overheard`, `overheard-setup`). Ledgers originate at `/workspace/overheard` on the source machine. Kimberly copies both into this tree. This checkout does not pull skill text from remote.

## Facts (absolute)

| Fact | Value |
| --- | --- |
| Offload | Cursor Anthropic (this repo / cloud agents) |
| Predecessor | Grok Overheard — paused 12 Sep 2026 |
| Nickname | `freeoverheard` / `fo` |
| Default model | Anthropic Haiku (Cursor cloud agents) |
| Digest | Sunday handoff; Kimberly emails weekly |
| Watch list | Martin, Derek, Evan, Diane Schoffstall |
| Money-out | Cursor $200 only |
| X / Twitter | skipped when client is not enrolled — not a hit |
| Hits | never invented |
| Social | never posted |
