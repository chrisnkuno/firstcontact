"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, ArrowLeft, Check, KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Choice = {
  signupId: Id<"interestSignups">;
  displayName: string;
  organizationLabel: string | null;
  accountType: "startup" | "institution" | "individual";
  hasPassword: boolean;
};

const TYPE_LABELS: Record<Choice["accountType"], string> = {
  startup: "Startup",
  institution: "Institution",
  individual: "Individual",
};

function setupError(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : String(caught);
  if (message.includes("PASSWORD_ALREADY_SET") || message.includes("already exists")) {
    return "A password is already set for this participant. Use the regular sign-in form.";
  }
  if (message.includes("INVITE_MALFORMED")) return "Enter the full setup code, including both groups.";
  if (message.includes("INVITE_UNKNOWN")) return "That setup code does not belong to this participant.";
  if (message.includes("INVITE_EXPIRED")) return "That setup code expired. Ask an operator to reissue it.";
  if (message.includes("INVITE_REVOKED")) return "That setup code was withdrawn. Ask an operator for help.";
  if (message.includes("INVITE_ALREADY_REDEEMED")) return "That setup code was already used. Sign in instead.";
  if (message.includes("Password must be at least")) return "Password must be at least 12 characters.";
  if (message.includes("less predictable")) return "Choose a less predictable password.";
  if (message.includes("Could not verify code") || message.includes("InvalidVerificationCode")) {
    return "That email verification code is invalid or expired.";
  }
  return "We could not finish account setup. Check the details and try again.";
}

/**
 * Participant-first account access.
 *
 * Cards contain no email or intake answers. A new participant must present the
 * bearer setup code before their email is released to Convex Auth for account
 * creation, so clicking a recognizable name is convenience rather than an
 * account-takeover primitive.
 */
export function ParticipantAccess() {
  const choices = useQuery(api.invites.listParticipantChoices, {});
  const prepare = useMutation(api.invites.preparePasswordSetup);
  const redeem = useMutation(api.invites.redeem);
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [selected, setSelected] = useState<Choice | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verification, setVerification] = useState<{
    email: string;
    inviteCode: string;
  } | null>(null);

  const filtered = useMemo(() => {
    if (!choices) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return choices;
    return choices.filter((choice) =>
      `${choice.displayName} ${choice.organizationLabel ?? ""}`.toLowerCase().includes(needle),
    );
  }, [choices, query]);

  async function finishInvite(inviteCode: string) {
    // Keep a local fallback until redemption succeeds. It contains no email or
    // password, and the dashboard removes it immediately after use.
    window.sessionStorage.setItem("firstcontact.pendingInviteCode", inviteCode);
    try {
      await redeem({ code: inviteCode });
      window.sessionStorage.removeItem("firstcontact.pendingInviteCode");
    } catch {
      // The auth token can take one render to reach the Convex client. The
      // dashboard's redemption panel retries this exact code once authenticated.
    }
    router.push("/dashboard");
  }

  async function onSetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("The two passwords do not match.");
      return;
    }

    setPending(true);
    const inviteCode = String(form.get("inviteCode") ?? "");
    try {
      const setup = await prepare({ signupId: selected.signupId, code: inviteCode });
      const result = await signIn("password", {
        flow: "signUp",
        email: setup.email,
        password,
        name: setup.name,
        role: "participant",
        participantKind: setup.participantKind,
        organizationName: setup.organizationName ?? "",
        location: setup.location,
      });
      if (result.signingIn) {
        await finishInvite(setup.inviteCode);
      } else {
        setVerification({ email: setup.email, inviteCode: setup.inviteCode });
        setPending(false);
      }
    } catch (caught) {
      setError(setupError(caught));
      setPending(false);
    }
  }

  async function onVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verification) return;
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await signIn("password", {
        flow: "email-verification",
        email: verification.email,
        code: String(form.get("code") ?? "").replace(/\s/g, ""),
      });
      await finishInvite(verification.inviteCode);
    } catch (caught) {
      setError(setupError(caught));
      setPending(false);
    }
  }

  if (verification) {
    return (
      <form className="participant-access participant-access-setup" onSubmit={onVerify}>
        <span>PARTICIPANT / CONFIRM EMAIL</span>
        <h2>One last check</h2>
        <p>An eight-digit verification code was sent to the address on this participant record.</p>
        <label>
          Verification code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
        </label>
        {error ? <p className="auth-error" role="alert"><AlertTriangle size={15} /> {error}</p> : null}
        <button className="button button-dark" type="submit" disabled={pending}>
          {pending ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
          {pending ? "Confirming" : "Confirm and sign in"}
        </button>
      </form>
    );
  }

  if (selected) {
    return (
      <section className="participant-access participant-access-setup">
        <button className="participant-access-back" type="button" onClick={() => { setSelected(null); setError(null); }}>
          <ArrowLeft size={14} /> All participants
        </button>
        <span>{TYPE_LABELS[selected.accountType]} / ACCOUNT ACCESS</span>
        <h2>{selected.displayName}</h2>
        {selected.organizationLabel ? <p className="participant-access-org">{selected.organizationLabel}</p> : null}

        {selected.hasPassword ? (
          <div className="participant-password-ready">
            <LockKeyhole size={20} />
            <div>
              <strong>Your password is already set</strong>
              <p>Use the sign-in form below with the email address on your account.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSetPassword}>
            <p>Enter the setup code issued with this participant record, then choose your own password.</p>
            <label>
              Setup code
              <input name="inviteCode" placeholder="FC-XXXXX-XXXXX" autoComplete="off" required />
            </label>
            <label>
              New password
              <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required />
              <small>At least 12 characters. A short passphrase is welcome.</small>
            </label>
            <label>
              Confirm password
              <input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required />
            </label>
            {error ? <p className="auth-error" role="alert"><AlertTriangle size={15} /> {error}</p> : null}
            <button className="button button-dark" type="submit" disabled={pending}>
              {pending ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />}
              {pending ? "Setting password" : "Set password and sign in"}
            </button>
          </form>
        )}
      </section>
    );
  }

  return (
    <section className="participant-access">
      <span>PARTICIPANT ACCESS</span>
      <h1>Find your participant record</h1>
      <p>Select your card. If this is your first visit, you can set your own password here.</p>
      <label className="participant-search">
        Search participants
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Name or organization" />
      </label>
      {choices === undefined ? (
        <p className="participant-access-loading"><Loader2 size={15} className="spin" /> Loading participants…</p>
      ) : filtered.length ? (
        <div className="participant-choice-grid">
          {filtered.map((choice) => (
            <button key={choice.signupId} type="button" onClick={() => setSelected(choice)}>
              <span>{TYPE_LABELS[choice.accountType]}</span>
              <strong>{choice.displayName}</strong>
              <small>{choice.organizationLabel ?? "Independent participant"}</small>
              <em>{choice.hasPassword ? "Sign in" : "Set password"}</em>
            </button>
          ))}
        </div>
      ) : (
        <p className="participant-access-empty">No participant matches that search.</p>
      )}
      <small className="participant-access-privacy">Names and organizations are masked. Emails and private application details are never shown.</small>
    </section>
  );
}
