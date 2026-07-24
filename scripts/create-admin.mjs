// Creates or resets a single techadmin account.
//
// Usage:
//   node --env-file=.env.local scripts/create-admin.mjs <email> [password]
//
// Requires CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL) and ADMIN_BOOTSTRAP_SECRET
// — the same secret configured with `bunx convex env set ADMIN_BOOTSTRAP_SECRET`
// on the target Convex deployment. If no password is given, a random one is
// generated and printed once; it is never stored anywhere in plaintext.
import { randomBytes, scryptSync } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node --env-file=.env.local scripts/create-admin.mjs <email> [password]");
  process.exit(1);
}

const password = process.argv[3] ?? randomBytes(18).toString("base64url");
const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const bootstrapSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

if (!convexUrl) {
  console.error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL first.");
  process.exit(1);
}
if (!bootstrapSecret) {
  console.error("Set ADMIN_BOOTSTRAP_SECRET first (must match the value set on the Convex deployment).");
  process.exit(1);
}

const bootstrap = makeFunctionReference("admin:bootstrap");
const client = new ConvexHttpClient(convexUrl);
const result = await client.mutation(bootstrap, {
  bootstrapSecret,
  email,
  passwordHash: hashPassword(password),
});

console.log(`\n${result.created ? "Created" : "Reset"} techadmin account for ${email}`);
console.log(`Password: ${password}`);
console.log("\nStore this securely — it will not be shown again. Sign in at /admin/login, then set up MFA on first login.\n");
