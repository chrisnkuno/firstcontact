"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GuidancePanel } from "@/components/onboarding";

const STATUSES = ["new", "reviewing", "invited", "active", "declined"] as const;
type Status = (typeof STATUSES)[number];

/**
 * The intake pipeline.
 *
 * Status changes write an audit entry naming the operator who made them — the
 * reason `updateSignupStatus` is a mutation on the admin module rather than a
 * generic patch. Optimistic UI is deliberately not used here: a status change
 * is a consequential, recorded act, and showing it as applied before Convex
 * confirms would mean the screen and the audit log could disagree.
 */
export function AdminPipelineTable() {
  const [filter, setFilter] = useState<Status | "all">("all");
  const rows = useQuery(api.admin.listSignups, {
    status: filter === "all" ? undefined : filter,
    limit: 200,
  });
  const updateStatus = useMutation(api.admin.updateSignupStatus);
  const revokeInvite = useMutation(api.invites.revoke);
  const reissueInvite = useMutation(api.invites.reissue);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  return (
    <>
      <div className="dashboard-head">
        <div>
          <span>OPERATOR / PIPELINE</span>
          <h1>Intake pipeline</h1>
          <p>Every status change is recorded against your account in the audit log.</p>
        </div>
        <div className="pipeline-filters">
          <button
            type="button"
            className="chart-toggle"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            ALL
          </button>
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className="chart-toggle"
              aria-pressed={filter === status}
              onClick={() => setFilter(status)}
            >
              {status.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <GuidancePanel id="admin.pipeline-pii" title="This screen shows personal data">
        <p>
          Names, emails and locations belong to real people who submitted them in confidence. Read
          what you need for the decision in front of you, and nothing else.
        </p>
        <p>
          Invite codes are live credentials. A code only works for the address it was issued to, so
          it is useless to anyone else — but pass it to that person directly rather than anywhere it
          would be stored or forwarded, and withdraw it if it goes astray.
        </p>
      </GuidancePanel>

      {rows === undefined ? (
        <p className="dashboard-loading">Loading pipeline…</p>
      ) : rows.length === 0 ? (
        <div className="chart-empty">
          <strong>No records{filter === "all" ? "" : ` with status “${filter}”`}</strong>
          <span>Interest submissions appear here as they arrive.</span>
        </div>
      ) : (
        <div className="chart-table-wrap">
          <table className="chart-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Type</th>
                <th scope="col">Location</th>
                <th scope="col">Account</th>
                <th scope="col">Invite code</th>
                <th scope="col">Submitted</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    {row.name}
                    <small>{row.email}</small>
                  </th>
                  <td>{row.organizationName ?? row.accountType}</td>
                  <td>{row.location}</td>
                  <td>{row.hasAccount ? "Yes" : "—"}</td>
                  <td>
                    <InviteCell
                      invite={row.invite}
                      busy={busy === row.id}
                      copied={copied === row.id}
                      onCopy={async (code) => {
                        // Clipboard access can be refused outright (insecure
                        // context, or a browser that simply says no). Failing
                        // silently would leave the operator believing they had
                        // copied a code they had not, so the code stays on
                        // screen to be read manually either way.
                        try {
                          await navigator.clipboard.writeText(code);
                          setCopied(row.id);
                          window.setTimeout(() => setCopied(null), 2000);
                        } catch {
                          setCopied(null);
                        }
                      }}
                      onRevoke={async (inviteId) => {
                        setBusy(row.id);
                        try {
                          await revokeInvite({ inviteId });
                        } finally {
                          setBusy(null);
                        }
                      }}
                      onReissue={async () => {
                        setBusy(row.id);
                        try {
                          await reissueInvite({ signupId: row.id });
                        } finally {
                          setBusy(null);
                        }
                      }}
                    />
                  </td>
                  <td>{new Date(row.createdAt).toLocaleDateString()}</td>
                  <td>
                    <select
                      value={row.status}
                      disabled={busy === row.id}
                      onChange={async (event) => {
                        setBusy(row.id);
                        try {
                          await updateStatus({
                            signupId: row.id,
                            status: event.target.value as Status,
                          });
                        } finally {
                          setBusy(null);
                        }
                      }}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

type InviteView = {
  id: Id<"accountInvites">;
  state: "live" | "redeemed" | "revoked" | "expired";
  code: string | null;
  expiresAt: number;
} | null;

/**
 * One row's invite.
 *
 * A live code is shown in full, because being readable is the entire point —
 * there is no email provider configured to deliver it, so the operator passing
 * it on by hand is the delivery mechanism. Every other state shows only what
 * happened, never the code.
 */
function InviteCell({
  invite,
  busy,
  copied,
  onCopy,
  onRevoke,
  onReissue,
}: {
  invite: InviteView;
  busy: boolean;
  copied: boolean;
  onCopy: (code: string) => void;
  onRevoke: (inviteId: Id<"accountInvites">) => void;
  onReissue: () => void;
}) {
  if (!invite) {
    return (
      <div className="invite-cell">
        <span className="invite-state">None</span>
        <button type="button" className="auth-link" disabled={busy} onClick={onReissue}>
          Issue
        </button>
      </div>
    );
  }

  if (invite.state === "live" && invite.code) {
    return (
      <div className="invite-cell">
        <code className="invite-code">{invite.code}</code>
        <div className="invite-actions">
          <button type="button" className="auth-link" onClick={() => onCopy(invite.code!)}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            className="auth-link"
            disabled={busy}
            onClick={() => onRevoke(invite.id)}
          >
            Withdraw
          </button>
        </div>
        <small>Expires {new Date(invite.expiresAt).toLocaleDateString()}</small>
      </div>
    );
  }

  return (
    <div className="invite-cell">
      <span className="invite-state">
        {invite.state === "redeemed"
          ? "Redeemed"
          : invite.state === "revoked"
            ? "Withdrawn"
            : "Expired"}
      </span>
      {invite.state === "redeemed" ? null : (
        <button type="button" className="auth-link" disabled={busy} onClick={onReissue}>
          Reissue
        </button>
      )}
    </div>
  );
}
