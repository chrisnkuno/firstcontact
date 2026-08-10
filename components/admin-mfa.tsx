"use client";

import { useMutation } from "convex/react";
import { useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";

type MfaState = { enrolled: boolean; enabled: boolean; sessionVerified: boolean };

/**
 * The admin step-up gate.
 *
 * Three states, in order: not enrolled → enrol; enrolled but this session has
 * not proven possession → verify; verified → render the dashboard.
 *
 * This is a user-experience gate, not the security boundary. Every privileged
 * Convex query behind it independently calls `requireAdmin`, which checks the
 * same session verification server-side — so bypassing this component in the
 * browser yields empty screens, not data.
 */
export function AdminMfaGate({ mfa, children }: { mfa: MfaState; children: ReactNode }) {
  if (!mfa.enabled) return <MfaEnrolment />;
  if (!mfa.sessionVerified) return <MfaStepUp />;
  return <>{children}</>;
}

function MfaEnrolment() {
  const startEnrolment = useMutation(api.users.startMfaEnrolment);
  const confirmMfa = useMutation(api.users.confirmMfa);
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function begin() {
    setError(null);
    setPending(true);
    try {
      const result = await startEnrolment({});
      setSecret(result.secret);
      // Rendered locally from the otpauth URI — the secret never travels to a
      // third-party QR service.
      setQr(await QRCode.toDataURL(result.otpauthUri, { margin: 1, width: 220 }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start enrolment");
    } finally {
      setPending(false);
    }
  }

  async function onConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    try {
      await confirmMfa({ code });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code did not match");
      setPending(false);
    }
  }

  return (
    <section className="auth-card">
      <span>OPERATOR / SECURITY</span>
      <h1>Enrol an authenticator</h1>
      <p>
        Multi-factor authentication is mandatory for operator accounts. Until you enrol, every
        privileged read and write is refused — including the metrics on this page.
      </p>

      {!secret ? (
        <button className="button button-dark" type="button" onClick={begin} disabled={pending}>
          {pending ? <Loader2 size={15} className="spin" /> : <KeyRound size={15} />} Begin enrolment
        </button>
      ) : (
        <>
          {qr && (
            <Image
              src={qr}
              alt="Scan this QR code with your authenticator app"
              width={220}
              height={220}
              unoptimized
            />
          )}
          <p className="mfa-secret">
            Or enter this key manually: <code>{secret}</code>
          </p>
          <form onSubmit={onConfirm}>
            <label>
              Six-digit code from your app
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
              />
            </label>
            <button className="button button-dark" type="submit" disabled={pending}>
              {pending ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} Confirm
            </button>
          </form>
        </>
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function MfaStepUp() {
  const verifyMfa = useMutation(api.users.verifyMfa);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    try {
      await verifyMfa({ code });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code did not match");
      setPending(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <span>OPERATOR / STEP UP</span>
      <h1>Confirm it&rsquo;s you</h1>
      <p>
        Being signed in is not enough to read platform data. Enter the current code from your
        authenticator to unlock this session for the next eight hours.
      </p>
      <label>
        Six-digit code
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          autoFocus
        />
      </label>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark" type="submit" disabled={pending}>
        {pending ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />} Verify
      </button>
    </form>
  );
}

/** Standalone security page, reachable from the operator nav. */
export function AdminSecurityPanel({ mfa }: { mfa: MfaState }) {
  const endStepUp = useMutation(api.users.endMfaStepUp);

  if (!mfa.enabled) return <MfaEnrolment />;

  return (
    <section className="auth-card">
      <span>OPERATOR / SECURITY</span>
      <h1>Session security</h1>
      <p>
        Multi-factor authentication is enabled on this account. This session is currently{" "}
        <strong>{mfa.sessionVerified ? "verified" : "not verified"}</strong>.
      </p>
      <p>
        Ending step-up keeps you signed in but requires the authenticator again before any privileged
        read. Use it when stepping away from a shared machine.
      </p>
      <button
        className="button button-outline-dark"
        type="button"
        disabled={!mfa.sessionVerified}
        onClick={() => void endStepUp({})}
      >
        End step-up for this session
      </button>
    </section>
  );
}
