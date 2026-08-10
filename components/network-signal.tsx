"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Activity, Building2, Globe2, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { T } from "@/components/translation-provider";
import { isConvexConfigured } from "@/lib/convex-endpoints";

/**
 * Width, as a CSS percentage, of one region's bar.
 *
 * This lives here rather than inline in the bar markup because the inline
 * version applied the share twice — the percentage sized the track element,
 * and a `width: inherit` pseudo-element then took that same percentage *of the
 * track* — so every bar rendered at its share squared (a 50% region drew at
 * 25%). Keeping it as one tested function makes that class of bug reproducible.
 *
 * A non-zero region is floored at `minimumVisible` so "1 signup out of 400"
 * reads as present rather than as an empty row; a genuinely zero region stays
 * at exactly 0 so the floor can never imply activity that did not happen.
 */
export function regionSharePercent(count: number, total: number, minimumVisible = 3): number {
  if (!Number.isFinite(count) || !Number.isFinite(total)) return 0;
  if (total <= 0 || count <= 0) return 0;
  const share = (count / total) * 100;
  return Math.min(100, Math.max(share, minimumVisible));
}

function relativeTime(timestamp: number) {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NetworkSignal() {
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
          Every number here comes from actual <code>/signup</code> submissions stored in Convex — the
          same records described in{" "}
          <a href="https://github.com/chrisnkuno/firstcontact#what-works-today" target="_blank" rel="noreferrer">
            what works today
          </a>
          . Nothing is estimated, and this section shows nothing rather than invent activity that has
          not happened.
        </p>
      </div>

      {isConvexConfigured ? (
        <NetworkSignalLive />
      ) : (
        <div className="signal-empty">
          <p>
            <T>
              Convex signup ingestion is not configured in this environment, so this section
              intentionally stays empty instead of showing fabricated numbers.
            </T>
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

function NetworkSignalLive() {
  const stats = useQuery(api.signups.publicStats);

  if (stats === undefined) {
    return (
      <div className="signal-empty">
        <p>
          <T>Reading live counts…</T>
        </p>
      </div>
    );
  }

  if (stats.total === 0) {
    return (
      <div className="signal-empty">
        <p>
          <T>
            Convex signup ingestion is configured, but no one has signed up yet in this environment.
          </T>
        </p>
        <Link className="text-link" href="/signup">
          <T>Be the first real record</T> →
        </Link>
      </div>
    );
  }

  return (
    <div className="signal-stats-wrap">
      <div className="signal-stats">
        <article>
          <Activity size={16} />
          <strong>{stats.total}</strong>
          <span>
            <T>TOTAL INTEREST SIGNUPS</T>
          </span>
        </article>
        <article>
          <Building2 size={16} />
          <strong>{stats.byAccountType.startup + stats.byAccountType.institution}</strong>
          <span>
            <T>STARTUPS &amp; INSTITUTIONS</T>
          </span>
        </article>
        <article>
          <Users size={16} />
          <strong>{stats.byAccountType.individual}</strong>
          <span>
            <T>INVESTORS, FOUNDERS &amp; OPERATORS</T>
          </span>
        </article>
        <article>
          <Globe2 size={16} />
          <strong>{stats.last7Days}</strong>
          <span>
            <T>NEW IN THE LAST 7 DAYS</T>
          </span>
        </article>
      </div>
      <div className="signal-regions">
        <span>
          <T>CAPITAL REGIONS OF INTEREST</T>
        </span>
        <div>
          {(["US", "UK", "EU", "APAC"] as const).map((region) => {
            const count = stats.byRegion[region];
            const fill = regionSharePercent(count, stats.total);
            const share = stats.total ? (count / stats.total) * 100 : 0;
            return (
              <div key={region} className="signal-region-row">
                <b>{region}</b>
                <i
                  style={{ "--fill": `${fill.toFixed(1)}%` } as CSSProperties}
                  role="img"
                  aria-label={`${region}: ${count} of ${stats.total} signups, ${Math.round(share)} percent`}
                />
                <em>{count}</em>
              </div>
            );
          })}
        </div>
        {stats.latestCreatedAt && <small>Last signup {relativeTime(stats.latestCreatedAt)} · live</small>}
      </div>
    </div>
  );
}
