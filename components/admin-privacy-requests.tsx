"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";

type Status = "submitted" | "in_review" | "completed" | "denied" | "cancelled";

export function AdminPrivacyRequests() {
  const [status, setStatus] = useState<Status>("submitted");
  const rows = useQuery(api.privacy.listRequests, { status });
  const resolveRequest = useMutation(api.privacy.resolveRequest);
  const [busy, setBusy] = useState<string | null>(null);

  async function update(requestId: string, next: "in_review" | "completed" | "denied", response: string) {
    setBusy(requestId);
    try { await resolveRequest({ requestId: requestId as never, status: next, response }); }
    finally { setBusy(null); }
  }

  return <section className="admin-panel privacy-admin-panel">
    <header><div><span>DATA PROTECTION / REQUESTS</span><h1>Privacy request queue</h1></div><ShieldCheck size={22} /></header>
    <p>Identity is account-verified. Review linked and shared records before closing or deleting anything.</p>
    <div className="admin-filter-row" role="group" aria-label="Request status">
      {(["submitted", "in_review", "completed", "denied", "cancelled"] as const).map((item) => <button type="button" key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>{item.replace("_", " ")}</button>)}
    </div>
    {rows === undefined ? <p><Loader2 className="spin" size={15} /> Loading requests…</p> : rows.length === 0 ? <p>No {status.replace("_", " ")} requests.</p> : <div className="privacy-admin-list">{rows.map(({ request, userEmail, userName }) => <article key={request._id}>
      <header><div><b>{request.kind}</b><small>{request.jurisdiction} · {new Date(request.submittedAt).toLocaleString()}</small></div><span className="mode-badge">{request.status.replace("_", " ")}</span></header>
      <p><strong>{userName ?? "Unnamed account"}</strong> · {userEmail ?? "No email"}</p>
      {request.details && <p>{request.details}</p>}
      {request.response && <p><b>Operator response:</b> {request.response}</p>}
      {(request.status === "submitted" || request.status === "in_review") && <form onSubmit={(event) => {
        event.preventDefault(); const form = new FormData(event.currentTarget);
        void update(request._id, String(form.get("status")) as "in_review" | "completed" | "denied", String(form.get("response") ?? ""));
      }}>
        <label>Decision<select name="status" defaultValue={request.status === "submitted" ? "in_review" : "completed"}><option value="in_review">In review</option><option value="completed">Completed</option><option value="denied">Denied</option></select></label>
        <label>Response<textarea name="response" maxLength={4000} rows={3} placeholder="Required when completing or denying." /></label>
        <button className="button button-dark" type="submit" disabled={busy === request._id}>{busy === request._id ? "Saving" : "Save status"}</button>
      </form>}
    </article>)}</div>}
  </section>;
}
