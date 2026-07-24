import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { PacingPlanner } from "@/components/pacing-planner";
import { InvestorScorecard } from "@/components/investor-scorecard";

export const metadata: Metadata = {
  title: "Portfolio pacing",
  description: "A math-based deal-flow planner: how many companies an investor needs to review and meet to hit a portfolio target.",
};

export default function PacingPage() {
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
          <span>NUMBERS GAME / INVESTOR PLANNER</span>
          <h1>Deal flow is a numbers game too.</h1>
          <p>
            Hitting a portfolio target comes from a chain of conversion rates: how many companies you review, how many of those become
            meetings, and how many meetings become investments. This tool runs the chain backward from your target to a specific weekly
            sourcing pace.
          </p>
        </div>
        <PacingPlanner />
        <InvestorScorecard />
      </div>
    </main>
  );
}
