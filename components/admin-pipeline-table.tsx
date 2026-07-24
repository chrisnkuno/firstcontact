"use client";

import { useState } from "react";
import type { AdminSignupRow, AdminSignupStatus } from "@/lib/admin-data";

const STATUSES: AdminSignupStatus[] = ["new", "reviewing", "invited", "active", "declined"];
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function AdminPipelineTable({ initialRows }: { initialRows: AdminSignupRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function changeStatus(id: string, status: AdminSignupStatus) {
    const previous = rows;
    setError("");
    setPendingId(id);
    setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)));

    try {
      const response = await fetch("/api/admin/pipeline/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signupId: id, status }),
      });
      const payload = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !payload.ok) throw new Error(payload.message || "Could not update this signup.");
    } catch (updateError) {
      setRows(previous);
      setError(updateError instanceof Error ? updateError.message : "Could not update this signup.");
    } finally {
      setPendingId(null);
    }
  }

  if (rows.length === 0) {
    return <p className="calc-note">No signups match this filter.</p>;
  }

  return (
    <div>
      {error && (
        <div className="form-error" role="alert" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Type</th>
              <th>Organization / role</th>
              <th>Goals</th>
              <th>Created</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>{row.accountType}</td>
                <td>{row.organizationName || row.individualRole || "—"}</td>
                <td>{row.goals.join(", ")}</td>
                <td>{dateFormat.format(new Date(row.createdAt))}</td>
                <td>
                  <select
                    value={row.status}
                    disabled={pendingId === row.id}
                    onChange={(event) => changeStatus(row.id, event.target.value as AdminSignupStatus)}
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
    </div>
  );
}
