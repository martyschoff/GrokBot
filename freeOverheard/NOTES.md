# freeOverheard notes

Staging notes for the Cursor offload. Skill bodies are **not** authored here and are **not** pulled from remote.

## Skill copies (Kimberly)

Kimberly will sync skill copies from **Grok Bot workflows**:

- `overheard`
- `overheard-setup`

Target paths in this tree:

- `freeOverheard/skills/overheard/SKILL.md`
- `freeOverheard/skills/overheard-setup/SKILL.md`

Until that sync lands, those files are absent on purpose. Do not invent skill text. Martin may paste skill bodies in a follow-up if Kimberly has not copied them yet.

## Ledgers (Kimberly)

Kimberly will sync ledgers from **`/workspace/overheard`** on the source machine into `freeOverheard/ledgers/`.

This checkout recreated two week files from Kimberly’s summaries only (dead days, no hits, X skipped client-not-enrolled, nights 8–11 `usage_limit` on the old bot). When the source ledgers are copied, replace these recreations rather than merging invented detail.

- `ledgers/ledger-2026-09-07.md`
- `ledgers/ledger-2026-09-12.md`

## Absolute facts (do not “research” past these)

- This directory is the Cursor Anthropic offload of Overheard.
- One job: night mention sweep + Sunday digest handoff to Kimberly.
- Watch list: Martin, Derek, Evan, Diane Schoffstall.
- Money-out: Cursor $200 only.
- Old Grok Overheard routines paused **12 Sep 2026**.
- Never invent hits.
- Never post social.
- Agent nickname: `freeoverheard` / `fo`.
- Cursor cloud agents default to Anthropic Haiku.
- Kimberly emails the weekly digests.
- X was skipped because the client was not enrolled. That is not a mention hit.
- Nights of 8–11 Sep 2026 on the old bot ended in `usage_limit`. Those nights are dead / no hits, not missing research.

## Do not

- Do not fetch skill text from the network, Grok, or another repo.
- Do not invent mention hits to fill empty ledgers.
- Do not resume paused Grok Overheard routines from this tree.
- Do not change unrelated apps under `apps/`.
