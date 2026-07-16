#!/usr/bin/env bun
/**
 * Static server for the bench. Use this instead of `python3 -m http.server`:
 * the dashboard embeds runs in a sandboxed iframe (opaque origin), and ES-module
 * games load only when the server sends CORS headers — python's doesn't.
 * (GitHub Pages sends `Access-Control-Allow-Origin: *`, so this matches prod.)
 *
 * Usage: bun bench/serve.ts [port]   (default 8000)
 */

import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { join, normalize, sep } from "node:path";

const ROOT = join(import.meta.dir, "..");
const port = Number(process.argv[2] ?? 8000);

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

// Local-only review API: the dashboard probes /api/ping and, when it answers,
// offers a scoring UI that POSTs smoke/review edits here. Loopback clients only —
// the public GitHub Pages copy has no endpoint, so the UI never appears there.
const SMOKE_KEYS = ["loads", "consoleErrors", "notes"];
const REVIEW_KEYS = ["firstTry", "checklist", "notes"];
const isLoopback = (ip: string | undefined) =>
  ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";

function mergeReview(body: any): { status: number; msg: string } {
  if (!body || typeof body.id !== "string") return { status: 400, msg: "missing run id" };
  const ledgerPath = join(ROOT, "runs", "index.json");
  const ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
  const run = ledger.find((r: any) => r.id === body.id);
  if (!run) return { status: 404, msg: `unknown run "${body.id}"` };
  if (body.smoke && typeof body.smoke === "object")
    for (const k of SMOKE_KEYS) if (k in body.smoke) run.smoke[k] = body.smoke[k];
  if (body.review && typeof body.review === "object")
    for (const k of REVIEW_KEYS) {
      if (!(k in body.review)) continue;
      if (k === "checklist") {
        for (const item of Object.keys(run.review.checklist))
          if (item in body.review.checklist) run.review.checklist[item] = body.review.checklist[item];
      } else run.review[k] = body.review[k];
    }
  writeFileSync(ledgerPath + ".tmp", JSON.stringify(ledger, null, 2) + "\n");
  renameSync(ledgerPath + ".tmp", ledgerPath);
  return { status: 200, msg: "saved" };
}

Bun.serve({
  port,
  async fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/api/ping")
      return new Response("pong", { status: 200, headers: HEADERS });
    if (url.pathname === "/api/review" && req.method === "POST") {
      if (!isLoopback(server.requestIP(req)?.address))
        return new Response("loopback only", { status: 403, headers: HEADERS });
      try {
        const { status, msg } = mergeReview(await req.json());
        return new Response(msg, { status, headers: HEADERS });
      } catch (e) {
        return new Response(`bad request: ${e}`, { status: 400, headers: HEADERS });
      }
    }
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const full = normalize(join(ROOT, path));
    if (!full.startsWith(ROOT + sep)) return new Response("nope", { status: 403, headers: HEADERS });
    const file = Bun.file(full);
    if (!(await file.exists())) return new Response("not found", { status: 404, headers: HEADERS });
    return new Response(file, { headers: HEADERS }); // Bun.file infers Content-Type
  },
});

console.log(`serving ${ROOT} → http://localhost:${port}/  (CORS + no-cache, Ctrl-C to stop)`);
