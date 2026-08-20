"use client";

import { useState } from "react";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardShell } from "@/components/dashboard-shell";
import { GuidancePanel, OnboardingChecklist } from "@/components/onboarding";
import { BarSeriesChart, ChartFigure, FunnelChart, MeterBar, StatTile, TrendChart } from "@/components/charts";
import { buildInvestorMetrics, INVESTOR_TYPE_DEFAULTS } from "@/lib/investor-metrics";
import { formatRate } from "@/lib/metrics-core";
import { INVESTOR_TYPE_LABELS, type InvestorType } from "@/lib/domain";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  notation: "compact",
});

/**
 * Focus-specific headline copy.
 *
 * The dashboard renders the same underlying metrics for every investor type,
 * but leads with a different one depending on `focus` — an angel opens to
 * deployment pace, a fund to portfolio construction, a DFI to mandate
 * coverage, an LP to commitments. Same data, different first question.
 */
const FOCUS_COPY: Record<string, { heading: string; body: string }> = {
  deployment: {
    heading: "Deployment pace",
    body: "How much you have deployed against your target, and whether the review pace supports it.",
  },
  "fund-construction": {
    heading: "Fund construction",
    body: "Initial cheques versus reserves, and how far through the intended position count you are.",
  },
  mandate: {
    heading: "Mandate coverage",
    body: "Whether the pipeline spans the geographies and sectors your mandate commits you to.",
  },
  commitments: {
    heading: "Commitments",
    body: "Capital committed against target, and the pace of new commitments.",
  },
};

export function InvestorDashboard() {
  return (
    <DashboardShell allow={["investor"]} label="INVESTOR" nav={
        <>
          <Link href="/catalogue">Catalogue</Link>
          <Link href="/investor/profile">Profile</Link>
          <Link href="/pacing">Pacing</Link>
        </>
      }>
      {(viewer) => (
        <InvestorBody
          name={viewer.name ?? viewer.email ?? "there"}
          investorType={(viewer.investorType ?? "angel") as InvestorType}
        />
      )}
    </DashboardShell>
  );
}

/**
 * A single, stable "now" for the lifetime of the dashboard mount.
 *
 * Calling `Date.now()` during render would be impure — the value would change
 * on every re-render, so chart buckets could silently shift underneath the
 * reader while they are looking at them. Capturing it once in a lazy state
 * initializer pins every derived metric to one instant.
 */
function useStableNow(): number {
  const [now] = useState(() => Date.now());
  return now;
}

