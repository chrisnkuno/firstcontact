import type { Metadata } from "next";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <DocumentPage
      eyebrow="POLICY / PRIVACY"
      title="Collect less. Explain more. Delete responsibly."
      intro="FirstContact keeps participation context useful without turning founder or investor data into a commodity."
    >
      <h2>Signup records</h2>
      <p>
        The hosted signup stores the information you submit—including your name,
        email, location, role or organization context, participation goals, and
        optional update preference—in the project&apos;s Convex database. We use
        it to understand demand, review participation, prioritise access, and
        contact you about the FirstContact flow you selected.
      </p>
      <h2>What signup does not do</h2>
      <p>
        A signup does not publish a catalogue profile, initiate investor
        research, create outreach, or share private details with another user.
        Each of those steps requires a separate, visible decision.
      </p>
      <h2>Data boundaries</h2>
      <ul>
        <li>Private intake context stays separate from outreach-approved claims.</li>
        <li>Catalogue publication requires approval for the exact public fields.</li>
        <li>Investor interest reveals no private contact data until accepted.</li>
        <li>Contact sources, corrections, objections, and suppressions remain auditable.</li>
        <li>Contact data is never sold or contributed through the repository.</li>
      </ul>
      <h2>Retention and requests</h2>
      <p>
        Signup records are reviewed periodically and should not be kept longer
        than needed for access management. Until a dedicated privacy inbox is
        published, you can request access, correction, or deletion by replying
        to any FirstContact access message you receive. Do not post personal
        information in a public GitHub issue.
      </p>
      <h2>Independent deployments</h2>
      <p>
        Operators running their own copy are responsible for their own privacy
        notice, lawful basis, retention, data-subject requests, international
        transfers, provider agreements, and security controls.
      </p>
      <p>
        <small>Last updated: 23 July 2026. This is operational guidance, not legal advice.</small>
      </p>
    </DocumentPage>
  );
}
