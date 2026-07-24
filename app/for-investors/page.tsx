import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = {
  title: "For investors",
  description: "Browse beyond the usual network: context-rich profiles, plus a real math tool for pacing deal flow to a portfolio target.",
};

export default function ForInvestorsPage() {
  return (
    <DocumentPage
      eyebrow="FOR INVESTORS"
      title="Browse beyond the usual network."
      intro="Filter a curated flow by geography, stage, sector, and organization type. See strengths, open questions, context, and capital needs before expressing interest — never a hidden reputation score."
    >
      <h2>Start with the math</h2>
      <p>
        A portfolio target is a numbers-game problem too: how many companies do you need to review and meet to reach N investments a
        year, given your real conversion rates? The <Link href="/pacing">portfolio pacing tool</Link> runs that pipeline backward from
        your target to a specific weekly sourcing pace.
      </p>
      <p>
        <Link className="button button-dark" href="/pacing">
          Open the pacing tool <ArrowRight size={16} />
        </Link>
      </p>

      <h2>Then browse the catalogue</h2>
      <p>
        The VC catalogue demonstrates consent-based discovery: context-rich, founder-approved profiles instead of a purchased list.
        Expressing interest on a profile writes a real, deduplicated signal to Convex — it never reveals private founder contact data
        directly.
      </p>
      <p>
        <Link className="button button-outline-dark" href="/catalogue">
          Explore the VC catalogue <ArrowRight size={16} />
        </Link>
      </p>

      <h2>What you will not find here</h2>
      <ul>
        <li>No purchased contact lists or resold data — every profile is founder-approved for catalogue visibility.</li>
        <li>No opaque negative scoring — &ldquo;weaknesses&rdquo; are represented as founder-approved open questions, never a model-generated judgment.</li>
        <li>No private founder contact data before the organization accepts your interest.</li>
      </ul>

      <p className="document-intro" style={{ marginTop: 32 }}>
        Not signed up yet? <Link href="/signup">Join FirstContact</Link> — three minutes, no pitch deck needed.
      </p>
    </DocumentPage>
  );
}
