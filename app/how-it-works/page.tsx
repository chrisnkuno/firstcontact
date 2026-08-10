import Link from "next/link";
import type { Metadata } from "next";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = {
  title: "How it works",
  description: "From local context to global signal: the four-step model behind FirstContact, and what is real versus preview today.",
};

export default function HowItWorksPage() {
  return (
    <DocumentPage
      eyebrow="01 / THE MODEL"
      title="From local context to global signal."
      intro="Automation does the research and repetitive work. People retain agency at every consequential step. Here is what actually happens at each stage, and what is live versus a labeled preview today."
    >
      <h2>01 · Tell the whole story</h2>
      <p>
        Founders share traction, context, ambition, and the local truths a deck often leaves out — the market realities, financing
        structures, or access constraints that someone outside the ecosystem would otherwise miss. This becomes the shared record every
        later step draws on.
      </p>
      <p>
        <strong>Real today:</strong> the <Link href="/signup">/signup</Link> questionnaire persists a real, deduplicated interest record
        to Convex, validated against the shared contract in <code>lib/domain.ts</code>.
      </p>

      <h2>02 · Map aligned capital</h2>
      <p>
        Exa discovers firms and decision-makers across capital regions. Every claim carries a source URL and capture time; every match
        carries a plain-language reason from deterministic, inspectable scoring — not an opaque score a model invented.
      </p>
      <p>
        <strong>Status:</strong> without an Exa key, <code>outreach:discover</code> reports that discovery is unconfigured and returns nothing. With a key, it returns
        live source results that still require normalization and human review before they become reviewed investor records.
      </p>

      <h2>03 · Approve the approach</h2>
      <p>
        A model can draft a specific introduction from supplied facts, but the founder reviews the exact recipient, the exact evidence,
        and the exact message before anything leaves. Nothing sends merely because a model suggested it.
      </p>
      <p>
        <strong>Status:</strong> drafting requires <code>OPENAI_API_KEY</code>; sending requires an explicit outbound flag, approval, and
        the full policy gate described on <Link href="/responsible-outreach">Responsible outreach</Link>.
      </p>

      <h2>04 · Learn from signals</h2>
      <p>
        Delivery, replies, meetings, and passes become transparent pipeline events — not vanity metrics. The same numbers that describe
        what happened also feed forward into planning: see the <Link href="/plan">outreach planner</Link> for how raise targets translate
        into a specific weekly contact number.
      </p>
      <p className="document-intro" style={{ marginTop: 32 }}>
        Want the fuller technical picture? Read <Link href="/system">the system</Link>, or see{" "}
        <a href="https://github.com/chrisnkuno/firstcontact#what-works-today" target="_blank" rel="noreferrer">
          what works today
        </a>{" "}
        in the README.
      </p>
    </DocumentPage>
  );
}
