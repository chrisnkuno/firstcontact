"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { AlertTriangle, Check, Loader2, Save } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { DashboardShell, type Viewer } from "@/components/dashboard-shell";
import {
  INVESTOR_TYPE_LABELS,
  investorTypes,
  participantKinds,
  type InvestorType,
  type ParticipantKind,
} from "@/lib/domain";

/**
 * Account profile editing, for participants and investors.
 *
 * The onboarding checklist has always linked here; until now the routes did not
 * exist, so the first action the product asked a new account to take was a dead
 * link on both sides.
 *
 * Role is deliberately absent from this form. Changing what an account *is* —
 * participant to investor, anyone to admin — is an operator action with an
 * audit entry, not a self-service field; `users.updateProfile` ignores role
 * entirely and clamps the role-specific fields to the role the account already
 * has.
 */

const PARTICIPANT_KIND_LABELS: Record<ParticipantKind, string> = {
  startup: "A startup raising capital",
  institution: "An institution or cooperative",
  individual: "An individual",
};

type SaveState = "idle" | "saving" | "saved" | "error";

function ProfileForm({ viewer }: { viewer: Viewer }) {
  const updateProfile = useMutation(api.users.updateProfile);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setState("saving");
    setError(null);

    try {
      await updateProfile({
        name: String(form.get("name") ?? ""),
        organizationName: String(form.get("organizationName") ?? ""),
        location: String(form.get("location") ?? ""),
        ...(viewer.role === "investor"
          ? { investorType: String(form.get("investorType") ?? "") as InvestorType }
          : {}),
        ...(viewer.role === "participant"
          ? { participantKind: String(form.get("participantKind") ?? "") as ParticipantKind }
          : {}),
      });
      setState("saved");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your profile.");
      setState("error");
    }
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <span>ACCOUNT / PROFILE</span>
      <h1>Your profile</h1>
      <p>
        These details identify you across the platform. Your email is your login and cannot be
        changed here.
      </p>

      <label>
        Email
        <input type="email" value={viewer.email ?? ""} readOnly disabled />
        <small>Contact the operators to change the address on an account.</small>
      </label>

      <label>
        Your name
        <input
          name="name"
          type="text"
          defaultValue={viewer.name ?? ""}
          autoComplete="name"
          minLength={2}
          maxLength={100}
          required
        />
      </label>

      {viewer.role === "participant" && (
        <label>
          What are you joining as?
          <select name="participantKind" defaultValue={viewer.participantKind ?? "startup"}>
            {participantKinds.map((kind) => (
              <option key={kind} value={kind}>
                {PARTICIPANT_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </label>
      )}

      {viewer.role === "investor" && (
        <label>
          What kind of investor are you?
          <select name="investorType" defaultValue={viewer.investorType ?? "angel"}>
            {investorTypes.map((type: InvestorType) => (
              <option key={type} value={type}>
                {INVESTOR_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <small>This decides which metrics your dashboard leads with.</small>
        </label>
      )}

      <label>
        Organization <em>(optional)</em>
        <input
          name="organizationName"
          type="text"
          defaultValue={viewer.organizationName ?? ""}
          maxLength={120}
          autoComplete="organization"
        />
      </label>

      <label>
        Where are you based? <em>(optional)</em>
        <input name="location" type="text" defaultValue={viewer.location ?? ""} maxLength={120} />
      </label>

      {state === "error" && error && (
        <p className="auth-error" role="alert">
          <AlertTriangle size={15} /> {error}
        </p>
      )}

      <button className="button button-dark" type="submit" disabled={state === "saving"}>
        {state === "saving" ? <Loader2 size={15} className="spin" /> : <Save size={15} />}
        {state === "saving" ? "Saving" : "Save profile"}
      </button>

      {/* Announced politely so a screen reader hears the outcome without the
          save button stealing focus back. */}
      <p className="profile-saved" role="status" aria-live="polite">
        {state === "saved" ? (
          <>
            <Check size={14} /> Saved.
          </>
        ) : (
          ""
        )}
      </p>
    </form>
  );
}

export function ParticipantProfilePage() {
  return (
    <DashboardShell
      allow={["participant"]}
      label="PARTICIPANT"
      nav={
        <>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/dashboard/organization">Organization</Link>
          <Link href="/plan">Planner</Link>
        </>
      }
    >
      {(viewer) => <ProfileForm viewer={viewer} />}
    </DashboardShell>
  );
}

export function InvestorProfilePage() {
  return (
    <DashboardShell
      allow={["investor"]}
      label="INVESTOR"
      nav={
        <>
          <Link href="/investor">Dashboard</Link>
          <Link href="/catalogue">Catalogue</Link>
          <Link href="/pacing">Pacing</Link>
        </>
      }
    >
      {(viewer) => <ProfileForm viewer={viewer} />}
    </DashboardShell>
  );
}
