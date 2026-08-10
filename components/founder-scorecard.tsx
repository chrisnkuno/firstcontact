"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AnimatedNumber } from "@/components/animated-number";
import { isConvexConfigured } from "@/lib/convex-endpoints";
import { formatRate, rate } from "@/lib/metrics-core";

/**
 * Real signup counts, read straight from Convex in the browser.
 *
 * Previously a server component that fetched over `ConvexHttpClient`. On a
 * static export there is no server render, so this subscribes instead — which
 * has the side benefit that the number updates live rather than at whatever
 * cadence the page was cached.
 *
 * The three-state shape is preserved deliberately: **not configured**, **configured
 * but empty**, and **real data** are different things, and collapsing the first
 * two into a zero would present an absent backend as a measured result.
 */
export function FounderScorecard() {
  return (
    <section className="calc-scorecard" aria-labelledby="founder-scorecard-heading">
      <span>LIVE FROM CONVEX / NOT A DEMO</span>
      <h2 id="founder-scorecard-heading">The network your outreach draws on.</h2>
      {isConvexConfigured ? (
        <FounderScorecardLive />
      ) : (
        <div className="calc-panel">
          <p className="calc-note">
            Convex signup ingestion is not configured in this environment, so this section
            intentionally stays empty instead of showing fabricated numbers.
          </p>
        </div>
      )}
    </section>
  );
}

function FounderScorecardLive() {
  const stats = useQuery(api.signups.publicStats);

  if (stats === undefined) {
    return (
      <div className="calc-panel">
        <p className="calc-note">Reading live counts…</p>
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="calc-panel">
        <p className="calc-note">
          Convex signup ingestion is configured, but no one has signed up yet in this environment.
        </p>
        <Link className="text-link" href="/signup">
          Be the first real record →
        </Link>
      </div>
    );
  }

  return (
    <div className="calc-panel">
      <div className="signal-stats">
        <article>
          <strong>
            <AnimatedNumber value={stats.total} />
          </strong>
          <span>TOTAL SIGNUPS IN THE NETWORK</span>
        </article>
        <article>
          <strong>
            <AnimatedNumber value={stats.last7Days} />
          </strong>
          <span>NEW IN THE LAST 7 DAYS</span>
        </article>
        <article>
          <strong>
            <AnimatedNumber value={stats.byAccountType.individual} />
          </strong>
          <span>INDIVIDUAL INVESTORS, FOUNDERS &amp; OPERATORS</span>
        </article>
        <article>
          <strong>{formatRate(rate(stats.last7Days, stats.total))}</strong>
          <span>WEEKLY GROWTH SIGNAL (7D ÷ TOTAL)</span>
        </article>
      </div>
      <p className="calc-note">
        Computed directly from real, persisted <code>interestSignups</code> records — the same counts
        described in{" "}
        <a href="https://github.com/chrisnkuno/firstcontact#what-works-today" target="_blank" rel="noreferrer">
          what works today
        </a>
        . Nothing here is estimated.
      </p>
    </div>
  );
}
