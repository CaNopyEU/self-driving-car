#!/usr/bin/env bun
/**
 * Static server for the bench. Use this instead of `python3 -m http.server`:
 * the dashboard embeds runs in a sandboxed iframe (opaque origin), and ES-module
 * games load only when the server sends CORS headers — python's doesn't.
 * (GitHub Pages sends `Access-Control-Allow-Origin: *`, so this matches prod.)
 *
 * Usage: bun bench/serve.ts [port]   (default 8000)
 */

import { join, normalize, sep } from "node:path";

const ROOT = join(import.meta.dir, "..");
const port = Number(process.argv[2] ?? 8000);

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

Bun.serve({
  port,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith("/")) path += "index.html";
    const full = normalize(join(ROOT, path));
    if (!full.startsWith(ROOT + sep)) return new Response("nope", { status: 403, headers: HEADERS });
    const file = Bun.file(full);
    if (!(await file.exists())) return new Response("not found", { status: 404, headers: HEADERS });
    return new Response(file, { headers: HEADERS }); // Bun.file infers Content-Type
  },
});

console.log(`serving ${ROOT} → http://localhost:${port}/  (CORS + no-cache, Ctrl-C to stop)`);
