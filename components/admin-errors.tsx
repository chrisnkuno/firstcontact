"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Check, CircleCheck, Loader2, RotateCcw } from "lucide-react";
import { api } from "@/convex/_generated/api";

/**
 * Operator view of captured errors.
 *
 * Every message here has already been redacted before storage, so this screen
 * cannot leak anything the database does not already hold — but it is still
 * behind admin step-up, because error text is an excellent map of where a
 * system is weak.
 */

function since(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AdminErrors() {
  const [includeResolved, setIncludeResolved] = useState(false);
  const summary = useQuery(api.observability.errorSummary);
  const errors = useQuery(api.observability.listErrors, { includeResolved });
  const resolve = useMutation(api.observability.resolveError);
  const [pending, setPending] = useState<string | null>(null);

  if (summary === undefined || errors === undefined) {
    return <p className="dashboard-loading">Loading errors…</p>;
  }

  async function toggle(errorId: string, resolved: boolean) {
    setPending(errorId);
    try {
      await resolve({
        errorId: errorId as Parameters<typeof resolve>[0]["errorId"],
        resolved,
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="workspace">
      <header className="workspace-head">
        <h1>Errors</h1>
        <p>
          Captured from browsers and Convex functions, redacted before storage and grouped so a
          repeat increments a count rather than adding a row. An alert email goes out when three or
          more distinct problems appear within an hour.
        </p>
      </header>

      <section className="error-summary">
        <div>
          <span>LAST HOUR</span>
          <b>{summary.lastHourProblems}</b>
          <small>distinct problems</small>
        </div>
        <div>
          <span>LAST HOUR</span>
          <b>{summary.lastHourOccurrences}</b>
          <small>total occurrences</small>
        </div>
        <div>
          <span>LAST 24H</span>
          <b>{summary.last24hProblems}</b>
          <small>distinct problems</small>
        </div>
        <div>
          <span>OPEN</span>
          <b>{summary.unresolved}</b>
          <small>unresolved</small>
        </div>
      </section>

      <label className="error-toggle">
        <input
          type="checkbox"
          checked={includeResolved}
          onChange={(event) => setIncludeResolved(event.target.checked)}
        />
        Show resolved
      </label>

      {errors.length === 0 ? (
        <section className="workspace-section">
          <p className="workspace-empty">
            <CircleCheck size={15} /> Nothing captured. This is the state you want — it is not an
            empty placeholder, it means no error has been reported.
          </p>
        </section>
      ) : (
        <ul className="error-list">
          {errors.map((error) => (
            <li key={error.id} className={error.resolvedAt ? "error-resolved" : undefined}>
              <div className="error-meta">
                <span className={`error-source error-source-${error.source}`}>{error.source}</span>
                <code>{error.route}</code>
                {error.actorRole && <span className="workspace-tag">{error.actorRole}</span>}
                <span className="error-count">
                  ×{error.count} · last {since(error.lastSeenAt)}
                </span>
              </div>

              <p className="error-message">
                {error.resolvedAt ? <Check size={14} /> : <AlertTriangle size={14} />}
                {error.message}
              </p>

              <button
                className="button"
                type="button"
                disabled={pending !== null}
                onClick={() => toggle(error.id, error.resolvedAt === null)}
              >
                {pending === error.id ? (
                  <Loader2 size={14} className="spin" />
                ) : error.resolvedAt ? (
                  <RotateCcw size={14} />
                ) : (
                  <Check size={14} />
                )}
                {error.resolvedAt ? "Reopen" : "Mark resolved"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
