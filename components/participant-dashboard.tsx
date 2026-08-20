"use client";

import { useState } from "react";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardShell } from "@/components/dashboard-shell";
import { GuidancePanel, OnboardingChecklist } from "@/components/onboarding";
import {
  BarSeriesChart,
  ChartFigure,
  FunnelChart,
  MeterBar,
  StatTile,
  TrendChart,
} from "@/components/charts";
import { buildParticipantMetrics } from "@/lib/participant-metrics";
import { DEFAULT_FUNNEL_RATES } from "@/lib/outreach-math";
import { formatRate } from "@/lib/metrics-core";
import type { Stage } from "@/lib/outreach-math";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const STATUS_COPY: Record<string, string> = {
  new: "Received — not yet reviewed",
  reviewing: "Under review",
  invited: "Invited to the platform",
  active: "Active",
  declined: "Not proceeding",
};

export function ParticipantDashboard() {
  return (
    <DashboardShell
      allow={["participant"]}
      label="PARTICIPANT"
      nav={
        <>
          <Link href="/dashboard/organization">Your listing</Link>
          <Link href="/dashboard/profile">Profile</Link>
          <Link href="/plan">Planner</Link>
        </>
      }
    >
      {(viewer) => <ParticipantBody name={viewer.name ?? viewer.email ?? "there"} />}
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

function ParticipantBody({ name }: { name: string }) {
  const now = useStableNow();
  const record = useQuery(api.participants.myRecord);
  const activity = useQuery(api.participants.myActivity);
  const workspace = useQuery(api.catalogue.myListing);

  if (record === undefined || activity === undefined || workspace === undefined) {
    return <p className="dashboard-loading">Loading your record…</p>;
  }

  // The raise target is not yet a stored field on the intake record, so the
  // planner's stage default stands in until a profile supplies one. It is
  // labelled as an assumption everywhere it appears rather than presented as
  // something the account actually declared.
  const stage = (record?.stage ?? "seed") as Stage;
  const raiseAmountUsd = 1_000_000;

  const metrics = buildParticipantMetrics({
    now,
    raiseAmountUsd,
    stage,
    contactToReplyRate: DEFAULT_FUNNEL_RATES.contactToReplyRate,
    replyToMeetingRate: DEFAULT_FUNNEL_RATES.replyToMeetingRate,
    meetingToCommitRate: DEFAULT_FUNNEL_RATES.meetingToCommitRate,
    weeklyContactCapacity: DEFAULT_FUNNEL_RATES.weeklyContactCapacity,
    activity: {
      contactedAt: activity.contactedAt,
      repliedAt: activity.repliedAt,
      meetingAt: activity.meetingAt,
      committedUsd: activity.committedUsd,
    },
    profile: {
      hasOneLiner: Boolean(record?.summary),
      hasTraction: Boolean(record?.context),
      hasImpact: Boolean(record?.context),
      hasFounderContext: Boolean(record?.context),
      hasSectors: Boolean(record?.goals?.length),
      hasRaiseTarget: false,
      hasTargetRegions: Boolean(record?.targetRegions?.length),
      hasWebsite: Boolean(record?.website),
    },
  });

  const hasActivity = activity.contactedAt.length > 0;
  const weeklyRows = hasActivity ? metrics.weekly : [];

  return (
    <>
      <div className="dashboard-head">
        <div>
          <span>PARTICIPANT / OVERVIEW</span>
          <h1>Hello, {name}</h1>
          <p>
            Everything here is measured from your own records. Where something has not happened yet,
            it reads as “—” rather than as a zero.
          </p>
        </div>
      </div>

      <OnboardingChecklist
        role="participant"
        signals={{
          hasProfile: Boolean(record?.summary && record?.context),
          hasIntakeRecord: record !== null,
          // Read from the workspace rather than inferred from campaign count,
          // which was conflating "has an organization" with "has run a
          // campaign" and left the step permanently unticked.
          hasOrganization: workspace !== null,
          hasCampaign: activity.campaignCount > 0,
          hasMfa: false,
          hasInvestorType: false,
          expressedInterest: false,
          hasListing: workspace?.listing != null,
          listingPublished: workspace?.listing?.visibility === "listed",
        }}
      />

      <div className="stat-grid">
        <StatTile
          label="Application status"
          value={record ? (STATUS_COPY[record.status] ?? record.status) : "No record yet"}
        />
        <StatTile label="Investors contacted" value={activity.contactedAt.length} />
        <StatTile label="Replies received" value={activity.repliedAt.length} />
        <StatTile
          label="Drafts awaiting your approval"
          value={activity.draftsAwaitingApproval}
          tone={activity.draftsAwaitingApproval > 0 ? "warning" : "neutral"}
          hint="Nothing sends until you approve it"
        />
      </div>

      <GuidancePanel id="participant.plan-vs-actual" title="Plan and actuals are kept separate">
        <p>
          The funnel below is arithmetic over assumptions you control — it is what a{" "}
          {usd.format(raiseAmountUsd)} raise would require at {stage} cheque sizes, not a forecast of
          your outcome. The activity chart beside it is what has actually happened.
        </p>
      </GuidancePanel>

      <div className="dashboard-grid">
        <ChartFigure
          title="What this raise requires"
          description={`Working backwards from ${usd.format(raiseAmountUsd)} at an assumed ${usd.format(metrics.avgCheckUsd)} average cheque.`}
          series={[{ key: "count", label: "Needed" }]}
          rows={[
            { label: "Contacts", count: metrics.plan.contactsNeeded },
            { label: "Replies", count: metrics.plan.repliesNeeded },
            { label: "Meetings", count: metrics.plan.meetingsNeeded },
            { label: "Investors", count: metrics.plan.investorsNeeded },
          ]}
          xKey="label"
          xLabel="Stage"
          emptyTitle="No plan yet"
          emptyBody="Set a raise target to see what it requires."
        >
          <FunnelChart
            stages={[
              { label: "Contacts", count: metrics.plan.contactsNeeded, conversionFromPrevious: null },
              { label: "Replies", count: metrics.plan.repliesNeeded, conversionFromPrevious: null },
              { label: "Meetings", count: metrics.plan.meetingsNeeded, conversionFromPrevious: null },
              { label: "Investors", count: metrics.plan.investorsNeeded, conversionFromPrevious: null },
            ]}
          />
        </ChartFigure>

        <ChartFigure
          title="Your outreach, week by week"
          description="Contacted, replied and met, against the weekly pace your plan implies."
          series={[
            { key: "contacted", label: "Contacted" },
            { key: "replied", label: "Replied" },
            { key: "met", label: "Met" },
          ]}
          rows={weeklyRows}
          xKey="label"
          xLabel="Week"
          emptyTitle="No outreach recorded yet"
          emptyBody="Once a campaign sends its first approved message, this chart fills in. It stays empty rather than showing a line at zero."
        >
          <TrendChart
            rows={weeklyRows}
            xKey="label"
            series={[
              { key: "contacted", label: "Contacted" },
              { key: "replied", label: "Replied" },
              { key: "met", label: "Met" },
            ]}
          />
        </ChartFigure>

        <ChartFigure
          title="Observed funnel"
          description="Your real conversion, stage by stage."
          series={[{ key: "count", label: "Records" }]}
          rows={hasActivity ? metrics.actualFunnel.map((s) => ({ label: s.label, count: s.count })) : []}
          xKey="label"
          xLabel="Stage"
          emptyTitle="Nothing measured yet"
          emptyBody="Conversion rates need contacts to divide by. They appear once outreach starts."
        >
          <FunnelChart stages={metrics.actualFunnel} />
        </ChartFigure>

        <figure className="chart-figure">
          <header>
            <div>
              <h3>Progress against plan</h3>
              <p>Where you are against what the raise requires.</p>
            </div>
          </header>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <MeterBar
              label="Investors contacted"
              value={metrics.progress.contacts}
              target={metrics.plan.contactsNeeded}
            />
            <MeterBar
              label="Capital committed"
              value={metrics.progress.committedUsd}
              target={raiseAmountUsd}
              formatter={(value) => usd.format(value)}
            />
            <MeterBar
              label="Profile readiness"
              value={metrics.readiness.earned}
              target={metrics.readiness.total}
            />
          </div>
          <p className="chart-note">
            {metrics.calibration.hasEnoughData
              ? `Your observed reply rate is ${formatRate(metrics.calibration.observedReplyRate)} against an assumed ${formatRate(metrics.calibration.assumedReplyRate)}.`
              : "Observed conversion rates appear once you have at least 20 contacts — below that, the numbers are noise rather than signal."}
          </p>
        </figure>
      </div>

      {record && (
        <ChartFigure
          title="Where your capital interest points"
          description="The regions you selected on your intake form."
          series={[{ key: "value", label: "Selected" }]}
          rows={record.targetRegions.map((region) => ({ label: region, value: 1 }))}
          xKey="label"
          xLabel="Region"
          emptyTitle="No regions selected"
          emptyBody="Add target capital regions to your profile."
        >
          <BarSeriesChart
            rows={record.targetRegions.map((region) => ({ label: region, value: 1 }))}
            xKey="label"
            series={[{ key: "value", label: "Selected" }]}
            height={180}
          />
        </ChartFigure>
      )}
    </>
  );
}
