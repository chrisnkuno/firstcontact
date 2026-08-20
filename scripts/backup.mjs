#!/usr/bin/env node
/**
 * Takes a verified snapshot of a Convex deployment.
 *
 * Wraps `convex export` with the three things that turn an export into a
 * backup you can actually rely on:
 *
 *  1. A checksum, computed at write time. An archive nobody has verified is a
 *     hope, not a backup — silent corruption is discovered during a restore,
 *     which is the worst possible moment to discover it.
 *  2. A manifest recording which deployment it came from, when, and how big.
 *     A directory of timestamped zips with no provenance is unusable in an
 *     incident, when nobody remembers whether `2026-08-20` was prod or staging.
 *  3. A refusal to overwrite. Backups are append-only by construction here.
 *
 * Usage:
 *   node scripts/backup.mjs                      # uses CONVEX_DEPLOYMENT
 *   node scripts/backup.mjs --out ./backups
 *   node scripts/backup.mjs --prod               # explicitly target production
 *
 * Restoring is deliberately NOT automated here. See docs/RUNBOOKS.md — a
 * restore is destructive, rare, and should be a considered act with a human
 * reading each step, not a script anyone can run by accident.
 */

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, existsSync, writeFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : true;
}

const useProd = arg("prod", false) === true;
const outDir = resolve(String(arg("out", "./backups")));

const deployment = process.env.CONVEX_DEPLOYMENT ?? "(from --prod)";
if (!useProd && !process.env.CONVEX_DEPLOYMENT) {
  console.error(
    "No CONVEX_DEPLOYMENT set and --prod not passed.\n" +
      "Run with `node --env-file=.env.local scripts/backup.mjs`, or pass --prod.",
  );
  process.exit(1);
}

// A production backup is the one most likely to be taken under pressure, so it
// is named explicitly rather than inferred from ambient environment.
const label = useProd ? "prod" : deployment.replace(/^dev:/, "dev-").replace(/[^a-zA-Z0-9_-]/g, "");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const archive = join(outDir, `convex-${label}-${stamp}.zip`);

mkdirSync(outDir, { recursive: true });
if (existsSync(archive)) {
  console.error(`Refusing to overwrite an existing archive: ${archive}`);
  process.exit(1);
}

console.log(`Exporting ${useProd ? "production" : deployment} → ${archive}`);

const exportArgs = ["convex", "export", "--path", archive];
if (useProd) exportArgs.push("--prod");

const result = spawnSync("bunx", exportArgs, { stdio: "inherit" });
if (result.status !== 0) {
  console.error("\nExport failed. No manifest written — an unverified archive is not a backup.");
  process.exit(result.status ?? 1);
}

if (!existsSync(archive)) {
  console.error("Export reported success but produced no file. Treating this as a failure.");
  process.exit(1);
}

const bytes = readFileSync(archive);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const { size } = statSync(archive);

// An empty or near-empty archive from a deployment that should have data is the
// classic silent backup failure: the job "succeeds" nightly and restores
// nothing. Flagged loudly rather than left for the incident.
if (size < 1024) {
  console.warn(`\nWARNING: the archive is only ${size} bytes. Verify the deployment is not empty.`);
}

const manifest = {
  archive: archive.split("/").pop(),
  deployment: useProd ? "production" : deployment,
  takenAt: new Date().toISOString(),
  sizeBytes: size,
  sha256,
  convexCliVersion: spawnSync("bunx", ["convex", "--version"], { encoding: "utf8" }).stdout?.trim(),
  note: "Verify with: shasum -a 256 <archive>. Restore procedure: docs/RUNBOOKS.md",
};

writeFileSync(`${archive}.json`, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`\nBackup complete.
  archive  ${archive}
  size     ${(size / 1024 / 1024).toFixed(2)} MB
  sha256   ${sha256}
  manifest ${archive}.json

Verify independently:  shasum -a 256 ${archive}
Rehearse a restore at least quarterly — see docs/RUNBOOKS.md.`);
