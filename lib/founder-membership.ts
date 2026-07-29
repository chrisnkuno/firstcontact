export function normalizeAccountEmail(email: string) {
  return email.trim().toLowerCase();
}

export function resolveSignupEmail(accountEmail: string, linkedSignupEmail?: string) {
  return normalizeAccountEmail(linkedSignupEmail || accountEmail);
}
