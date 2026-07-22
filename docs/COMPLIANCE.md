# Responsible outreach and privacy

> Engineering guidance, not legal advice. Operators are responsible for counsel and rules that apply to their entities, senders, recipients, and locations.

FirstContact’s product posture is **research broadly, contact narrowly**. A public web page can support a relevance finding; it does not automatically create permission to process or contact a person.

## Non-negotiable controls

- Outbound starts disabled.
- A human approves the exact recipient and exact message.
- Every investor fact and contact has a source and last-verified timestamp.
- Unknown recipient types are blocked.
- Named contacts require a documented jurisdiction and lawful-basis review.
- Suppression checks occur at approval time and again immediately before send.
- Every message identifies the sender, explains relevance, and offers one-step unsubscribe.
- Complaints, hard bounces, and opt-outs suppress future sends immediately.
- No purchased lists, contact-data resale, inbox rotation, identity concealment, or anti-spam evasion.
- No open/click tracking by default. Delivery and reply signals are sufficient for early product learning.

## Per-campaign review record

Record and version:

1. purpose and expected benefit;
2. why the processing and contact are necessary;
3. recipient category and applicable jurisdictions;
4. data categories, sources, and age;
5. reasonable expectations and likely impact;
6. safeguards, retention, objection, and deletion paths;
7. reviewer, date, decision, and expiry date.

The UK ICO explains that B2B electronic marketing rules differ between corporate and individual subscribers, while personal data remains subject to UK GDPR. It also recommends a do-not-contact list and a legitimate-interests assessment where that basis is used. See the [ICO B2B marketing guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/).

For US sends, implement CAN-SPAM requirements including accurate headers, non-deceptive subjects, physical address, opt-out notice, and timely opt-out handling. See the [FTC compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).

EU member states implement ePrivacy rules differently. “EU” is not one outbound policy. Build and maintain a country-level matrix with counsel before enabling sends. APAC likewise requires a country-specific assessment.

## Scraping and source handling

- Honor access controls, applicable terms, robots directives, deletion requests, and rate limits.
- Store only fields necessary for matching and contact review.
- Prefer organization inboxes and official submission channels over guessed personal addresses.
- Never infer protected attributes or use them for selection.
- Give operators a correction and deletion workflow.
- Re-verify stale records before a campaign; do not keep scraped personal data indefinitely.

## Message quality rules

A compliant message can still be harmful if irrelevant or misleading. Drafts must be short, specific, factual, and explain why the investor’s published thesis appears relevant. Never claim a referral, relationship, urgency, exclusivity, or performance metric that was not supplied and verified.

## Preflight checklist

- [ ] Campaign has an approved purpose and jurisdiction matrix.
- [ ] Founder approved the data used in the message.
- [ ] Recipient source and thesis evidence are current.
- [ ] Recipient type is resolved.
- [ ] Legitimate-interest/consent record is present where required.
- [ ] Recipient is absent from all suppression lists.
- [ ] Sender domain passes SPF, DKIM, and DMARC checks.
- [ ] Reply address is monitored by a person.
- [ ] Identity, postal address, and one-click unsubscribe are present.
- [ ] Daily cap and per-domain throttle are active.
- [ ] Bounce, complaint, reply, and unsubscribe webhooks are tested.
- [ ] Emergency pause has been tested.
