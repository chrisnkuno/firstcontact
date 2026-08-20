import { Email } from "@convex-dev/auth/providers/Email";
import { emailProviders, describeFailures, sendEmail } from "./providers";

/**
 * Transactional authentication email: password reset and address verification.
 *
 * Two deliberate decisions here.
 *
 * First, this reuses the ordinary provider chain from `convex/providers.ts`
 * rather than binding to one vendor, so a deployment that already configured
 * Postmark or SendGrid for outreach gets reset email with no extra setup.
 *
 * Second — and this is the important one — none of it is gated by
 * `OUTBOUND_EMAIL_ENABLED`. That switch exists to keep *outreach* off until the
 * compliance, suppression and deliverability work is finished. A password reset
 * is a different category of message: the recipient asked for it, seconds ago,
 * about their own account. Holding it behind the outreach kill switch would
 * lock every user out of their account for as long as outreach stays disabled,
 * which is precisely backwards. Suppression lists are likewise not consulted:
 * unsubscribing from outreach must never cost someone the ability to recover
 * their own login.
 *
 * Codes rather than magic links, because the site is a static export served
 * from a path that varies per deployment — a code the user retypes works
 * identically everywhere, with no link-rewriting or base-path handling.
 */

/** Digits in a one-time code. 8 gives ~26.6 bits, spent against a 15-minute window. */
const CODE_LENGTH = 8;

const RESET_TTL_SECONDS = 15 * 60;
const VERIFY_TTL_SECONDS = 30 * 60;

/**
 * A numeric code drawn from the platform CSPRNG.
 *
 * Rejection sampling rather than `% 10`: the modulo of a byte over ten is
 * biased toward the low digits, which quietly shrinks the search space an
 * attacker has to cover.
 */
function generateCode(): string {
  const digits: string[] = [];
  while (digits.length < CODE_LENGTH) {
    const bytes = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= 250) continue; // 250 = floor(256/10)*10
      digits.push(String(byte % 10));
      if (digits.length === CODE_LENGTH) break;
    }
  }
  return digits.join("");
}

function group(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

async function deliver(args: {
  to: string;
  subject: string;
  text: string;
  purpose: string;
  token: string;
}) {
  const providers = emailProviders();
  if (providers.length === 0) {
    // Loud rather than silent. A caller that swallowed this would show the
    // user "check your inbox" for mail that was never going to arrive.
    throw new Error(
      "EMAIL_NOT_CONFIGURED: no email provider is configured, so this deployment cannot send " +
        `${args.purpose} mail. Set RESEND_API_KEY (or POSTMARK_API_KEY / SENDGRID_API_KEY) and EMAIL_FROM.`,
    );
  }

  const result = await sendEmail(providers, {
    to: args.to,
    subject: args.subject,
    text: args.text,
    // Transactional: no List-Unsubscribe. See the note at the top of this file.
    idempotencyKey: `${args.purpose}:${args.to}:${args.token}`,
  });

  if (!result.ok) {
    throw new Error(`EMAIL_SEND_FAILED: ${describeFailures(result.failures)}`);
  }
}

/**
 * Password reset.
 *
 * Convex Auth calls this only for an address that actually has an account, and
 * the client is told the same thing either way, so this handler never becomes
 * an account-existence oracle.
 */
export const PasswordResetEmail = Email({
  id: "password-reset",
  maxAge: RESET_TTL_SECONDS,
  generateVerificationToken: async () => generateCode(),
  sendVerificationRequest: async ({ identifier: email, token }) => {
    await deliver({
      to: email,
      purpose: "password-reset",
      token,
      subject: "Reset your FirstContact password",
      text: [
        "Someone asked to reset the password for this FirstContact account.",
        "",
        `Your code is: ${group(token)}`,
        "",
        `It expires in ${RESET_TTL_SECONDS / 60} minutes and can be used once.`,
        "",
        "If this was not you, no action is needed — your password has not changed,",
        "and whoever asked cannot proceed without this code.",
      ].join("\n"),
    });
  },
});

/**
 * Address verification at sign-up.
 *
 * The account is created before the address is confirmed, but Convex Auth does
 * not issue a session until the code is verified — so an unverified address
 * cannot be used to sign in, and cannot be used to claim an existing intake
 * record.
 */
export const EmailVerificationEmail = Email({
  id: "email-verification",
  maxAge: VERIFY_TTL_SECONDS,
  generateVerificationToken: async () => generateCode(),
  sendVerificationRequest: async ({ identifier: email, token }) => {
    await deliver({
      to: email,
      purpose: "email-verification",
      token,
      subject: "Confirm your email for FirstContact",
      text: [
        "Welcome to FirstContact. Confirm this address to finish creating your account.",
        "",
        `Your code is: ${group(token)}`,
        "",
        `It expires in ${VERIFY_TTL_SECONDS / 60} minutes.`,
        "",
        "If you did not create an account, you can ignore this message.",
      ].join("\n"),
    });
  },
});

/**
 * Whether this deployment can send authentication mail at all.
 *
 * Read by `convex/auth.ts` so that a deployment with no email provider keeps
 * working exactly as it does today — sign-up and sign-in with no verification
 * step — instead of failing at the moment a user tries to create an account.
 */
export function authEmailConfigured(): boolean {
  return emailProviders().length > 0;
}
