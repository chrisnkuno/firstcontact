"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnimatedNumber } from "@/components/animated-number";
import { isConvexConfigured } from "@/lib/convex-endpoints";

/** The investor-side mirror of FounderScorecard — same three-state discipline. */
export function InvestorScorecard() {
  return (
    <section className="calc-scorecard" aria-labelledby="investor-scorecard-heading">
      <span>LIVE FROM CONVEX / NOT A DEMO</span>
      <h2 id="investor-scorecard-heading">The deal flow already in motion.</h2>
      {isConvexConfigured ? (
        <InvestorScorecardLive />
      ) : (
        <div className="calc-panel">
          <p className="calc-note">
            Convex catalogue-interest ingestion is not configured in this environment, so this section
            intentionally stays empty instead of showing fabricated numbers.
          </p>
        </div>
      )}
    </section>
  );
}

function InvestorScorecardLive() {
  const stats = useQuery(api.catalogue.publicStats);

  if (stats === undefined) {
    return (
      <div className="calc-panel">
        <p className="calc-note">Reading live counts…</p>
      </div>
    );
  }

  if (stats.totalSignals === 0) {
    return (
      <div className="calc-panel">
        <p className="calc-note">
          Convex is configured, but no one has expressed interest in a catalogue profile yet in this
          environment.
        </p>
        <Link className="text-link" href="/catalogue">
          Browse the catalogue →
        </Link>
      </div>
    );
  }

  return (
    <div className="calc-panel">
      <div className="signal-stats">
        <article>
          <strong>
            <AnimatedNumber value={stats.totalSignals} />
          </strong>
          <span>REAL &ldquo;EXPRESS INTEREST&rdquo; SIGNALS</span>
        </article>
        <article>
          <strong>
            <AnimatedNumber value={stats.uniqueProfiles} />
          </strong>
          <span>DISTINCT PROFILES WITH INTEREST</span>
        </article>
        <article>
          <strong>
            <AnimatedNumber value={stats.last7Days} />
          </strong>
          <span>NEW SIGNALS IN THE LAST 7 DAYS</span>
        </article>
        <article>
          <strong>
            {stats.uniqueProfiles > 0 ? (stats.totalSignals / stats.uniqueProfiles).toFixed(1) : "—"}
          </strong>
          <span>SIGNALS PER PROFILE (DEPTH ÷ BREADTH)</span>
        </article>
      </div>
      <p className="calc-note">
        Computed directly from real, persisted <code>catalogueInterestSignals</code> records — see{" "}
        <a href="https://github.com/chrisnkuno/firstcontact#what-works-today" target="_blank" rel="noreferrer">
          what works today
        </a>
        . Nothing here is estimated.
      </p>
    </div>
  );
}
