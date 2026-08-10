"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { DashboardShell } from "@/components/dashboard-shell";
import { GuidancePanel, OnboardingChecklist } from "@/components/onboarding";
import { BarSeriesChart, ChartFigure, FunnelChart, StatTile, TrendChart } from "@/components/charts";
import { formatRate } from "@/lib/metrics-core";
import { AdminMfaGate } from "@/components/admin-mfa";

export function AdminDashboard() {
  return (
    <DashboardShell
      allow={["admin"]}
      label="OPERATOR"
      nav={
        <>
          <Link href="/admin/pipeline">Pipeline</Link>
          <Link href="/admin/mfa">Security</Link>
        </>
      }
    >
      {(viewer) => (
        <AdminMfaGate mfa={viewer.mfa}>
          <AdminBody />
        </AdminMfaGate>
      )}
    </DashboardShell>
  );
}

function AdminBody() {
  const metrics = useQuery(api.admin.metrics);
  const audit = useQuery(api.admin.listAuditLog, { limit: 12 });

  if (metrics === undefined) return <p className="dashboard-loading">Loading platform metrics…</p>;

  const statusRows = Object.entries(metrics.signups.byStatus).map(([label, count]) => ({ label, count }));
  const typeRows = Object.entries(metrics.signups.byAccountType).map(([label, count]) => ({ label, count }));
  const regionRows = Object.entries(metrics.signups.byRegion).map(([label, count]) => ({ label, count }));
  const roleRows = Object.entries(metrics.accounts.byRole).map(([label, count]) => ({ label, count }));
  const investorTypeRows = Object.entries(metrics.accounts.byInvestorType).map(([label, count]) => ({
    label,
    count,
  }));

  const hasSignups = metrics.signups.total > 0;

  return (
    <>
      <div className="dashboard-head">
        <div>
          <span>OPERATOR / PLATFORM</span>
          <h1>Platform metrics</h1>
          <p>
            Computed from Convex on every read — not cached, not estimated. Rates show “—” where there
            is no denominator rather than a misleading 0%.
          </p>
        </div>
      </div>

      <OnboardingChecklist
        role="admin"
        signals={{
          hasProfile: true,
          hasIntakeRecord: true,
          hasOrganization: true,
          hasCampaign: false,
          hasMfa: true,
          hasInvestorType: false,
          expressedInterest: false,
        }}
      />

      <div className="stat-grid">
        <StatTile label="Interest signups" value={metrics.signups.total} />
        <StatTile label="Accounts created" value={metrics.accounts.total} />
        <StatTile
          label="Activation rate"
          value={formatRate(metrics.accounts.activationRate)}
          hint="Accounts per interest signup"
        />
        <StatTile
          label="Active in last 28 days"
          value={metrics.accounts.activeLast28Days}
          hint={`${formatRate(metrics.accounts.engagementRate)} of accounts`}
        />
        <StatTile label="New signups (7d)" value={metrics.signups.last7Days} />
        <StatTile label="New signups (30d)" value={metrics.signups.last30Days} />
        <StatTile
          label="Suppression list"
          value={metrics.outreach.suppressionListSize}
          tone={metrics.outreach.suppressionListSize > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Suspended accounts"
          value={metrics.accounts.suspended}
          tone={metrics.accounts.suspended > 0 ? "warning" : "neutral"}
        />
      </div>

      <GuidancePanel id="admin.funnel-semantics" title="How the intake funnel counts">
        <p>
          A record that has reached <code>invited</code> is counted as having passed{" "}
          <code>reviewed</code> too. Counting only the present status would show conversion collapsing
          as records advance, which is the opposite of what is happening.
        </p>
      </GuidancePanel>

      <div className="dashboard-grid">
        <ChartFigure
          title="Signups and accounts, week by week"
          description="New interest submissions against new account registrations, with a 4-week average."
          series={[
            { key: "signups", label: "Signups" },
            { key: "accounts", label: "Accounts" },
            { key: "signupsTrend", label: "Signups (4wk avg)" },
          ]}
          rows={hasSignups ? metrics.weeklySignups : []}
          xKey="label"
          xLabel="Week"
          emptyTitle="No signups yet"
          emptyBody="This chart fills in as interest submissions arrive. It stays empty rather than drawing a flat line at zero."
        >
          <TrendChart
            rows={metrics.weeklySignups}
            xKey="label"
            series={[
              { key: "signups", label: "Signups" },
              { key: "accounts", label: "Accounts" },
              { key: "signupsTrend", label: "Signups (4wk avg)" },
            ]}
          />
        </ChartFigure>

        <ChartFigure
          title="Intake funnel"
          description="Signed up → reviewed → invited → active."
          series={[{ key: "count", label: "Records" }]}
          rows={hasSignups ? metrics.funnel.map((s) => ({ label: s.label, count: s.count })) : []}
          xKey="label"
          xLabel="Stage"
          emptyTitle="Nothing in the pipeline"
          emptyBody="Conversion needs records to divide by."
        >
          <FunnelChart stages={metrics.funnel} />
        </ChartFigure>

        <ChartFigure
          title="Signups by pipeline status"
          description="Where the current intake queue sits."
          series={[{ key: "count", label: "Signups" }]}
          rows={hasSignups ? statusRows : []}
          xKey="label"
          xLabel="Status"
          emptyTitle="No signups yet"
          emptyBody="Nothing has been submitted."
        >
          <BarSeriesChart rows={statusRows} xKey="label" series={[{ key: "count", label: "Signups" }]} height={200} />
        </ChartFigure>

        <ChartFigure
          title="Signups by account type"
          description="Startups, institutions and individuals."
          series={[{ key: "count", label: "Signups" }]}
          rows={hasSignups ? typeRows : []}
          xKey="label"
          xLabel="Type"
          emptyTitle="No signups yet"
          emptyBody="Nothing has been submitted."
        >
          <BarSeriesChart rows={typeRows} xKey="label" series={[{ key: "count", label: "Signups" }]} height={200} />
        </ChartFigure>

        <ChartFigure
          title="Target capital regions"
          description="Where signups are looking for capital."
          series={[{ key: "count", label: "Selections" }]}
          rows={hasSignups ? regionRows : []}
          xKey="label"
          xLabel="Region"
          emptyTitle="No selections yet"
          emptyBody="Regions come from the intake form."
        >
          <BarSeriesChart rows={regionRows} xKey="label" series={[{ key: "count", label: "Selections" }]} height={200} />
        </ChartFigure>

        <ChartFigure
          title="Accounts by role"
          description="Participants, investors and operators."
          series={[{ key: "count", label: "Accounts" }]}
          rows={metrics.accounts.total > 0 ? roleRows : []}
          xKey="label"
          xLabel="Role"
          emptyTitle="No accounts yet"
          emptyBody="Nobody has registered."
        >
          <BarSeriesChart rows={roleRows} xKey="label" series={[{ key: "count", label: "Accounts" }]} height={200} />
        </ChartFigure>

        <ChartFigure
          title="Investors by type"
          description="Which kinds of capital are represented."
          series={[{ key: "count", label: "Accounts" }]}
          rows={investorTypeRows}
          xKey="label"
          xLabel="Investor type"
          emptyTitle="No investor accounts yet"
          emptyBody="Investor types are chosen at sign-up."
        >
          <BarSeriesChart
            rows={investorTypeRows}
            xKey="label"
            series={[{ key: "count", label: "Accounts" }]}
            height={200}
          />
        </ChartFigure>
      </div>

      <h2 className="dashboard-section-heading">Outreach and research</h2>
      <div className="stat-grid">
        <StatTile label="Messages drafted" value={metrics.outreach.totalMessages} />
        <StatTile
          label="Awaiting human approval"
          value={metrics.outreach.awaitingApproval}
          tone={metrics.outreach.awaitingApproval > 0 ? "warning" : "neutral"}
        />
        <StatTile label="Delivered" value={metrics.outreach.sent} />
        <StatTile
          label="Delivery rate"
          value={formatRate(metrics.outreach.deliveryRate)}
          hint="Of attempted sends, excluding drafts"
          tone={
            metrics.outreach.deliveryRate !== null && metrics.outreach.deliveryRate < 0.9
              ? "critical"
              : "good"
          }
        />
        <StatTile label="Research runs" value={metrics.research.totalRuns} />
        <StatTile label="Run success rate" value={formatRate(metrics.research.successRate)} />
        <StatTile
          label="Research spend"
          value={metrics.research.totalSpendUsd === 0 ? "$0" : `$${metrics.research.totalSpendUsd}`}
          hint={`Budget used: ${formatRate(metrics.research.budgetUtilisation)}`}
        />
        <StatTile label="Blocked runs" value={metrics.research.blocked} tone={metrics.research.blocked > 0 ? "warning" : "neutral"} />
      </div>

      <figure className="chart-figure">
        <header>
          <div>
            <h3>Recent operator actions</h3>
            <p>Every privileged change, attributed to the account that made it.</p>
          </div>
        </header>
        {audit === undefined ? (
          <p className="dashboard-loading">Loading…</p>
        ) : audit.length === 0 ? (
          <div className="chart-empty">
            <strong>No operator actions recorded</strong>
            <span>Status changes and account actions appear here as they happen.</span>
          </div>
        ) : (
          <div className="chart-table-wrap">
            <table className="chart-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Action</th>
                  <th scope="col">Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((entry) => (
                  <tr key={entry.id}>
                    <th scope="row">{new Date(entry.createdAt).toLocaleString()}</th>
                    <td>{entry.actorEmail ?? "—"}</td>
                    <td>{entry.action}</td>
                    <td>{entry.targetType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </figure>
    </>
  );
}
