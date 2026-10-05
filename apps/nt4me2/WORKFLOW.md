# nt4me2 workflow: fix, then independent QA

This is the workflow Kimberly and the fleet follow for the NT app (`ntapp`): the `nt4me2` player in this tree, the house player, and the NT chrome (menus, Settings, Beliefs, art rotation, audio selection). It also covers Academic and Religious art interpretation cards, and how a finished pair is installed on the house player.

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
| Interpretation cards | House player Academic and Religious modes for one named picture: Interpretation button green in both modes, card body loads, Beliefs filters still work, no AWS upload |

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

## Workflow: interpretation cards (Academic + Religious)

Run a card only for a painting Martin names, and only for the chapter he names. Do not run cards for a whole Bible book.

House share only, until Martin says AWS. This pipeline has no AWS upload step.

1. **Picture.** Save the picture under house interpret-weights (`I:\GrokBot\content\interpret-weights\`). The copy into the house-player pictures pool happens at install.
2. **Chapter draft.** If that chapter's draft is missing, run t2Research wrightstyle on tower2 / the house share. Drafts follow `I:\GrokBot\content\nt-wright-style\drafts\…`.
3. **Both cards.** freeInterpret writes the Academic card and the Religious card into `I:\GrokBot\content\interpret-weights\<slug>\`: the academic `.md`, the card-w040 Religious `.md`, the jpg, and a weights entry.
4. **Index.** Update `weights.json` on the interpret-weights folder (`I:\GrokBot\content\interpret-weights\weights.json`).
5. **Install.** Put the pair on the house player (see Install below) so Settings → Interpretation, Academic and Religious, can open the cards.

Recent named examples. These are examples, not an open queue:

| Painting | Chapter | Note |
| --- | --- | --- |
| Presentation Temple, Carpaccio | Luke 2 | |
| Stephen Consecrated, Carpaccio | Acts 6 | |
| Stoning Stephen, Carpaccio | Acts 7 | |
| Fall of Man, van der Goes | Genesis 3 | OT side job |
| John on Patmos, Bosch | Revelation 1 | |

## Install: house player (interpret + picture)

A finished card pair becomes live on the house player at `http://100.73.201.124:8765/house-player/?v=houseN`.

1. **Picture file.** Copy the display/source jpg into `I:\house-player\data\pictures\religious\` with a stable filename.
2. **Picture index.** Add an entry to `I:\house-player\data\pictures.json` under `albums.religious.images`. Fields: `file`, `src`, `title`, `artist`, `place`. Set `tradition` to `rc` only when Martin marks that picture RC.
3. **Interpretation indexes.** Create or update `I:\house-player\data\art\interpretations.json` (Academic) and `I:\house-player\data\art\religious-interpretations.json` (Religious). The key must equal the `file` name from `pictures.json`. Academic value: `{ "status": "approved", "card": "interpretations/<slug>.json" }`. Religious value: `{ "status": "approved", "card": "religious/<slug>-card.json" }`.
4. **Player JSON.** Convert the markdown cards into player JSON with the same fields as the existing academic mounts: `status`, `sources_header`, `body`, `citations`. `sources_header` is a list of strings. `body` is the card text; the player splits paragraphs on a blank line. Each citation may include `author`, `title`, `publication`, `date`, and `url`. Write the Academic card to `I:\house-player\data\art\interpretations\<slug>.json`. Write the Religious card to `I:\house-player\data\art\religious\<slug>-card.json`.
5. **Cache key.** Bump `?v=houseN` (`index.html` / `live.json` / `now-live.json`, as used) so a reload is not stale.
6. **QA.** CADev checks the install read-only before anyone tells Martin it is done. Same rule as **Always QA independently** above. Example pass criteria for the picture just installed: the Interpretation button is green in Academic mode and in Religious mode; the body loads; Beliefs filters still work; nothing was uploaded to AWS.
