# Self-Driving Car Bench

A **visual, playable benchmark for AI coding models**. Every model gets the same
tiny vanilla-JS game — a self-driving-car neural-network demo — and the same frozen
task prompt, in one shot, with no follow-ups. Whatever it ships is committed here
as-is and playable in the browser.

**Gallery:** the dashboard at the repo root (GitHub Pages) — every run is a card:
tokens, wall-clock, cost, diff size, and human review scores, with the model's
game embedded. The original demo lives at [`base/`](base/).

## Layout

| Path | What |
|---|---|
| [`base/`](base/) | the frozen starting game (tag `base-v1`) — never edited |
| [`tasks/`](tasks/) | frozen task prompts: T1 game-ify (2D) · T2 game-ify in 3D |
| [`runs/`](runs/) | one folder per run = the model's playable output; `index.json` ledger + rubric |
| [`bench/`](bench/) | protocol, fairness notes, and the runner (`bun bench/run.ts`) |
| `index.html` | the gallery dashboard |

## Running a benchmark

Prerequisites: [bun](https://bun.sh), [opencode](https://opencode.ai) authenticated
with a provider (`opencode` → `/connect` → e.g. GitHub Copilot).

```sh
# what models does the pool offer?
opencode models                          # all providers
opencode models github-copilot           # Copilot pool only

# one run = one task × one model, one shot
bun bench/run.ts --task T1 --model github-copilot/gpt-5.4
bun bench/run.ts --task T2 --model github-copilot/claude-opus-4.8

# optional: provider-specific reasoning effort (recorded in the ledger)
bun bench/run.ts --task T1 --model github-copilot/gpt-5.4 --variant high

# same model+task again on the same day? disambiguate the run id
bun bench/run.ts --task T1 --model github-copilot/gpt-5.4 --id 2026-07-10-t1-gpt-5.4-b
```

The runner copies `base/` into a fresh temp dir, runs opencode there (`--dir`
pins it), and publishes the output to `runs/<id>/` + appends `runs/index.json`.
It refuses to record a run that touched nothing or leaked outside its workdir.

**After each run — the review loop:**

```sh
bun bench/serve.ts                # serve the repo root (fetch needs HTTP; adds the
                                  # CORS headers sandboxed ES-module games require)
```

1. Open `http://localhost:8000/` → the run's card → **▶ Play**, and actually play it.
2. Check the browser console while playing; note errors.
3. Fill the run's `smoke` and `review` blocks in `runs/index.json` — scoring
   anchors live in [`runs/README.md`](runs/README.md). `firstTry: true` only if
   you fixed nothing by hand.
4. Optionally record a short `preview.gif` into `runs/<id>/` and set `media.gif`.
5. Read the model's `RESULT.md` and compare its claims with what you played —
   over-claiming is worth a note in `review.notes`.

## Method, in one breath

Fresh temp dir with only the base game → `opencode run` with the frozen prompt
(`--model github-copilot/…`, permissions open, Playwright available, no budget
cap) → tokens/cost/turns harvested from the harness JSON stream → output committed
to `runs/<id>/` → I play it and score it against a fixed rubric.

Metrics are harness-reported; scores are human. Details in
[`bench/README.md`](bench/README.md).

---

Base game derived from [Radu Mariescu-Istodor's self-driving car
tutorial](https://www.youtube.com/watch?v=Rs_rAxEsAvI) (vanilla JS, no libraries).
