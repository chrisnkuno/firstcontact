import Link from "next/link";
import { getCatalogueStats } from "@/lib/catalogue-stats";
import { AnimatedNumber } from "@/components/animated-number";

export async function InvestorScorecard() {
  const result = await getCatalogueStats();

  return (
    <section className="calc-scorecard" aria-labelledby="investor-scorecard-heading">
      <span>LIVE FROM CONVEX / NOT A DEMO</span>
      <h2 id="investor-scorecard-heading">The deal flow already in motion.</h2>

      {result.configured && result.stats.totalSignals > 0 ? (
        <div className="calc-panel">
          <div className="signal-stats">
            <article>
              <strong><AnimatedNumber value={result.stats.totalSignals} /></strong>
              <span>REAL &ldquo;EXPRESS INTEREST&rdquo; SIGNALS</span>
            </article>
            <article>
              <strong><AnimatedNumber value={result.stats.uniqueProfiles} /></strong>
              <span>DISTINCT PROFILES WITH INTEREST</span>
            </article>
            <article>
              <strong><AnimatedNumber value={result.stats.last7Days} /></strong>
              <span>NEW SIGNALS IN THE LAST 7 DAYS</span>
            </article>
            <article>
              <strong>
                {result.stats.uniqueProfiles > 0
                  ? (result.stats.totalSignals / result.stats.uniqueProfiles).toFixed(1)
                  : "—"}
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
      ) : result.configured ? (
        <div className="calc-panel">
          <p className="calc-note">Convex is configured, but no one has expressed interest in a catalogue profile yet in this environment.</p>
          <Link className="text-link" href="/catalogue">
            Browse the catalogue →
          </Link>
        </div>
      ) : (
        <div className="calc-panel">
          <p className="calc-note">
            Convex catalogue-interest ingestion is not configured in this environment, so this section intentionally stays empty
            instead of showing fabricated numbers.
          </p>
        </div>
      )}
    </section>
  );
}
