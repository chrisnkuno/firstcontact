import Link from "next/link";
import type { Metadata } from "next";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = {
  title: "The system",
  description: "One clear path, four accountable layers: discover, interpret, control, learn — and which providers back each one.",
};

export default function SystemPage() {
  return (
    <DocumentPage
      eyebrow="02 / THE SYSTEM"
      title="One clear path. Four accountable layers."
      intro="Each provider has one job. Each transition leaves evidence. Nothing sends merely because a model suggested it — the full invariants are documented in docs/ARCHITECTURE.md."
    >
      <h2>01 · Discover — search the public record</h2>
      <p>
        Exa maps firms, people, mandates, portfolios, and current thesis evidence across four capital regions (US, UK, EU, APAC). Results
        are evidence candidates, not verified contacts — a production deployment normalizes domains, deduplicates firms, and flags
        ambiguous contact types for review before anything is treated as a reviewed record.
      </p>

      <h2>02 · Interpret — explain the fit</h2>
      <p>
        Deterministic scoring in <code>lib/matching.ts</code> stays inspectable: every match keeps its reasons and risks. A model (GPT-5
        nano) can supplement this with drafting and classification, but it cannot erase source-based reasoning or invent a score from
        nothing.
      </p>

      <h2>03 · Control — people hold the edge</h2>
      <p>
        Approval, jurisdiction, identity, suppression, and rate-limit gates all fail closed. <code>outreach:sendApproved</code> requires an
        explicit outbound flag, operator token, approved message, public source, reviewed jurisdiction, clear suppression check, sender
        postal identity, unsubscribe link, and a stable idempotency key — see{" "}
        <Link href="/responsible-outreach">Responsible outreach</Link> for the full list.
      </p>

      <h2>04 · Learn — a pipeline, not a blast</h2>
      <p>
        Resend delivery events and replies become an auditable history a founder can act on, instead of a fire-and-forget blast.
        Suppressions and complaints are meant to feed straight back into the control layer before any further scheduling.
      </p>

      <h2>What is real versus preview right now</h2>
      <ul>
        <li>Real and persisted: signup records, catalogue &ldquo;Express interest&rdquo; signals, and the aggregate honest counts shown across the site.</li>
        <li>Live when configured: Exa discovery, GPT-5 nano drafting, and UI translation — each falls back to a clearly labeled sample or echo, never a fabricated result, when its provider key is absent.</li>
        <li>Preview by design: workspace and catalogue records, matches, and pipeline events are fictional demonstration data until authenticated multi-tenant accounts are wired up.</li>
        <li>Fail-closed until activated: outbound email, gated behind an explicit flag, operator token, and the full policy check.</li>
      </ul>

      <p className="document-intro" style={{ marginTop: 32 }}>
        See the numbers side of the system in the <Link href="/plan">founder planner</Link> or{" "}
        <Link href="/pacing">investor pacing tool</Link>, or read the full{" "}
        <a href="https://github.com/chrisnkuno/firstcontact" target="_blank" rel="noreferrer">
          architecture documentation
        </a>
        .
      </p>
    </DocumentPage>
  );
}
