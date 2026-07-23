import type { Metadata } from "next";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <DocumentPage
      eyebrow="POLICY / TERMS"
      title="A transparent platform, not a promise of funding."
      intro="FirstContact is an open-source, early-stage product. It does not provide investment, legal, brokerage, or fundraising advice."
    >
      <h2>Signup and access</h2>
      <p>
        You must provide accurate information you are authorised to share.
        Signup records interest and does not guarantee an account, catalogue
        publication, investor introduction, funding, or a response by a
        particular date. We may prioritise, pause, or decline access to protect
        users and platform integrity.
      </p>
      <h2>Preview boundaries</h2>
      <p>
        The public catalogue, matches, metrics, drafts, and workspace examples
        remain fictional unless explicitly identified otherwise. They are
        product demonstrations, not investment opportunities or completed
        outreach.
      </p>
      <h2>Responsible use</h2>
      <p>
        You may not conceal identity, resell contact data, evade legal or
        platform restrictions, automate abusive solicitation, misrepresent
        traction or relationships, discriminate using protected attributes, or
        imply guaranteed access to capital.
      </p>
      <h2>Open-source software</h2>
      <p>
        The source is available under the MIT License without warranty.
        Independent deployments are operated by their maintainers and may have
        different terms and privacy practices.
      </p>
      <h2>Investment decisions</h2>
      <p>
        Catalogue context and matching signals are starting points for
        independent diligence. Investors must verify material information, and
        organizations must assess investor fit and terms themselves.
      </p>
      <p><small>Last updated: 23 July 2026.</small></p>
    </DocumentPage>
  );
}
