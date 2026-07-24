import Link from "next/link";
import { getNetworkStats } from "@/lib/network-stats";
import { AnimatedNumber } from "@/components/animated-number";

export async function FounderScorecard() {
  const result = await getNetworkStats();

  return (
    <section className="calc-scorecard" aria-labelledby="founder-scorecard-heading">
      <span>LIVE FROM CONVEX / NOT A DEMO</span>
      <h2 id="founder-scorecard-heading">The network your outreach draws on.</h2>

      {result.configured && result.stats.total > 0 ? (
        <div className="calc-panel">
          <div className="signal-stats">
            <article>
              <strong><AnimatedNumber value={result.stats.total} /></strong>
              <span>TOTAL SIGNUPS IN THE NETWORK</span>
            </article>
            <article>
              <strong><AnimatedNumber value={result.stats.last7Days} /></strong>
              <span>NEW IN THE LAST 7 DAYS</span>
            </article>
            <article>
              <strong><AnimatedNumber value={result.stats.byAccountType.individual} /></strong>
              <span>INDIVIDUAL INVESTORS, FOUNDERS &amp; OPERATORS</span>
            </article>
            <article>
              <strong>
                {result.stats.total > 0
                  ? `${((result.stats.last7Days / result.stats.total) * 100).toFixed(1)}%`
                  : "—"}
              </strong>
              <span>WEEKLY GROWTH SIGNAL (7D ÷ TOTAL)</span>
            </article>
          </div>
          <p className="calc-note">
            Computed directly from real, persisted <code>interestSignups</code> records — the same counts described in{" "}
            <a href="https://github.com/chrisnkuno/firstcontact#what-works-today" target="_blank" rel="noreferrer">
              what works today
            </a>
            . Nothing here is estimated.
          </p>
        </div>
      ) : result.configured ? (
        <div className="calc-panel">
          <p className="calc-note">Convex signup ingestion is configured, but no one has signed up yet in this environment.</p>
          <Link className="text-link" href="/signup">
            Be the first real record →
          </Link>
        </div>
      ) : (
        <div className="calc-panel">
          <p className="calc-note">
            Convex signup ingestion is not configured in this environment, so this section intentionally stays empty instead of showing fabricated numbers.
          </p>
        </div>
      )}
    </section>
  );
}
