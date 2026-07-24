"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";

type SetupState = { secret: string; otpauthUri: string; qrDataUrl: string };

export function AdminMfaSetup() {
  const router = useRouter();
  const [setup, setSetup] = useState<SetupState | null>(null);
  const [loadError, setLoadError] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/mfa/setup", { method: "POST" })
      .then((response) => response.json())
      .then((payload: { ok: boolean; message?: string } & Partial<SetupState>) => {
        if (cancelled) return;
        if (!payload.ok || !payload.secret || !payload.otpauthUri || !payload.qrDataUrl) {
          setLoadError(payload.message || "Could not start MFA setup.");
          return;
        }
        setSetup({ secret: payload.secret, otpauthUri: payload.otpauthUri, qrDataUrl: payload.qrDataUrl });
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not start MFA setup.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/mfa/confirm", {
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

  return (
    <div className="admin-login-shell">
      <div className="admin-login-card" style={{ width: "min(420px, 92vw)" }}>
        <ShieldCheck size={22} />
        <h1>Set up your authenticator</h1>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Multi-factor sign-in is required for techadmin access. Scan this QR code with an authenticator app (Google
          Authenticator, 1Password, Authy), then enter the current code to confirm.
        </p>

        {loadError && (
          <div className="form-error" role="alert">
            {loadError}
          </div>
        )}

        {!setup && !loadError && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--muted)" }}>
            <LoaderCircle className="spin" size={16} /> Generating your setup code
          </div>
        )}

        {setup && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={setup.qrDataUrl}
              alt="Scan this QR code with your authenticator app"
              width={240}
              height={240}
              style={{ alignSelf: "center", border: "1px solid var(--line)" }}
            />
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
              Can&apos;t scan it? Enter this key manually: <code>{setup.secret}</code>
            </p>

            <form onSubmit={confirm} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}
              <label>
                Confirm the current code
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </label>
              <button className="button button-dark" type="submit" disabled={submitting || code.length !== 6}>
                {submitting ? (
                  <>
                    <LoaderCircle className="spin" size={16} /> Confirming
                  </>
                ) : (
                  "Confirm and enable"
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
