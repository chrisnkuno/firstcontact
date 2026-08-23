import type { Metadata } from "next";
import Link from "next/link";
import { DocumentPage } from "@/components/document-page";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage() {
  return <DocumentPage eyebrow="TRUST / SECURITY" title="Treat every boundary as untrusted." intro="FirstContact uses layered controls around identity, tenant data, public input, providers, and irreversible actions.">
    <h2>Application and data controls</h2>
    <ul>
      <li>Convex&apos;s typed validators and indexed document queries are used instead of raw SQL; there is no raw SQL execution surface for classic SQL injection.</li>
      <li>Authorization is enforced in server functions from the authenticated identity, with per-organization membership checks before protected reads or writes.</li>
      <li>Operator reads and writes require TOTP step-up for the current session, and repeated TOTP guesses are rate-limited.</li>
      <li>Passwords use Convex Auth&apos;s provider-managed hashing. Provider keys and webhook secrets stay in server-side deployment variables.</li>
      <li>Public JSON bodies are schema-validated, size-bounded, origin-checked where browser access is expected, and rate-limited before durable writes or paid provider calls.</li>
    </ul>
    <h2>Browser and delivery controls</h2>
    <ul>
      <li>Vercel sends CSP, HSTS, clickjacking, MIME-sniffing, referrer, permissions, and cross-origin security headers.</li>
      <li>React escapes user text; the only inline HTML sink is a fixed, source-controlled theme bootstrap script containing no user or provider data.</li>
      <li>Resend webhook events are verified over the raw body, time-bounded, and deduplicated before processing.</li>
      <li>Outbound messages require recorded human approval, source and jurisdiction checks, suppression checks, postal identity, HTTPS unsubscribe handling, an atomic send reservation, and a provider idempotency key.</li>
    </ul>
    <h2>AI and research boundaries</h2>
    <p>Web content and model output are untrusted. Research remains source-linked, model-produced claims require human review before becoming contact records, and drafts require a separate approval before delivery. Provider output never grants tool authority.</p>
    <h2>Limits and reporting</h2>
    <p>No application is perfectly secure. Static browser sessions cannot use server-issued HttpOnly cookies, so admin MFA is an important compensating control. Do not publish exploit details or personal data in a public issue. Use the repository&apos;s private vulnerability-reporting channel, or use the <Link href="/account/privacy">authenticated privacy center</Link> for a data concern.</p>
  </DocumentPage>;
}
