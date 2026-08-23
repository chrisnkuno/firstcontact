import type { Metadata } from "next";
import { SignInForm } from "@/components/auth-forms";
import { ParticipantAccess } from "@/components/participant-access";
import { LanguageSwitcher } from "@/components/language-switcher";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <main id="main-content" className="auth-page participant-login-page">
      <div className="participant-login-tools">
        <LanguageSwitcher />
      </div>
      <div className="participant-login-shell">
        <ParticipantAccess />
        <SignInForm />
      </div>
    </main>
  );
}
