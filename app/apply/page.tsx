import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ApplyForm } from "@/components/apply-form";

export default function ApplyPage() {
  return <main className="application-page" id="main-content"><header className="simple-header"><Logo /><Link href="/"><ArrowLeft size={16} /> Back to overview</Link></header><section className="application-shell"><aside><span>ORGANIZATION INTAKE / 01</span><h1>Give the signal<br />its full context.</h1><p>This is not another pitch-deck upload. Startups and institutions can share the facts and local knowledge needed to identify investors who can genuinely add value.</p><div className="privacy-note"><b>YOUR DATA, YOUR CONTROL</b><p>Profiles are private by default. You separately approve catalogue fields, outreach claims, recipients, and messages.</p></div></aside><ApplyForm /></section></main>;
}
