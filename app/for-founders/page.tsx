import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = {
  title: "For founders",
  description: "Control the pipeline: review matches, approve messages, choose catalogue visibility, and plan outreach with real math.",
};

export default function ForFoundersPage() {
  return (
    <DocumentPage
      eyebrow="FOR STARTUPS + INSTITUTIONS"
      title="Control the pipeline."
      intro="Review matches, approve specific messages, choose catalogue visibility, set campaign pace, and pause outreach at any time. Nothing goes out because a model suggested it."
    >
      <h2>Start with the math</h2>
      <p>
        Before you send a single message, know the number that actually matters: how many investor contacts your raise target requires,
        given realistic reply and conversion rates. The{" "}
        <Link href="/plan">outreach planner</Link> runs that funnel backward from your goal to a specific weekly contact number.
      </p>
      <p>
        <Link className="button button-dark" href="/plan">
          Open the outreach planner <ArrowRight size={16} />
        </Link>
      </p>

      <h2>Then work the workspace</h2>
      <p>
        The founder workspace demonstrates the control center: reviewing discovered investors, approving drafts before they send, and
        setting your own outreach pace. It runs on labeled preview data today — see{" "}
        <a href="https://github.com/chrisnkuno/firstcontact#preview-and-reference-implementation" target="_blank" rel="noreferrer">
          preview and reference implementation
        </a>{" "}
        for exactly what is real versus demonstration.
      </p>
      <p>
        <Link className="button button-outline-dark" href="/dashboard">
          Open founder workspace <ArrowRight size={16} />
        </Link>
      </p>

      <h2>What stays yours</h2>
      <ul>
        <li>Your traction, impact, and context stay in your own words — a model can structure them, not invent them.</li>
        <li>Nothing you submit at signup becomes a catalogue listing, investor match, or outbound message automatically.</li>
        <li>Catalogue visibility, campaign pace, and every send remain under your explicit approval.</li>
      </ul>

      <p className="document-intro" style={{ marginTop: 32 }}>
        Not signed up yet? <Link href="/signup">Join FirstContact</Link> — three minutes, no pitch deck needed.
      </p>
    </DocumentPage>
  );
}
