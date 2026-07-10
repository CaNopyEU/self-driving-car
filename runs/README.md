# Runs — ledger & rubric

Each benchmark run lives in `runs/<id>/` (a complete, statically servable copy of
the model's output — `runs/<id>/index.html` is the playable result, plus the
model's `RESULT.md`). The machine-readable ledger is **`runs/index.json`**: an
array with one entry per run, appended by `bench/run.ts` and consumed by the
dashboard at the repo root.

## Run id

`<YYYY-MM-DD>-<task>-<model-slug>` — e.g. `2026-07-10-t1-gpt-5`. Also the folder name.

## Ledger entry schema

```jsonc
{
  "id": "2026-07-10-t1-gpt-5",
  "date": "2026-07-10",
  "task": "T1",                          // T1 | T2 (historic runs may carry retired tasks, e.g. T3)
  "taskVersion": 1,                      // version header inside tasks/<task>.md
  "base": "base-v1",                     // git tag of the frozen base snapshot
  "harness": {
    "name": "opencode",
    "version": "…",                      // opencode --version
    "provider": "github-copilot"
  },
  "model": "github-copilot/gpt-5",       // exact model id passed to the harness
  "metrics": {                           // harness-reported, never model self-report
    "durationSeconds": 0,
    "turns": null,
    "tokens": { "input": 0, "output": 0, "reasoning": null, "cacheRead": null, "cacheWrite": null },
    "costUsd": null                      // null when the provider doesn't bill per token (Copilot)
  },
  "diff": {                              // vs the base snapshot, computed by the runner
    "filesChanged": 0, "insertions": 0, "deletions": 0, "newFiles": 0
  },
  "smoke": {                             // automated post-run check (Playwright)
    "loads": null,                       // page loads and a canvas/scene renders
    "consoleErrors": 0,
    "notes": ""
  },
  "review": {                            // filled in by hand after playing — see rubric
    "firstTry": null,                    // worked out of the box, no touch-ups (true/false)
    "playability": null,
    "creativity": null,
    "visual": null,
    "taskFit": null,
    "notes": ""
  },
  "media": { "gif": null }               // optional "preview.gif" inside the run folder
}
```

`null` = not yet measured/reviewed. The dashboard derives the play URL
(`runs/<id>/index.html`) and RESULT.md link from `id`.

**Token semantics:** `tokens.*` are **billed** tokens summed across all opencode
`step_finish` events (verified per-step deltas, not cumulative). `input` therefore
counts the context re-sent on every agent turn — it measures what the run consumed,
not the conversation size. `costUsd: null` means the provider reported no cost
(Copilot bills premium requests, not tokens); a genuine free run records `0`.

## Rubric (manual review, 1–5)

Score after actually playing it. Fixed anchors so runs stay comparable months apart:

| Score | Playability | Creativity | Visual | Task fit |
|---|---|---|---|---|
| 1 | broken / unplayable | copied the brief literally, nothing more | untouched or worse | ignored requirements |
| 2 | runs but no fun | one small own idea | minor cosmetics | several requirements missing |
| 3 | playable, holds attention a few minutes | solid ideas within the brief | clearly improved | requirements met |
| 4 | genuinely fun, would replay | a surprising mechanic that works | polished, coherent style | met + meaningfully extended |
| 5 | I forgot I was evaluating | an idea I'd never have suggested | ship-it beautiful | nailed the spirit, not just the letter |

`firstTry` is separate and binary: `true` only if the game **actually functioned on
first launch** — it loads *and* is genuinely playable, with zero manual fixes. A game
that loads but is unplayable (broken controls, missing rendering…) is `firstTry:
false` even if you never touched it; describe the symptoms in `review.notes`. If you
did fix something by hand to evaluate it, that's also `firstTry: false`, with the fix
described — the fixed version may still be scored and kept playable.
