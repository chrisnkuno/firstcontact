"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";

export function AdminLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submitCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { ok: boolean; message?: string; mfaRequired?: boolean };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Sign-in failed.");
      }
      if (payload.mfaRequired) {
        setStep("mfa");
        setSubmitting(false);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign-in failed.");
      setSubmitting(false);
    }
  }

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "That code did not match.");
      }
      router.replace("/admin");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "That code did not match.");
      setSubmitting(false);
    }
  }

  if (step === "mfa") {
    return (
      <div className="admin-login-shell">
        <form className="admin-login-card" onSubmit={submitCode}>
          <ShieldCheck size={22} />
          <h1>Enter your code</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Open your authenticator app and enter the current 6-digit code.
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <label>
            Authenticator code
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          <button className="button button-dark" type="submit" disabled={submitting || code.length !== 6}>
            {submitting ? (
              <>
                <LoaderCircle className="spin" size={16} /> Verifying
              </>
            ) : (
              "Verify"
            )}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-login-shell">
      <form className="admin-login-card" onSubmit={submitCredentials}>
        <ShieldCheck size={22} />
        <h1>Techadmin sign in</h1>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Operator access only. Contact the deployment owner if you need an account.
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <label>
          Email
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="button button-dark" type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <LoaderCircle className="spin" size={16} /> Signing in
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </div>
  );
}
