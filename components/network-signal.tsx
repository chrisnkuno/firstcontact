import type { CSSProperties } from "react";
import Link from "next/link";
import { Activity, Building2, Globe2, Users } from "lucide-react";
import { getNetworkStats, regionSharePercent } from "@/lib/network-stats";
import { T } from "@/components/translation-provider";

function relativeTime(timestamp: number) {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export async function NetworkSignal() {
  const result = await getNetworkStats();

  return (
    <section className="network-signal section-shell" aria-labelledby="network-signal-heading">
      <div className="network-signal-copy">
        <span className="kicker">LIVE FROM CONVEX · NOT A DEMO</span>
        <h2 id="network-signal-heading">
          <T>Real interest,</T>
          <br />
          <T>counted honestly.</T>
        </h2>
        <p>
          Every number here comes from actual <code>/signup</code> submissions
          stored in Convex — the same records described in{" "}
          <a href="https://github.com/chrisnkuno/firstcontact#what-works-today" target="_blank" rel="noreferrer">
            what works today
          </a>
          . Nothing is estimated, and this section shows nothing rather than
          invent activity that has not happened.
        </p>
      </div>

      {result.configured && result.stats.total > 0 ? (
        <div className="signal-stats-wrap">
          <div className="signal-stats">
            <article>
              <Activity size={16} />
              <strong>{result.stats.total}</strong>
              <span><T>TOTAL INTEREST SIGNUPS</T></span>
            </article>
            <article>
              <Building2 size={16} />
              <strong>{result.stats.byAccountType.startup + result.stats.byAccountType.institution}</strong>
              <span><T>STARTUPS &amp; INSTITUTIONS</T></span>
            </article>
            <article>
              <Users size={16} />
              <strong>{result.stats.byAccountType.individual}</strong>
              <span><T>INVESTORS, FOUNDERS &amp; OPERATORS</T></span>
            </article>
            <article>
              <Globe2 size={16} />
              <strong>{result.stats.last7Days}</strong>
              <span><T>NEW IN THE LAST 7 DAYS</T></span>
            </article>
          </div>
          <div className="signal-regions">
            <span><T>CAPITAL REGIONS OF INTEREST</T></span>
            <div>
              {(["US", "UK", "EU", "APAC"] as const).map((region) => {
                const count = result.stats.byRegion[region];
                const total = result.stats.total;
                const fill = regionSharePercent(count, total);
                const share = total ? (count / total) * 100 : 0;
                return (
                  <div key={region} className="signal-region-row">
                    <b>{region}</b>
                    <i
                      style={{ "--fill": `${fill.toFixed(1)}%` } as CSSProperties}
                      role="img"
                      aria-label={`${region}: ${count} of ${result.stats.total} signups, ${Math.round(share)} percent`}
                    />
                    <em>{count}</em>
                  </div>
                );
              })}
            </div>
            {result.stats.latestCreatedAt && (
              <small>Last signup {relativeTime(result.stats.latestCreatedAt)} · recalculated every 60 seconds</small>
            )}
          </div>
        </div>
      ) : result.configured ? (
        <div className="signal-empty">
          <p>
            <T>Convex signup ingestion is configured, but no one has signed up yet in this environment.</T>
          </p>
          <Link className="text-link" href="/signup">
            <T>Be the first real record</T> →
          </Link>
        </div>
      ) : (
        <div className="signal-empty">
          <p>
            <T>Convex signup ingestion is not configured in this environment, so this section intentionally stays empty instead of showing fabricated numbers.</T>
          </p>
          <a
            className="text-link"
            href="https://github.com/chrisnkuno/firstcontact#enable-persisted-signup"
            target="_blank"
            rel="noreferrer"
          >
            <T>Enable persisted signup</T> →
          </a>
        </div>
      )}
    </section>
  );
}
