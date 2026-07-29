// Creates or resets a founder login for an EXISTING interestSignups email —
// this is a status-check account for someone already in the pipeline, not a
// way to originate a new signup.
//
// Usage:
//   node --env-file=.env.local scripts/create-founder-account.mjs <email> [password] [--signup-email=existing-signup@example.com]
//
// Requires CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL) and FOUNDER_ACTION_SECRET
// — the same secret configured with `bunx convex env set FOUNDER_ACTION_SECRET`
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
  console.error("Usage: node --env-file=.env.local scripts/create-founder-account.mjs <email> [password] [--signup-email=existing-signup@example.com]");
  process.exit(1);
}

const optionalArgs = process.argv.slice(3);
const signupEmailArg = optionalArgs.find((argument) => argument.startsWith("--signup-email="));
const signupEmail = signupEmailArg?.slice("--signup-email=".length).trim().toLowerCase() || undefined;
const suppliedPassword = optionalArgs.find((argument) => !argument.startsWith("--signup-email="));
const password = suppliedPassword ?? randomBytes(18).toString("base64url");
const convexUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
const founderSecret = process.env.FOUNDER_ACTION_SECRET;

if (!convexUrl) {
  console.error("Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL first.");
  process.exit(1);
}
if (!founderSecret) {
  console.error("Set FOUNDER_ACTION_SECRET first (must match the value set on the Convex deployment).");
  process.exit(1);
}

const createAccount = makeFunctionReference("founder:createAccount");
const client = new ConvexHttpClient(convexUrl);

try {
  const result = await client.mutation(createAccount, {
    founderSecret,
    email,
    ...(signupEmail ? { signupEmail } : {}),
    passwordHash: hashPassword(password),
  });

  console.log(`\n${result.created ? "Created" : "Reset"} founder status-check account for ${email}`);
  console.log(`Password: ${password}`);
  console.log("\nStore this securely — it will not be shown again. Sign in at /status.\n");
} catch (error) {
  console.error(`\nCould not create this account: ${error.message}\n`);
  process.exit(1);
}
