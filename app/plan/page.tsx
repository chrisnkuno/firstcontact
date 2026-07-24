import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { FunnelPlanner } from "@/components/funnel-planner";
import { FounderScorecard } from "@/components/founder-scorecard";

export const metadata: Metadata = {
  title: "Outreach planner",
  description: "A math-based outreach funnel planner: how many investor contacts a raise actually requires, run backward from the goal.",
};

export default function PlanPage() {
  return (
    <main id="main-content">
      <header className="simple-header">
        <Logo />
        <Link href="/">
          <ArrowLeft size={16} /> Back home
        </Link>
      </header>
      <div className="calc-shell section-shell">
        <div className="calc-intro">
          <span>NUMBERS GAME / FOUNDER PLANNER</span>
          <h1>Outreach is a numbers game. So plan it like one.</h1>
          <p>
            Fundraising outcomes come from a chain of conversion rates, not hope. This tool runs the chain backward from your raise
            target — check size, meeting-to-commit rate, reply-to-meeting rate, and cold-contact reply rate — to tell you exactly how
            many investor contacts, replies, and meetings the number actually requires.
          </p>
        </div>
        <FunnelPlanner />
        <FounderScorecard />
      </div>
    </main>
  );
}
