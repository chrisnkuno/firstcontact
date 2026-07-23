import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ApplyForm } from "@/components/apply-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { T } from "@/components/translation-provider";

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
        <div className="simple-header-actions">
          <LanguageSwitcher />
          <Link href="/">
            <ArrowLeft size={16} /> <T>Back to overview</T>
          </Link>
        </div>
      </header>
      <section className="application-shell signup-shell">
        <aside>
          <span>FIRSTCONTACT SIGNUP / 01</span>
          <h1>
            <T>Start with</T>
            <br />
            <T>useful context.</T>
          </h1>
          <p>
            <T>Join as a startup, institution, or individual. A short questionnaire helps us understand what you need and build a more useful capital access network.</T>
          </p>
          <div className="intake-facts">
            <span>
              <b>03</b> <T>short steps</T>
            </span>
            <span>
              <b>PRIVATE</b> <T>by default</T>
            </span>
            <span>
              <b>HUMAN</b> <T>reviewed</T>
            </span>
          </div>
          <div className="privacy-note">
            <b>YOUR DATA, YOUR CONTROL</b>
            <p>
              <T>Signup records interest only. Catalogue visibility, investor matching, and outreach each require a separate decision.</T>
            </p>
          </div>
        </aside>
        <ApplyForm />
      </section>
    </main>
  );
}
