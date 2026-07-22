import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ApplyForm } from "@/components/apply-form";

export default function ApplyPage() {
  return <main className="application-page"><header className="simple-header"><Logo /><Link href="/"><ArrowLeft size={16} /> Back to overview</Link></header><section className="application-shell"><aside><span>FOUNDER INTAKE / 01</span><h1>Give the signal<br />its full context.</h1><p>This is not another pitch-deck upload. Share the facts and local knowledge needed to identify investors who can genuinely add value.</p><div className="privacy-note"><b>YOUR DATA, YOUR CONTROL</b><p>Profiles are private by default. You choose which facts can enter an outreach draft, and approve every recipient.</p></div></aside><ApplyForm /></section></main>;
}
