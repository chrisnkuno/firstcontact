"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AlertTriangle, KeyRound, Loader2, LogIn, MailCheck, UserPlus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { isConvexConfigured } from "@/lib/convex-endpoints";
import {
  INVESTOR_TYPE_LABELS,
  investorTypes,
  participantKinds,
  type AccountRole,
  type InvestorType,
  type ParticipantKind,
} from "@/lib/domain";

/**
 * Sign-in, sign-up, password reset and address verification.
 *
 * All flows go through Convex Auth's password provider, which handles hashing
 * (scrypt), per-identifier attempt limiting, one-time-code issuance and session
 * issuance. This file deliberately contains no cryptography of its own — the
 * previous implementation hashed passwords in a Next.js route, and reproducing
 * that in the browser would be strictly worse.
 *
 * Reset and verification are *capability-gated* rather than assumed: a
 * deployment with no email provider cannot send a code, so the UI does not
 * offer the option at all instead of dead-ending the user after they commit to
 * it. `api.users.authCapabilities` reports what this deployment can do.
 */

const PARTICIPANT_KIND_LABELS: Record<ParticipantKind, string> = {
  startup: "A startup raising capital",
  institution: "An institution or cooperative",
  individual: "An individual",
};

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Convex surfaces server errors with framing around them; the useful part is
  // whatever the mutation actually threw.
  if (message.includes("InvalidAccountId") || message.includes("InvalidSecret")) {
    return "That email and password combination did not match an account.";
  }
  if (message.includes("Password must be at least")) {
    return "Password must be at least 12 characters.";
  }
  if (message.includes("less predictable")) {
    return "Choose a less predictable password.";
  }
  if (message.includes("EMAIL_NOT_CONFIGURED")) {
    return "This deployment cannot send email, so codes cannot be delivered. Contact the operators.";
  }
  if (message.includes("EMAIL_SEND_FAILED")) {
    return "The code could not be sent right now. Try again in a moment.";
  }
  if (message.includes("Could not verify code") || message.includes("InvalidVerificationCode")) {
    return "That code is not valid or has expired. Request a new one.";
  }
  if (message.toLowerCase().includes("too many")) {
    return "Too many attempts. Wait a few minutes and try again.";
  }
  if (message.includes("already exists") || message.includes("Account already exists")) {
    return "An account already exists for that email. Sign in instead.";
  }
  return "Something went wrong. Please try again.";
}

/**
 * Shown instead of a sign-in or sign-up form when the build has no backend.
 *
 * Rendered *before* any Convex hook runs. `useAuthActions()` returns undefined
 * without a `ConvexAuthProvider` above it, and destructuring that throws — which
 * is a build failure, not a runtime one, because these pages are prerendered.
 */
function AuthUnavailable({ title }: { title: string }) {
  return (
    <section className="auth-card">
      <span>ACCOUNT</span>
      <h1>{title}</h1>
      <p>
        This build has no backend configured, so accounts cannot be created or used.{" "}
        <code>NEXT_PUBLIC_CONVEX_URL</code> must be set at build time.
      </p>
    </section>
  );
}

/** Shared one-time-code field. Numeric, 8 digits, pasteable. */
function CodeField({ label = "Code from your email" }: { label?: string }) {
  return (
    <label>
      {label}
      <input
        name="code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{8,10}"
        required
        placeholder="1234 5678"
      />
      <small>Eight digits. Spaces are ignored.</small>
    </label>
  );
}

/** Codes are displayed grouped for readability, so strip whitespace on the way back. */
function normalizeCode(value: FormDataEntryValue | null): string {
  return String(value ?? "").replace(/\s/g, "");
}

/* ------------------------------------------------------------------ *
 * Sign in
 * ------------------------------------------------------------------ */

export function SignInForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  if (!isConvexConfigured) return <AuthUnavailable title="Sign in is unavailable" />;
  return <SignInFormInner redirectTo={redirectTo} />;
}

type SignInMode = "signIn" | "resetRequest" | "resetVerify";

