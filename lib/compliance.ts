export type ContactPolicyInput = {
  outboundEnabled: boolean;
  approved: boolean;
  hasSource: boolean;
  isSuppressed: boolean;
  contactType: "generic_business" | "named_business" | "unknown";
  jurisdictionReviewed: boolean;
  hasPostalIdentity: boolean;
  hasUnsubscribe: boolean;
};

export type ContactPolicyResult = { allowed: boolean; reasons: string[] };

export function evaluateContactPolicy(input: ContactPolicyInput): ContactPolicyResult {
  const reasons: string[] = [];
  if (!input.outboundEnabled) reasons.push("Live outbound is disabled by the operator");
  if (!input.approved) reasons.push("A human has not approved this message");
  if (!input.hasSource) reasons.push("The contact has no auditable public source");
  if (input.isSuppressed) reasons.push("The recipient is on the suppression list");
  if (input.contactType === "unknown") reasons.push("The recipient type is unresolved");
  if (input.contactType === "named_business" && !input.jurisdictionReviewed) {
    reasons.push("Named personal data requires a jurisdiction and lawful-basis review");
  }
  if (!input.hasPostalIdentity) reasons.push("Sender identity or postal address is missing");
  if (!input.hasUnsubscribe) reasons.push("A one-step unsubscribe mechanism is missing");
  return { allowed: reasons.length === 0, reasons };
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}