function InvestorBody({ name, investorType }: { name: string; investorType: InvestorType }) {
  const now = useStableNow();
  const activity = useQuery(api.investors.myActivity);
  const interests = useQuery(api.investors.myInterests);

  if (activity === undefined || interests === undefined) {
    return <p className="dashboard-loading">Loading your portfolio…</p>;
  }

  const defaults = INVESTOR_TYPE_DEFAULTS[investorType];
  // Fund size and deployment period are planning inputs, not observations. Until
  // the account records them, the type's default stands in and every figure
  // derived from it is labelled as an assumption.
  const fundSizeUsd = defaults.avgCheckUsd * defaults.targetInvestmentsPerYear * 3;

  const metrics = buildInvestorMetrics({
    now,
    investorType,
    fundSizeUsd,
    deploymentYears: 3,
    activity,
    allocation: buildAllocation(interests),
  });

  const focus = FOCUS_COPY[metrics.focus];
  const hasActivity = activity.reviewedAt.length > 0;

  return (
    <>
      <div className="dashboard-head">
        <div>
          <span>INVESTOR / {INVESTOR_TYPE_LABELS[investorType].toUpperCase()}</span>
          <h1>Hello, {name}</h1>
          <p>
            {focus.body} Planning assumptions come from your investor type and are editable — they are
            not measurements of your actual performance.
          </p>
        </div>
      </div>

      <OnboardingChecklist
        role="investor"
        signals={{
          hasProfile: true,
          hasIntakeRecord: true,
          hasOrganization: activity.organizationCount > 0,
          hasCampaign: false,
          hasMfa: false,
          hasInvestorType: true,
          expressedInterest: interests.length > 0,
          hasListing: false,
          listingPublished: false,
        }}
      />

      <div className="stat-grid">
        <StatTile label="Companies reviewed" value={activity.reviewedAt.length} />
        <StatTile label="Interests expressed" value={interests.length} />
        <StatTile
          label="Target investments / year"
          value={defaults.targetInvestmentsPerYear}
          hint="Assumption — editable"
        />
        <StatTile
          label="Reviews needed / week"
          value={metrics.pacing.reviewsPerWeek}
          hint={`To reach ${defaults.targetInvestmentsPerYear} investments a year`}
        />
      </div>

      <GuidancePanel id="investor.assumptions" title="These figures are a plan, not a track record">
        <p>
          FirstContact does not observe your closed deals, so deployment and portfolio numbers are
          derived from your stated pace and cheque size. Only the review and interest counts are
          measured from what you actually did here.
        </p>
      </GuidancePanel>

      <div className="dashboard-grid">
        <ChartFigure
          title={`${focus.heading} — required pace`}
          description={`Working forward from ${defaults.targetInvestmentsPerYear} investments a year at the assumed conversion rates.`}
          series={[{ key: "count", label: "Needed per year" }]}
          rows={[
            { label: "Reviews", count: metrics.pacing.companiesToReviewNeeded },
            { label: "Meetings", count: metrics.pacing.meetingsNeeded },
            { label: "Investments", count: defaults.targetInvestmentsPerYear },
          ]}
          xKey="label"
          xLabel="Stage"
          emptyTitle="No pacing target"
          emptyBody="Set a target investment count to see the required pace."
        >
          <FunnelChart
            stages={[
              { label: "Reviews", count: metrics.pacing.companiesToReviewNeeded, conversionFromPrevious: null },
              { label: "Meetings", count: metrics.pacing.meetingsNeeded, conversionFromPrevious: null },
              { label: "Investments", count: defaults.targetInvestmentsPerYear, conversionFromPrevious: null },
            ]}
          />
        </ChartFigure>

        <ChartFigure
          title="Your activity, week by week"
          description="Companies reviewed and conversations opened."
          series={[
            { key: "reviewed", label: "Reviewed" },
            { key: "met", label: "Met" },
          ]}
          rows={hasActivity ? metrics.weekly : []}
          xKey="label"
          xLabel="Week"
          emptyTitle="No activity recorded yet"
          emptyBody="Expressing interest in a catalogue listing is what fills this chart in."
        >
          <TrendChart
            rows={metrics.weekly}
            xKey="label"
            series={[
              { key: "reviewed", label: "Reviewed" },
              { key: "met", label: "Met" },
            ]}
          />
        </ChartFigure>

        <figure className="chart-figure">
          <header>
            <div>
              <h3>{focus.heading}</h3>
              <p>Against a {usd.format(fundSizeUsd)} assumed pool over 3 years.</p>
            </div>
          </header>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <MeterBar
              label="Capital deployed"
              value={metrics.deployment.deployedUsd}
              target={fundSizeUsd}
              formatter={(value) => usd.format(value)}
            />
            <MeterBar
              label="Positions built"
              value={metrics.deployment.positionsMade}
              target={Math.max(1, metrics.construction.impliedInitialPositions)}
            />
            <MeterBar
              label="Reserved for follow-on"
              value={metrics.construction.reserveUsd}
              target={fundSizeUsd}
              formatter={(value) => usd.format(value)}
            />
          </div>
          <p className="chart-note">
            {metrics.calibration.hasEnoughData
              ? `Observed review-to-meeting rate ${formatRate(metrics.calibration.observedMeetingRate)} against an assumed ${formatRate(metrics.calibration.assumedMeetingRate)}.`
              : "Observed conversion appears once you have reviewed at least 20 companies."}
          </p>
        </figure>

        <ChartFigure
          title="Pipeline spread"
          description="Where the companies you have shown interest in are based."
          series={[{ key: "count", label: "Companies" }]}
          rows={toRows(buildAllocation(interests).byRegion)}
          xKey="label"
          xLabel="Region"
          emptyTitle="No pipeline yet"
          emptyBody="Concentration figures need at least one company to measure. Browse the catalogue to begin."
        >
          <BarSeriesChart
            rows={toRows(buildAllocation(interests).byRegion)}
            xKey="label"
            series={[{ key: "count", label: "Companies" }]}
            height={200}
          />
        </ChartFigure>
      </div>

      <div className="stat-grid">
        <StatTile
          label="Sector concentration"
          value={
            metrics.diversification.sectorConcentration === null
              ? null
              : formatRate(metrics.diversification.sectorConcentration, 0)
          }
          hint="0% is as spread as this count allows; 100% is all in one"
          tone={
            metrics.diversification.sectorConcentration !== null &&
            metrics.diversification.sectorConcentration > 0.6
              ? "warning"
              : "neutral"
          }
        />
        <StatTile
          label="Region concentration"
          value={
            metrics.diversification.regionConcentration === null
              ? null
              : formatRate(metrics.diversification.regionConcentration, 0)
          }
        />
        <StatTile label="Sectors represented" value={metrics.diversification.sectorCount} />
        <StatTile label="Regions represented" value={metrics.diversification.regionCount} />
      </div>
    </>
  );
}

type Interest = { region: string | null; stage: string | null; sectors: readonly string[] };

function buildAllocation(interests: readonly Interest[]) {
  const bySector: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  const byStage: Record<string, number> = {};

  for (const interest of interests) {
    if (interest.region) byRegion[interest.region] = (byRegion[interest.region] ?? 0) + 1;
    if (interest.stage) byStage[interest.stage] = (byStage[interest.stage] ?? 0) + 1;
    for (const sector of interest.sectors) bySector[sector] = (bySector[sector] ?? 0) + 1;
  }
  return { bySector, byRegion, byStage };
}

function toRows(counts: Record<string, number>) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));
}
