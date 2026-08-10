import type { Metadata } from "next";
import { SignInForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

export default function SignInPage() {
  return (
    <main id="main-content" className="auth-page">
      <SignInForm />
    </main>
  );
}
