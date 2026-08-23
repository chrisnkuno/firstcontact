"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Download, Loader2, Send, ShieldCheck, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { DashboardShell } from "@/components/dashboard-shell";
import { privacyJurisdictions, privacyRequestKinds, privacyRequestSchema, type PrivacyRequestKind } from "@/lib/domain";

const KIND_LABELS: Record<PrivacyRequestKind, string> = {
  access: "Access my data", correction: "Correct my data", deletion: "Delete my data",
  restriction: "Restrict processing", objection: "Object to processing", appeal: "Appeal a decision",
};

function PrivacyControls() {
  const requests = useQuery(api.privacy.myRequests);
  const dataExport = useQuery(api.privacy.myDataExport);
  const submitRequest = useMutation(api.privacy.submitRequest);
  const cancelRequest = useMutation(api.privacy.cancelRequest);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function downloadExport() {
    if (!dataExport) return;
    const blob = new Blob([JSON.stringify(dataExport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `firstcontact-personal-data-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = privacyRequestSchema.safeParse({ kind: form.get("kind"), jurisdiction: form.get("jurisdiction"), details: form.get("details") });
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message ?? "Check the request details."); return; }
    setBusy(true); setMessage(null);
    try {
      await submitRequest(parsed.data);
      event.currentTarget.reset();
      setMessage("Request submitted. Its status will remain visible here.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The request could not be submitted.");
    } finally { setBusy(false); }
  }

  return <div className="privacy-center-grid">
    <section className="auth-card privacy-control-card">
      <span>ACCOUNT / DATA COPY</span><h1>Your privacy center</h1>
      <p>Download a machine-readable copy of personal data directly tied to your signed-in account.</p>
      <button className="button button-dark" type="button" onClick={downloadExport} disabled={!dataExport}>
        {!dataExport ? <Loader2 className="spin" size={15} /> : <Download size={15} />}
        {!dataExport ? "Preparing your copy" : "Download my data (JSON)"}
      </button>
      <small>Passwords, sessions, MFA secrets, and other people&apos;s private records are excluded for security.</small>
    </section>
    <form className="auth-card privacy-control-card" onSubmit={onSubmit}>
      <span>ACCOUNT / RIGHTS REQUEST</span><h2>Make a privacy request</h2>
      <p>Requests are linked to this verified account. Deletion is reviewed before any irreversible action.</p>
      <label>Request type<select name="kind" defaultValue="access">{privacyRequestKinds.map((kind) => <option value={kind} key={kind}>{KIND_LABELS[kind]}</option>)}</select></label>
      <label>Region whose law may apply<select name="jurisdiction" defaultValue="OTHER">{privacyJurisdictions.map((region) => <option value={region} key={region}>{region === "OTHER" ? "Other / not sure" : region}</option>)}</select></label>
      <label>Details <em>(optional)</em><textarea name="details" maxLength={2000} rows={5} placeholder="Tell us what you want corrected, restricted, or reviewed." /></label>
      <button className="button button-accent" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={15} /> : <Send size={15} />}{busy ? "Submitting" : "Submit request"}</button>
      {message && <p className="privacy-request-message" role="status">{message}</p>}
    </form>
    <section className="auth-card privacy-control-card privacy-request-history">
      <span>ACCOUNT / REQUEST HISTORY</span><h2>Your requests</h2>
      {requests === undefined ? <p><Loader2 className="spin" size={15} /> Loading…</p> : requests.length === 0 ? <p>No privacy requests yet.</p> : <ol>{requests.map((request) => <li key={request._id}>
        <div><ShieldCheck size={16} /><b>{KIND_LABELS[request.kind]}</b><span className="mode-badge">{request.status.replace("_", " ")}</span></div>
        <small>{new Date(request.submittedAt).toLocaleDateString()} · {request.jurisdiction}</small>
        {request.response && <p>{request.response}</p>}
        {request.status === "submitted" && <button type="button" onClick={() => void cancelRequest({ requestId: request._id })}><X size={14} /> Cancel</button>}
        {request.status === "completed" && <span className="privacy-complete"><Check size={14} /> Completed</span>}
      </li>)}</ol>}
    </section>
  </div>;
}

export function PrivacyCenterPage() {
  return <DashboardShell allow={["participant", "investor", "admin"]} label="ACCOUNT PRIVACY" nav={<><Link href="/privacy">Privacy policy</Link><Link href="/">Home</Link></>}>
    {() => <PrivacyControls />}
  </DashboardShell>;
}
