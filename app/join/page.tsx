import type { Metadata } from "next";
import { SignUpForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a FirstContact account as someone seeking capital or someone deploying it.",
};

export default function JoinPage() {
  return (
    <main id="main-content" className="auth-page">
      <SignUpForm />
    </main>
  );
}
