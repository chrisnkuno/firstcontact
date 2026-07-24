import Link from "next/link";
import type { Metadata } from "next";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = {
  title: "Principles",
  description: "Outreach without the growth-hack playbook: the four principles FirstContact is built on.",
};

export default function PrinciplesPage() {
  return (
    <DocumentPage
      eyebrow="03 / BUILT DIFFERENTLY"
      title="Outreach without the growth-hack playbook."
      intro="Cold outreach has a bad reputation because most tools optimize for volume over judgment. These four principles are the constraints that keep FirstContact from becoming another blast tool."
    >
      <h2>01 · Evidence before inference</h2>
      <p>
        Investor mandates, portfolio patterns, and contact details remain linked to their public source and discovery date. A claim
        without a source is treated as unverified, not as fact. This is what lets a founder trust a match reason instead of taking it on
        faith.
      </p>

      <h2>02 · Permission at the edge</h2>
      <p>
        No hidden auto-send. Live email requires operator enablement, policy checks, suppression screening, and a specific human
        approval of the exact recipient and exact message — every time, not just the first time. See{" "}
        <Link href="/responsible-outreach">Responsible outreach</Link> for the full gate list.
      </p>

      <h2>03 · Founders own the narrative</h2>
      <p>
        AI can structure and draft, but it cannot invent traction, impersonate a founder, or overwrite their context. The founder&apos;s own
        words about their traction, impact, and local context stay theirs — a model&apos;s job is to organize them, not replace them.
      </p>

      <h2>04 · Open by default</h2>
      <p>
        Portable data, inspectable scoring, replaceable providers, and documentation deep enough to run independently. Every provider —
        Exa, OpenAI, Resend — is an adapter behind a boundary, not a dependency baked into the product&apos;s identity.
      </p>

      <p className="document-intro" style={{ marginTop: 32 }}>
        These principles are enforced in code, not just stated: see <Link href="/system">the system</Link> for how each layer fails
        closed, or read <Link href="/how-it-works">how it works</Link> end to end.
      </p>
    </DocumentPage>
  );
}
