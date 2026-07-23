import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ApplyForm } from "@/components/apply-form";

export const metadata: Metadata = {
  title: "Join",
  description:
    "Create a FirstContact profile as a startup, institution, investor, founder, operator, advisor, or researcher.",
};

export default function ApplyPage() {
  return (
    <main className="application-page" id="main-content">
      <header className="simple-header">
        <Logo />
        <Link href="/">
          <ArrowLeft size={16} /> Back to overview
        </Link>
      </header>
      <section className="application-shell signup-shell">
        <aside>
          <span>FIRSTCONTACT SIGNUP / 01</span>
          <h1>
            Start with
            <br />
            useful context.
          </h1>
          <p>
            Join as a startup, institution, or individual. A short questionnaire
            helps us understand what you need and build a more useful capital
            access network.
          </p>
          <div className="intake-facts">
            <span>
              <b>03</b> short steps
            </span>
            <span>
              <b>PRIVATE</b> by default
            </span>
            <span>
              <b>HUMAN</b> reviewed
            </span>
          </div>
          <div className="privacy-note">
            <b>YOUR DATA, YOUR CONTROL</b>
            <p>
              Signup records interest only. Catalogue visibility, investor
              matching, and outreach each require a separate decision.
            </p>
          </div>
        </aside>
        <ApplyForm />
      </section>
    </main>
  );
}
