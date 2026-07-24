"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, CircleUserRound } from "lucide-react";

export function FounderLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/founder/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Sign-in failed.");
      }
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Sign-in failed.");
      setSubmitting(false);
    }
  }

  return (
    <div className="status-shell">
      <form className="status-card" onSubmit={submit}>
        <CircleUserRound size={22} />
        <h1>Check your status</h1>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Sign in with the email and password you were given to see where your FirstContact interest record stands.
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
