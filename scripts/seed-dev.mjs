#!/usr/bin/env node
/**
 * Development seed.
 *
 * The fictional catalogue profiles and sample investor matches used to ship
 * inside the application bundle, where they were one careless render away from
 * being read as real companies. They live here instead: a script an operator
 * runs deliberately, against a development deployment, so the shipped product
 * shows empty states until real records exist.
 *
 * Refuses to run against anything that is not a `dev:` deployment. That guard
 * is the entire reason this is a script rather than a Convex mutation — a
 * mutation would be callable against production by anyone holding a deploy key.
 *
 *   bun run seed:dev
 */
import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile() {
  try {
    const contents = readFileSync(join(root, ".env.local"), "utf8");
    return Object.fromEntries(
      contents
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...readEnvFile(), ...process.env };
const deployment = env.CONVEX_DEPLOYMENT ?? "";
const convexUrl = env.CONVEX_URL ?? env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.error("No Convex URL configured. Run `bunx convex dev` first.");
  process.exit(1);
}

if (!deployment.startsWith("dev:")) {
  console.error(
    `Refusing to seed: CONVEX_DEPLOYMENT is "${deployment || "unset"}", which is not a dev deployment.\n` +
      "Synthetic records must never reach staging or production, where they would be\n" +
      "indistinguishable from real founders in the pipeline and in every metric.",
  );
  process.exit(1);
}

/**
 * Synthetic intake records.
 *
 * Every address is on `example.com`, which RFC 2606 reserves precisely so that
 * test data cannot reach a real mailbox — and the ingestion endpoint's
 * companion cleanup only removes records at that domain, so a seeded row can
 * always be identified and deleted.
 */
const SIGNUPS = [
  {
    accountType: "startup",
    name: "Aline Uwase",
    email: "aline@example.com",
    location: "Kigali, Rwanda",
    organizationName: "Kivu Grid",
    website: "https://example.com/kivu-grid",
    stage: "seed",
    summary:
      "Energy intelligence that helps African commercial buildings reduce cost and diesel dependence.",
    context:
      "Built for grids where outages, generator use, and fragmented equipment data make conventional energy software incomplete.",
    goals: ["raise-capital", "find-investors"],
    targetRegions: ["US", "UK", "EU"],
    referralSource: "community",
    productUpdates: true,
  },
  {
    accountType: "startup",
    name: "Camila Restrepo",
    email: "camila@example.com",
    location: "Cartagena, Colombia",
    organizationName: "Marea Health",
    stage: "pre-seed",
    summary:
      "Coordinated diagnostic delivery for coastal and rural clinics that lose patients between referral and result.",
    context:
      "Combines local courier networks with lightweight clinical coordination where formal addressing is inconsistent.",
    goals: ["raise-capital", "join-catalogue"],
    targetRegions: ["US", "EU"],
    referralSource: "referral",
    productUpdates: true,
  },
  {
    accountType: "institution",
    name: "Youssef Benali",
    email: "youssef@example.com",
    location: "Ouarzazate, Morocco",
    organizationName: "Atlas Water Cooperative",
    stage: "institutional",
    summary:
      "A regional cooperative financing solar-powered water resilience for agricultural communities.",
    context:
      "Community governance and seasonal cash flows require blended capital rather than conventional venture-only terms.",
    goals: ["raise-capital", "partner"],
    targetRegions: ["EU", "UK"],
    referralSource: "event",
    productUpdates: false,
  },
  {
    accountType: "individual",
    name: "Priya Raman",
    email: "priya@example.com",
    location: "Singapore",
    individualRole: "investor",
    summary:
      "Angel investor backing early climate and health infrastructure across South and Southeast Asia.",
    context:
      "Writes first cheques alongside operators, and prefers companies with measured operating data over projections.",
    goals: ["invest", "mentor"],
    targetRegions: ["APAC"],
    referralSource: "search",
    productUpdates: true,
  },
];

const client = new ConvexHttpClient(convexUrl);

async function main() {
  console.log(`Seeding development deployment ${deployment}\n`);

  let created = 0;
  for (const signup of SIGNUPS) {
    // Goes through the same internal mutation the public endpoint uses, so
    // seeded rows are structurally identical to real ones — a seed that took a
    // shortcut would not exercise the code paths it is meant to support.
    await client.mutation("signups:record", {
      ...signup,
      source: "seed:dev",
      consentRecordedAt: Date.now(),
    });
    created += 1;
    console.log(`  ✓ ${signup.name} <${signup.email}>`);
  }

  console.log(`\nSeeded ${created} interest signups.`);
  console.log("\nNext steps:");
  console.log("  1. Create an account at /join using one of the seeded emails to link a record.");
  console.log("  2. Promote it to admin:  bunx convex run users:promoteToAdmin \\");
  console.log("       '{\"email\":\"you@example.com\",\"bootstrapSecret\":\"<ADMIN_BOOTSTRAP_SECRET>\"}'");
  console.log("  3. Enrol MFA at /admin/mfa — admin reads are refused until you do.");
}

main().catch((error) => {
  console.error("\nSeeding failed:", error.message);
  process.exit(1);
});
