import type { Metadata } from "next";
import { getAdminMetrics } from "@/lib/admin-data";
import { getCatalogueStats } from "@/lib/catalogue-stats";
import { AnimatedNumber } from "@/components/animated-number";

export const metadata: Metadata = { title: "Techadmin metrics", robots: { index: false, follow: false } };

const number = new Intl.NumberFormat("en-US");

export default async function AdminMetricsPage() {
  const [metrics, catalogue] = await Promise.all([getAdminMetrics(), getCatalogueStats()]);

  if (!metrics) {
    return (
      <div className="calc-intro">
        <span>TECHADMIN / METRICS</span>
        <h1>Metrics are unavailable</h1>
        <p>Convex is not reachable with the configured ADMIN_ACTION_SECRET, or no interest signups exist yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="calc-intro">
        <span>TECHADMIN / METRICS</span>
        <h1>Platform metrics</h1>
        <p>Real counts from Convex, computed on every request — not cached or estimated.</p>
      </div>

      <div className="calc-panel">
        <h2>SIGNUPS</h2>
        <div className="signal-stats">
          <article>
            <strong><AnimatedNumber value={metrics.total} /></strong>
            <span>TOTAL SIGNUPS</span>
          </article>
          <article>
            <strong><AnimatedNumber value={metrics.last7Days} /></strong>
            <span>NEW IN LAST 7 DAYS</span>
          </article>
          <article>
            <strong><AnimatedNumber value={metrics.last30Days} /></strong>
            <span>NEW IN LAST 30 DAYS</span>
          </article>
          <article>
            <strong>{catalogue.configured ? <AnimatedNumber value={catalogue.stats.totalSignals} /> : "—"}</strong>
            <span>CATALOGUE INTEREST SIGNALS</span>
          </article>
        </div>
      </div>

      <div className="admin-metric-groups">
        <div className="admin-metric-group">
          <h3>BY PIPELINE STATUS</h3>
          {Object.entries(metrics.byStatus).map(([status, count]) => (
            <div className="admin-metric-row" key={status}>
              <span>{status}</span>
              <strong>{number.format(count)}</strong>
            </div>
          ))}
        </div>
        <div className="admin-metric-group">
          <h3>BY ACCOUNT TYPE</h3>
          {Object.entries(metrics.byAccountType).map(([type, count]) => (
            <div className="admin-metric-row" key={type}>
              <span>{type}</span>
              <strong>{number.format(count)}</strong>
            </div>
          ))}
        </div>
        <div className="admin-metric-group">
          <h3>BY CAPITAL REGION</h3>
          {Object.entries(metrics.byRegion).map(([region, count]) => (
            <div className="admin-metric-row" key={region}>
              <span>{region}</span>
              <strong>{number.format(count)}</strong>
            </div>
          ))}
        </div>
        <div className="admin-metric-group">
          <h3>BY GOAL</h3>
          {Object.entries(metrics.byGoal)
            .sort((a, b) => b[1] - a[1])
            .map(([goal, count]) => (
              <div className="admin-metric-row" key={goal}>
                <span>{goal}</span>
                <strong>{number.format(count)}</strong>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
