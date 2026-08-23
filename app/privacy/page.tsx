import type { Metadata } from "next";
import Link from "next/link";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = {
  title: "Privacy and data protection",
  description: "How FirstContact collects, uses, protects, retains, and responds to requests about personal data.",
};

export default function PrivacyPage() {
  return <DocumentPage eyebrow="POLICY / PRIVACY" title="Privacy and data protection" intro="One global protection baseline, with regional rights for people in the US, UK, EU/EEA, and APAC.">
    <p><strong>Effective 23 August 2026.</strong> This notice applies to the hosted FirstContact service. FirstContact, as operator of this deployment, determines why and how account and participation data is processed. Independent deployments are separate controllers.</p>
    <p><Link className="button button-dark" href="/account/privacy">Open your privacy center</Link></p>

    <h2>What we collect</h2>
    <ul>
      <li><strong>Account:</strong> name, email, role, optional organization and location, authentication and security records.</li>
      <li><strong>Participation:</strong> application answers, goals, target regions, startup or investor context, and consent timestamps.</li>
      <li><strong>Platform activity:</strong> organization membership, profiles you manage, investor-interest records, approvals, corrections, objections, and audit events.</li>
      <li><strong>Operational security:</strong> rate-limit identifiers, delivery events, redacted errors, and limited request metadata. Passwords are stored only as provider-managed hashes; MFA secrets are never shown in data exports.</li>
    </ul>
    <p>Please do not enter government identifiers, health data, precise financial-account data, or other sensitive personal information into free-text fields.</p>

    <h2>Why we use it</h2>
    <p>We process account and service data to provide the service and fulfil our agreement with you; participation data with your consent and to take steps you request; security, fraud prevention, audit, and service improvement for legitimate interests and legal obligations; and optional product updates only where you chose them. You may withdraw consent without affecting earlier lawful processing.</p>

    <h2>Boundaries and automated tools</h2>
    <ul>
      <li>A signup does not publish a profile, begin outreach, or share private contact details.</li>
      <li>Catalogue publication and outreach require separate, recorded human approval and policy gates.</li>
      <li>Matching and research tools provide suggestions; they do not make final funding, access, or legal decisions.</li>
      <li>We do not sell personal data, share it for cross-context behavioural advertising, or use targeted advertising.</li>
    </ul>

    <h2>Providers and international processing</h2>
    <p>Convex provides the production database, authentication, and server functions; Vercel serves the web application; and Resend sends transactional account email. Optional research or drafting adapters are used only when an operator deliberately activates them. Providers receive only data needed for their task. Data may be processed outside your country, so the operator must maintain appropriate provider terms and transfer safeguards where the law requires them. This notice does not claim that a particular transfer agreement or adequacy mechanism exists unless the operator has actually completed it.</p>

    <h2>Retention and security</h2>
    <p>Unsuccessful, unlinked intake records in new, reviewing, or declined status are automatically removed after 24 months by default. Resolved operational errors are removed after 90 days. Active accounts, accepted participation records, security evidence, suppression records, and audit trails are retained while needed for the service, safety, legal claims, and accountability, then reviewed for deletion or de-identification. Legal holds can override routine deletion.</p>
    <p>Controls include role- and organization-scoped access, server-side authorization, admin MFA step-up, encrypted provider transport and storage, hashed credentials and suppression identifiers, bounded reads, audit trails, retention jobs, redacted errors, and secrets kept outside public browser configuration. No system can promise absolute security.</p>

    <h2>Your controls</h2>
    <p>Signed-in users can immediately download a machine-readable account-data copy and submit tracked requests for access, correction, deletion, restriction, objection, or appeal in the <Link href="/account/privacy">privacy center</Link>. We verify requests through the account and may ask for additional proof. Deletion is not instantaneous: shared organization data, fraud prevention, legal duties, disputes, and audit integrity may require restriction or partial retention instead. We explain a denial and preserve the ability to appeal.</p>

    <h2>Regional supplements</h2>
    <h3>EU/EEA</h3>
    <p>Where the GDPR applies, rights may include information, access, rectification, erasure, restriction, portability, objection, withdrawal of consent, and a complaint to your supervisory authority. We aim to respond without undue delay and ordinarily within one month. Contract, consent, legal obligation, and legitimate interests are used only where appropriate to the stated purpose. See the <a href="https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en">European Commission&apos;s individual-rights guidance</a>.</p>
    <h3>United Kingdom</h3>
    <p>Where UK data protection law applies, equivalent rights include access, correction, erasure, restriction, portability, objection, and protections concerning automated decisions. You may complain to the ICO. See the <a href="https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/">ICO&apos;s rights guidance</a>.</p>
    <h3>United States</h3>
    <p>State rights vary and applicability can depend on residency and statutory thresholds. Where applicable, we support requests to know or access, correct, delete, obtain a portable copy, opt out, limit certain sensitive-data uses, and appeal, without discrimination. Because FirstContact does not sell personal data or use it for targeted advertising, an opt-out signal does not switch off a practice that is occurring. California residents can review the <a href="https://oag.ca.gov/privacy/ccpa">California Attorney General&apos;s CCPA guidance</a>.</p>
    <h3>Asia-Pacific</h3>
    <p>APAC is not one jurisdiction. Subject to local applicability and exceptions, the same privacy center supports access, correction, deletion or erasure, objection or withdrawal, restriction, portability, and complaints. Relevant frameworks include Australia&apos;s Privacy Act and APPs, Singapore&apos;s PDPA, India&apos;s DPDP Act and phased 2025 Rules, Japan&apos;s APPI, and the Philippines&apos; Data Privacy Act. See official guidance from the <a href="https://www.oaic.gov.au/privacy/australian-privacy-principles/read-the-australian-privacy-principles">Australian OAIC</a>, <a href="https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act/data-protection-obligations">Singapore PDPC</a>, <a href="https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?hl=en-US">India MeitY</a>, <a href="https://www.ppc.go.jp/en/legal/">Japan PPC</a>, and the <a href="https://privacy.gov.ph/data-subject-rights/">Philippines NPC</a>.</p>

    <h2>Children, incidents, and complaints</h2>
    <p>FirstContact is intended for adults acting in a professional or business capacity and does not knowingly collect children&apos;s data. If you believe a child&apos;s data or another privacy or security issue is present, submit a deletion or objection request through the signed-in privacy center or reply to a transactional FirstContact email. Do not disclose personal data in a public GitHub issue. We assess incidents and notify people and regulators when applicable law requires it.</p>

    <h2>Changes and independent deployments</h2>
    <p>Material changes will be dated here and, where required, notified in-product or by email. A repository fork or independent deployment must publish its own controller identity, contact channel, lawful bases, retention schedule, processor list, transfer mechanism, and incident process.</p>
    <p><small>This operational notice describes the hosted product and is not legal advice or a certification that every regional law applies to the operator.</small></p>
  </DocumentPage>;
}
