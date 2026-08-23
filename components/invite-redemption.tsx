"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Check } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { normaliseInviteCode } from "@/lib/invite-code";

/**
 * Where an invite code is actually spent.
 *
 * This lives on the dashboard rather than in the sign-up form for a structural
 * reason: redemption is an authenticated mutation, and when email verification
 * is enabled Convex Auth's `signUp` flow issues a code instead of a session, so
 * at the moment the sign-up form finishes there may be no identity to redeem
 * against. The dashboard is the first point where a session is guaranteed.
 *
 * The panel hides itself once the account is linked, so someone whose record
 * was matched automatically by verified email never sees it.
 */

/** Maps the server's stable error codes onto something a person can act on. */
const MESSAGES: Record<string, string> = {
  INVITE_MALFORMED: "That does not look like an invite code. They look like FC-XXXXX-XXXXX.",
  INVITE_UNKNOWN: "No invite matches that code. Check it with whoever sent it.",
  INVITE_EXPIRED: "That code has expired. Ask for a new one to be issued.",
  INVITE_REVOKED: "That code was withdrawn. Ask for a new one to be issued.",
  INVITE_ALREADY_REDEEMED: "That code has already been used on this account.",
  INVITE_WRONG_ACCOUNT:
    "That code was issued to a different email address than the one on this account.",
  INVITE_NO_EMAIL: "This account has no email address, so a code cannot be matched to it.",
};

function messageFor(caught: unknown): string {
  const raw = caught instanceof Error ? caught.message : String(caught);
  for (const [code, message] of Object.entries(MESSAGES)) {
    if (raw.includes(code)) return message;
  }
  return "That code could not be redeemed. Check it and try again.";
}

export function InviteRedemption() {
  const status = useQuery(api.invites.myStatus, {});
  const redeem = useMutation(api.invites.redeem);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const attemptedPendingCode = useRef(false);

  // First-password setup may finish before the newly issued auth token has
  // propagated to the Convex client. In that narrow case the login screen
  // leaves the invite code in sessionStorage and this authenticated surface
  // consumes it once. The code is removed on success and never persisted
  // beyond the browser tab.
  useEffect(() => {
    if (attemptedPendingCode.current || status === undefined || status.linked) return;
    const pendingCode = window.sessionStorage.getItem("firstcontact.pendingInviteCode");
    if (!pendingCode) return;
    attemptedPendingCode.current = true;
    void redeem({ code: pendingCode })
      .then(() => {
        window.sessionStorage.removeItem("firstcontact.pendingInviteCode");
        setDone(true);
      })
      .catch((caught) => setError(messageFor(caught)));
  }, [redeem, status]);

  // Undefined while loading, and hidden entirely once the account is linked —
  // there is nothing left to redeem at that point.
  if (status === undefined || status.linked) return null;

  // `myStatus` will report `linked` on its next update and unmount this panel;
  // until it does, the confirmation stands in for it so the form does not sit
  // there looking as though nothing happened.
  if (done) {
    return (
      <p className="invite-redeemed">
        <Check size={15} /> Your invite has been redeemed.
      </p>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Checked locally first so an obvious typo does not need a round trip.
    // The server re-normalises regardless; this is convenience, not validation.
    if (!normaliseInviteCode(code)) {
      setError(MESSAGES.INVITE_MALFORMED!);
      return;
    }

    setPending(true);
    try {
      await redeem({ code });
      setDone(true);
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="invite-redeem" onSubmit={onSubmit}>
      <div>
        <strong>Have an invite code?</strong>
        <p>
          If you filled in the join form, you were given a code. Entering it links this account to
          what you told us then, so you do not have to repeat it.
        </p>
      </div>
      <div className="invite-redeem-row">
        <label className="visually-hidden" htmlFor="invite-code">
          Invite code
        </label>
        <input
          id="invite-code"
          name="code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="FC-XXXXX-XXXXX"
          autoComplete="off"
          spellCheck={false}
          disabled={pending}
        />
        <button type="submit" disabled={pending || code.trim() === ""}>
          {pending ? "Checking…" : "Redeem"}
        </button>
      </div>
      {error ? (
        <p className="auth-error" role="alert">
          <AlertTriangle size={15} /> {error}
        </p>
      ) : null}
    </form>
  );
}