function SignInFormInner({ redirectTo }: { redirectTo: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const capabilities = useQuery(api.users.authCapabilities);
  const [mode, setMode] = useState<SignInMode>("signIn");
  const [resetEmail, setResetEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchMode(next: SignInMode) {
    setError(null);
    setMode(next);
  }

  async function onSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    form.set("flow", "signIn");
    try {
      await signIn("password", form);
      router.push(redirectTo);
    } catch (caught) {
      setError(friendlyError(caught));
      setPending(false);
    }
  }

  /** Step one: ask for a code. */
  async function onResetRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    try {
      await signIn("password", { email, flow: "reset" });
      setResetEmail(email);
      switchMode("resetVerify");
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setPending(false);
    }
  }

  /** Step two: prove possession of the code and set the new password. */
  async function onResetVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      await signIn("password", {
        email: resetEmail,
        code: normalizeCode(form.get("code")),
        newPassword: String(form.get("newPassword") ?? ""),
        flow: "reset-verification",
      });
      router.push(redirectTo);
    } catch (caught) {
      setError(friendlyError(caught));
      setPending(false);
    }
  }

  const errorNode = error && (
    <p className="auth-error" role="alert">
      <AlertTriangle size={15} /> {error}
    </p>
  );

  if (mode === "resetRequest") {
    return (
      <form className="auth-card" onSubmit={onResetRequest}>
        <span>ACCOUNT / RESET</span>
        <h1>Reset your password</h1>
        <p>
          Enter the address on your account and we will send a one-time code. For your protection
          this screen looks the same whether or not an account exists.
        </p>

        <label>
          Email
          <input name="email" type="email" autoComplete="email" required defaultValue={resetEmail} />
        </label>

        {errorNode}

        <button className="button button-dark" type="submit" disabled={pending}>
          {pending ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />}
          {pending ? "Sending code" : "Send reset code"}
        </button>

        <small>
          Remembered it?{" "}
          <button type="button" className="auth-link" onClick={() => switchMode("signIn")}>
            Back to sign in
          </button>
          .
        </small>
      </form>
    );
  }

  if (mode === "resetVerify") {
    return (
      <form className="auth-card" onSubmit={onResetVerify}>
        <span>ACCOUNT / RESET</span>
        <h1>Enter your code</h1>
        <p>
          If an account exists for <strong>{resetEmail}</strong>, a code is on its way. It expires in
          15 minutes.
        </p>

        <CodeField />
        <label>
          New password
          <input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={256}
          />
          <small>At least 12 characters. Length matters more than symbols.</small>
        </label>

        {errorNode}

        <button className="button button-dark" type="submit" disabled={pending}>
          {pending ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />}
          {pending ? "Updating password" : "Set new password"}
        </button>

        <small>
          Did not get it?{" "}
          <button type="button" className="auth-link" onClick={() => switchMode("resetRequest")}>
            Send another code
          </button>
          .
        </small>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={onSignIn}>
      <span>ACCOUNT / SIGN IN</span>
      <h1>Welcome back</h1>
      <p>Sign in to your participant, investor, or operator account.</p>

      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>

      {errorNode}

      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? <Loader2 size={15} className="spin" /> : <LogIn size={15} />}
        {pending ? "Signing in" : "Sign in"}
      </button>

      {capabilities?.passwordReset && (
        <small>
          <button type="button" className="auth-link" onClick={() => switchMode("resetRequest")}>
            Forgot your password?
          </button>
        </small>
      )}

      <small>
        No account yet? <Link href="/join">Create one</Link>.
      </small>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Sign up
 * ------------------------------------------------------------------ */

export function SignUpForm() {
  if (!isConvexConfigured) return <AuthUnavailable title="Account creation is unavailable" />;
  return <SignUpFormInner />;
}

function SignUpFormInner() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [role, setRole] = useState<Exclude<AccountRole, "admin">>("participant");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Set once the account exists but the address has not been confirmed yet.
  const [verifying, setVerifying] = useState<{ email: string } | null>(null);

  const destination = role === "investor" ? "/investor" : "/dashboard";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    form.set("flow", "signUp");
    // The server clamps this anyway — `admin` is never accepted from a
    // sign-up payload — but sending only what the chosen role uses keeps a
    // participant from carrying a stale investorType.
    if (role !== "investor") form.delete("investorType");
    if (role !== "participant") form.delete("participantKind");

    const email = String(form.get("email") ?? "").trim();

    try {
      const result = await signIn("password", form);
      // With verification enabled the provider issues a code instead of a
      // session, and reports `signingIn: false`. Branching on the *result*
      // rather than on our own copy of the config means the UI cannot drift
      // out of step with what the deployment actually did.
      if (result.signingIn) {
        router.push(destination);
      } else {
        setVerifying({ email });
        setPending(false);
      }
    } catch (caught) {
      setError(friendlyError(caught));
      setPending(false);
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verifying) return;
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      await signIn("password", {
        email: verifying.email,
        code: normalizeCode(form.get("code")),
        flow: "email-verification",
      });
      router.push(destination);
    } catch (caught) {
      setError(friendlyError(caught));
      setPending(false);
    }
  }

  const errorNode = error && (
    <p className="auth-error" role="alert">
      <AlertTriangle size={15} /> {error}
    </p>
  );

  if (verifying) {
    return (
      <form className="auth-card" onSubmit={onVerify}>
        <span>ACCOUNT / CONFIRM</span>
        <h1>Confirm your email</h1>
        <p>
          Your account is created. We sent a code to <strong>{verifying.email}</strong> — enter it to
          finish. Confirming the address is what lets a founder or investor trust that a signal from
          this account came from a real person.
        </p>

        <CodeField />

        {errorNode}

        <button className="button button-dark" type="submit" disabled={pending}>
          {pending ? <Loader2 size={15} className="spin" /> : <MailCheck size={15} />}
          {pending ? "Confirming" : "Confirm email"}
        </button>

        <small>
          Wrong address?{" "}
          <button
            type="button"
            className="auth-link"
            onClick={() => {
              setVerifying(null);
              setError(null);
            }}
          >
            Start again
          </button>
          .
        </small>
      </form>
    );
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <span>ACCOUNT / CREATE</span>
      <h1>Create your account</h1>
      <p>
        This is your login. If you already submitted an interest form with the same email, your
        record is linked automatically.
      </p>

      <label>
        Your name
        <input name="name" type="text" autoComplete="name" required minLength={2} maxLength={100} />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={256}
        />
        <small>At least 12 characters. Length matters more than symbols.</small>
      </label>

      <fieldset className="auth-roles">
        <legend>I am joining as</legend>
        <label>
          <input
            type="radio"
            name="role"
            value="participant"
            checked={role === "participant"}
            onChange={() => setRole("participant")}
          />
          Someone seeking capital or support
        </label>
        <label>
          <input
            type="radio"
            name="role"
            value="investor"
            checked={role === "investor"}
            onChange={() => setRole("investor")}
          />
          Someone deploying capital
        </label>
      </fieldset>

      {role === "participant" && (
        <label>
          What are you joining as?
          <select name="participantKind" defaultValue="startup" required>
            {participantKinds.map((kind) => (
              <option key={kind} value={kind}>
                {PARTICIPANT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
      )}

      {role === "investor" && (
        <label>
          What kind of investor are you?
          <select name="investorType" defaultValue="angel" required>
            {investorTypes.map((type: InvestorType) => (
              <option key={type} value={type}>
                {INVESTOR_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <small>This decides which metrics your dashboard leads with. You can change it later.</small>
        </label>
      )}

      <label>
        Organization <em>(optional)</em>
        <input name="organizationName" type="text" maxLength={120} autoComplete="organization" />
      </label>
      <label>
        Where are you based? <em>(optional)</em>
        <input name="location" type="text" maxLength={120} />
      </label>

      {errorNode}

      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? <Loader2 size={15} className="spin" /> : <UserPlus size={15} />}
        {pending ? "Creating account" : "Create account"}
      </button>

      <small>
        Already have an account? <Link href="/signin">Sign in</Link>.
      </small>
    </form>
  );
}

export function SignOutButton() {
  // Only ever rendered inside DashboardShell, which already refuses to mount
  // without a backend — but guarded independently so it stays safe if reused.
  if (!isConvexConfigured) return null;
  return <SignOutButtonInner />;
}

function SignOutButtonInner() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <button
      className="chart-toggle"
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/");
      }}
    >
      SIGN OUT
    </button>
  );
}
