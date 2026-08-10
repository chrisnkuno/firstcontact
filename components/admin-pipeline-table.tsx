"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
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
  const [busy, setBusy] = useState<string | null>(null);

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
