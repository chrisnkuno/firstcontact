"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AlertTriangle, Loader2, LogIn, UserPlus } from "lucide-react";
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
 * Sign-in and sign-up.
 *
 * Both flows go through Convex Auth's password provider, which handles hashing
 * (scrypt), per-identifier attempt limiting, and session issuance. This file
 * deliberately contains no cryptography of its own — the previous
 * implementation hashed passwords in a Next.js route, and reproducing that in
 * the browser would be strictly worse.
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

export function SignInForm({ redirectTo = "/dashboard" }: { redirectTo?: string }) {
  if (!isConvexConfigured) return <AuthUnavailable title="Sign in is unavailable" />;
  return <SignInFormInner redirectTo={redirectTo} />;
}

function SignInFormInner({ redirectTo }: { redirectTo: string }) {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
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

  return (
    <form className="auth-card" onSubmit={onSubmit}>
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

      {error && (
        <p className="auth-error" role="alert">
          <AlertTriangle size={15} /> {error}
        </p>
      )}

      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? <Loader2 size={15} className="spin" /> : <LogIn size={15} />}
        {pending ? "Signing in" : "Sign in"}
      </button>

      <small>
        No account yet? <Link href="/join">Create one</Link>.
      </small>
    </form>
  );
}

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

    try {
      await signIn("password", form);
      router.push(role === "investor" ? "/investor" : "/dashboard");
    } catch (caught) {
      setError(friendlyError(caught));
      setPending(false);
    }
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

      {error && (
        <p className="auth-error" role="alert">
          <AlertTriangle size={15} /> {error}
        </p>
      )}

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
