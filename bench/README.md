# Bench — protocol & runner

## The protocol

- **One shot.** One `opencode run` invocation with the frozen task prompt. No
  follow-up messages, no human answers, no retries. The model may iterate as much
  as it wants *within* the invocation (including checking its work in a browser).
- **Frozen inputs.** Prompt = `tasks/<task>.md` verbatim (versioned in its H1);
  starting code = `base/` (tag `base-v1`). Change either → bump the version, and
  don't compare across versions.
- **Fixed toolbox.** Every run gets the same harness config, seeded by the runner:
  `permission: "allow"` (fully autonomous) + Playwright MCP (`npx @playwright/mcp`),
  so every model *can* look at its own game. No budget cap, no timeout — appetite
  is a result, not a constraint.
- **Clean room.** The run happens in a fresh temp dir containing only the base
  game — the model never sees the tasks, other runs, or the dashboard.
- **Harness-reported metrics only.** Tokens/cost/turns come from the opencode
  `--format json` stream (`step_finish` events), duration from the runner's clock.
  Nothing the model self-reports is treated as a metric.

## Running

```sh
# prerequisites: bun, opencode (auth: `opencode` → /connect → GitHub Copilot)
opencode models github-copilot          # list available model ids
bun bench/run.ts --task T1 --model github-copilot/gpt-5
```

Then serve the repo root (`bun bench/serve.ts` — sends the CORS headers the
sandboxed dashboard iframe needs), play `runs/<id>/index.html`,
and fill `smoke` + `review` for the run in `runs/index.json` — rubric in
[`runs/README.md`](../runs/README.md). Optionally record a short `preview.gif`
into the run folder and set `media.gif`.

The full event transcript is kept at `runs/<id>.transcript.jsonl` (gitignore it or
commit it — it's useful for audits but large).

## Fairness notes / known caveats

- **opencode merges your global config** (`~/.config/opencode/opencode.json`) into
  every run; the seeded project config wins on conflicts, but extra global MCP
  servers/agents would leak into the toolbox. Keep the global config lean, or at
  least identical across all runs you intend to compare.
- **Copilot is a middleman.** Same subscription pool for every model = internally
  consistent comparisons, but: billing is premium-request quota (so `costUsd` is
  usually `null` — token counts still come from the stream), models may be
  context-capped or system-prompted differently than on their native APIs, and
  brand-new models often land on Copilot later than on native harnesses. Treat
  results as "model as served by Copilot", and note the harness/provider fields in
  the ledger — a native-API run of the same model is a different row, not the same.
- **One harness on purpose.** Everything runs through opencode so harness quality
  is held constant and only the model varies. Don't wrap runs in another agent
  layer (T3 Code etc.) — it adds a second, unversioned variable and hides usage.
