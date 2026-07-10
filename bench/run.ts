#!/usr/bin/env bun
/**
 * Benchmark runner — one model, one task, one shot.
 *
 * Usage:
 *   bun bench/run.ts --task T1 --model github-copilot/gpt-5
 *   bun bench/run.ts --task T2 --model github-copilot/claude-opus-4.5 --id 2026-07-10-t2-opus45-b
 *
 * What it does:
 *   1. copies base/ into a fresh temp dir (clean path — no repo context, no agent memory)
 *   2. seeds opencode.json there (permission allow + Playwright MCP) and git-inits a baseline
 *   3. runs `opencode run <frozen task prompt> --model <model> --format json`
 *   4. aggregates tokens/cost from step_finish events, measures wall-clock, computes diff stats
 *   5. copies the result into runs/<id>/ (without .git / harness config) and appends runs/index.json
 *
 * The full JSONL transcript is kept at runs/<id>.transcript.jsonl (outside the run
 * folder — the folder stays exactly what the model produced).
 *
 * After a run: play runs/<id>/index.html, then fill `smoke` and `review` in runs/index.json
 * (rubric in runs/README.md). Optionally drop a preview.gif into the run folder and set media.gif.
 */

import {
  mkdtempSync, mkdirSync, cpSync, rmSync, renameSync,
  existsSync, readFileSync, writeFileSync, appendFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { parseArgs } from "node:util";

const ROOT = join(import.meta.dir, "..");

const TASKS: Record<string, string> = {
  T1: "tasks/T1-gameify.md",
  T2: "tasks/T2-gameify-3d.md",
};

const { values: args } = parseArgs({
  options: {
    task: { type: "string" },
    model: { type: "string" },
    id: { type: "string" },
    variant: { type: "string" },
  },
});

const task = (args.task ?? "").toUpperCase();
const model = args.model ?? "";
if (!TASKS[task] || !model.includes("/")) {
  console.error(
    "Usage: bun bench/run.ts --task T1|T2 --model <provider/model> [--variant <effort>] [--id <run-id>]",
  );
  process.exit(1);
}

const taskFile = join(ROOT, TASKS[task]);
const prompt = readFileSync(taskFile, "utf8");
const taskVersion = Number(prompt.match(/\(v(\d+)\)/)?.[1] ?? 1);

const date = new Date().toISOString().slice(0, 10);
const modelSlug = model.split("/")[1].replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
const id = args.id ?? `${date}-${task.toLowerCase()}-${modelSlug}`;
if (!/^[a-z0-9][a-z0-9.-]*$/.test(id)) {
  console.error(`invalid run id "${id}" — lowercase letters, digits, dot, dash; must start alphanumeric`);
  process.exit(1);
}
const runDir = join(ROOT, "runs", id);
if (existsSync(runDir)) {
  console.error(`runs/${id} already exists — pass --id to disambiguate (e.g. …-${modelSlug}-b)`);
  process.exit(1);
}

// Fail fast on a broken ledger BEFORE spending tokens, and reserve the run id
// immediately so a concurrent identical run collides here, not after both paid.
const ledgerPath = join(ROOT, "runs", "index.json");
try {
  const parsed = JSON.parse(readFileSync(ledgerPath, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("ledger is not an array");
} catch (e) {
  console.error(`runs/index.json is missing or corrupt (${e}) — fix it before running.`);
  process.exit(1);
}
mkdirSync(runDir);
const abort = (code: number) => {
  rmSync(runDir, { recursive: true, force: true }); // release the reservation
  process.exit(code);
};

// ---------------------------------------------------------------- workspace
const work = mkdtempSync(join(tmpdir(), `sdc-bench-${id}-`));
cpSync(join(ROOT, "base"), work, { recursive: true });

// Harness config for the run: fully autonomous, Playwright MCP available.
// MCP version is pinned so every run gets the identical toolbox — bump it
// deliberately; it is recorded in the ledger. (opencode merges the global
// config on top of its defaults and this project config wins on conflicts —
// still, keep your global opencode config lean. See bench/README.md.)
const MCP_PLAYWRIGHT = "0.0.78";
writeFileSync(
  join(work, "opencode.json"),
  JSON.stringify(
    {
      $schema: "https://opencode.ai/config.json",
      permission: "allow",
      mcp: {
        playwright: {
          type: "local",
          command: ["npx", "-y", `@playwright/mcp@${MCP_PLAYWRIGHT}`],
          enabled: true,
        },
      },
    },
    null,
    2,
  ) + "\n",
);

const git = (cmd: string[]) =>
  Bun.spawnSync(
    ["git", "-C", work, "-c", "user.email=bench@local", "-c", "user.name=bench", ...cmd],
    { stdout: "pipe", stderr: "pipe" },
  );
git(["init", "-q"]);
git(["add", "-A"]);
const baseline = git(["commit", "-qm", "base"]);
if (baseline.exitCode !== 0) {
  console.error("✗ could not create the baseline git commit in the workdir — aborting before");
  console.error("  spending tokens:\n" + baseline.stderr.toString());
  abort(1);
}

// Pre-warm the pinned MCP (npx download + browser install) so a cold cache is
// not billed to the first model's wall-clock.
console.log("  pre-warming @playwright/mcp…");
Bun.spawnSync(["npx", "-y", `@playwright/mcp@${MCP_PLAYWRIGHT}`, "--version"], {
  stdout: "pipe",
  stderr: "pipe",
});

const versionProc = Bun.spawnSync(["opencode", "--version"], { stdout: "pipe" });
const harnessVersion = versionProc.stdout?.toString().trim() ?? "unknown";

// Tripwire: opencode resolves its project directory on its own (we pass --dir,
// but belt & suspenders) — snapshot the bench repo's status so we can detect a
// run that leaked outside its workdir.
const repoStatus = () =>
  Bun.spawnSync(["git", "-C", ROOT, "status", "--porcelain"], { stdout: "pipe" }).stdout.toString();
const repoStatusBefore = repoStatus();

// ---------------------------------------------------------------- the run
console.log(`▶ run ${id}`);
console.log(`  task    ${TASKS[task]} (v${taskVersion})`);
console.log(`  model   ${model}`);
console.log(`  harness opencode ${harnessVersion}`);
console.log(`  workdir ${work}\n`);

const transcriptPath = join(ROOT, "runs", `${id}.transcript.jsonl`);
writeFileSync(transcriptPath, "");

const t0 = Date.now();
// --dir is what actually pins opencode's project directory (spawn cwd alone is
// NOT respected — learned the hard way); PWD is overridden for the same reason.
const proc = Bun.spawn(
  [
    "opencode", "run", prompt,
    "--model", model,
    "--format", "json",
    "--dir", work,
    ...(args.variant ? ["--variant", args.variant] : []),
  ],
  {
    cwd: work,
    env: { ...process.env, PWD: work },
    stdout: "pipe",
    stderr: "inherit",
  },
);

const tokens = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 };
let cost = 0;
let costSeen = false;
let turns = 0;

const decoder = new TextDecoder();
let buf = "";
for await (const chunk of proc.stdout) {
  buf += decoder.decode(chunk, { stream: true });
  const lines = buf.split("\n");
  buf = lines.pop() ?? "";
  for (const line of lines) {
    if (!line.trim()) continue;
    appendFileSync(transcriptPath, line + "\n");
    let ev: any;
    try {
      ev = JSON.parse(line);
    } catch {
      continue; // non-JSON noise on stdout
    }
    if (ev.type === "step_finish" && ev.part) {
      turns++;
      const t = ev.part.tokens ?? {};
      tokens.input += t.input ?? 0;
      tokens.output += t.output ?? 0;
      tokens.reasoning += t.reasoning ?? 0;
      tokens.cacheRead += t.cache?.read ?? 0;
      tokens.cacheWrite += t.cache?.write ?? 0;
      if (typeof ev.part.cost === "number") {
        cost += ev.part.cost;
        costSeen = true;
      }
      process.stdout.write(
        `  step ${turns} (${ev.part.reason ?? "?"}) — in ${tokens.input} out ${tokens.output}\n`,
      );
    }
  }
}
const exitCode = await proc.exited;
const durationSeconds = Math.round((Date.now() - t0) / 1000);
if (exitCode !== 0) {
  console.error(`\n✗ opencode exited with ${exitCode} after ${durationSeconds}s — nothing recorded.`);
  console.error(`  workdir kept for inspection: ${work}`);
  console.error(`  transcript: ${transcriptPath}`);
  abort(exitCode);
}

// ---------------------------------------------------------------- sanity guards
// New/changed paths under runs/ are benign (concurrent runs publishing, the user
// filling in reviews mid-run) — only changes OUTSIDE runs/ mean a leak.
const statusBefore = new Set(repoStatusBefore.split("\n").filter(Boolean));
const leaked = repoStatus()
  .split("\n")
  .filter(Boolean)
  .filter((line) => !statusBefore.has(line))
  .flatMap((line) => line.slice(3).split(" -> "))
  .filter((p) => !p.replace(/^"|"$/g, "").startsWith("runs/"));
if (leaked.length > 0) {
  console.error("\n✗ the bench repo itself changed during the run — the harness leaked outside");
  console.error(`  its workdir. Unexpected changes: ${leaked.join(", ")}`);
  console.error("  Nothing recorded; inspect `git status` here and the workdir:");
  console.error(`  workdir ${work}\n  transcript ${transcriptPath}`);
  abort(1);
}

// ---------------------------------------------------------------- diff stats
git(["add", "-A"]);
const shortstat = git(["diff", "--cached", "--shortstat", "HEAD"]).stdout.toString();
const nameStatus = git(["diff", "--cached", "--name-status", "HEAD"]).stdout.toString();
const num = (re: RegExp) => Number(shortstat.match(re)?.[1] ?? 0);
const diff = {
  filesChanged: num(/(\d+) files? changed/),
  insertions: num(/(\d+) insertions?/),
  deletions: num(/(\d+) deletions?/),
  newFiles: nameStatus.split("\n").filter((l) => l.startsWith("A")).length,
};

if (diff.filesChanged === 0 && diff.newFiles === 0) {
  console.error("\n✗ the workdir is untouched — the model changed nothing (a valid run always");
  console.error("  at least writes RESULT.md). Nothing recorded; inspect:");
  console.error(`  workdir ${work}\n  transcript ${transcriptPath}`);
  abort(1);
}
if (!existsSync(join(work, "RESULT.md"))) {
  console.warn("\n⚠ RESULT.md missing — the model skipped the required write-up (recorded anyway).");
}
const hasEntryPoint = existsSync(join(work, "index.html"));
if (!hasEntryPoint) {
  console.warn("\n⚠ no index.html in the output — the dashboard's Play button will 404 (noted in smoke).");
}

// ---------------------------------------------------------------- publish
rmSync(join(work, ".git"), { recursive: true, force: true });
rmSync(join(work, "opencode.json"), { force: true });
// prune heavy tool droppings at any depth (the game itself must be zero-dep)
Bun.spawnSync([
  "find", work, "-type", "d",
  "(", "-name", "node_modules", "-o", "-name", ".cache", "-o", "-name", ".playwright*", ")",
  "-prune", "-exec", "rm", "-rf", "{}", "+",
]);
cpSync(work, runDir, { recursive: true });
rmSync(work, { recursive: true, force: true });

const sizeKb = Number(
  Bun.spawnSync(["du", "-sk", runDir], { stdout: "pipe" }).stdout.toString().split("\t")[0] || 0,
);
if (sizeKb > 20_480) {
  console.warn(`⚠ published run folder is ${Math.round(sizeKb / 1024)}MB — check for stray artifacts.`);
}

// Re-read right before appending (another run may have finished meanwhile),
// then write via tmp+rename so a crash can't leave a half-written ledger.
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
ledger.push({
  id,
  date,
  task,
  taskVersion,
  base: "base-v1",
  harness: {
    name: "opencode",
    version: harnessVersion,
    provider: model.split("/")[0],
    variant: args.variant ?? null,
    mcpPlaywright: MCP_PLAYWRIGHT,
  },
  model,
  metrics: {
    durationSeconds,
    turns,
    tokens: {
      input: tokens.input,
      output: tokens.output,
      reasoning: tokens.reasoning || null,
      cacheRead: tokens.cacheRead || null,
      cacheWrite: tokens.cacheWrite || null,
    },
    costUsd: costSeen ? Number(cost.toFixed(4)) : null,
  },
  diff,
  smoke: {
    loads: null,
    consoleErrors: null,
    notes: hasEntryPoint ? "" : "no index.html entry point — Play link is dead",
  },
  review: { firstTry: null, playability: null, creativity: null, visual: null, taskFit: null, notes: "" },
  media: { gif: null },
});
writeFileSync(ledgerPath + ".tmp", JSON.stringify(ledger, null, 2) + "\n");
renameSync(ledgerPath + ".tmp", ledgerPath);

console.log(`\n✓ ${id} — ${durationSeconds}s, ${turns} steps, ` +
  `${tokens.input + tokens.output} tokens (${tokens.input} in / ${tokens.output} out)` +
  (costSeen && cost > 0 ? `, $${cost.toFixed(2)}` : ""));
console.log(`  play    runs/${id}/index.html  (serve the repo root over HTTP)`);
console.log(`  result  runs/${id}/RESULT.md`);
console.log(`  next    fill smoke + review for "${id}" in runs/index.json (rubric: runs/README.md)`);
