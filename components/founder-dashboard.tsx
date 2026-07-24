import { Check, Circle, X } from "lucide-react";
import { Logo } from "@/components/logo";
import { FounderLogoutButton } from "@/components/founder-logout-button";
import type { MyStatus } from "@/lib/founder-data";

const STATUS_COPY: Record<MyStatus["status"], string> = {
  new: "We've received your information. It's in the queue and hasn't been reviewed by a person yet.",
  reviewing: "A person is actively reviewing your profile right now.",
  invited: "You've been invited to the next step — check the email tied to this account.",
  active: "You're an active participant in FirstContact.",
  declined: "This isn't a fit for FirstContact right now.",
};

const PIPELINE_STEPS: { key: MyStatus["status"]; label: string }[] = [
  { key: "new", label: "Submitted" },
  { key: "reviewing", label: "In review" },
  { key: "invited", label: "Invited" },
  { key: "active", label: "Active" },
];

const STAGE_LABELS: Record<NonNullable<MyStatus["stage"]>, string> = {
  "pre-seed": "Pre-seed",
  seed: "Seed",
  "series-a": "Series A",
  "series-b+": "Series B+",
  growth: "Growth",
  institutional: "Institutional",
};

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function PipelineSteps({ status }: { status: MyStatus["status"] }) {
  if (status === "declined") {
    return (
      <div className="pipeline-steps">
        <div className="pipeline-step declined">
          <i>
            <X size={14} />
          </i>
          <span>Declined</span>
        </div>
      </div>
    );
  }

  const currentIndex = PIPELINE_STEPS.findIndex((step) => step.key === status);

  return (
    <div className="pipeline-steps">
      {PIPELINE_STEPS.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "";
        return (
          <div className={`pipeline-step ${state}`} key={step.key}>
            <i>{state === "done" ? <Check size={13} /> : state === "current" ? index + 1 : <Circle size={8} fill="currentColor" />}</i>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function FounderDashboard({ email, status }: { email: string; status: MyStatus | null }) {
  if (!status) {
    return (
      <div className="status-shell">
        <div className="status-card">
          <span className="status-badge">no record found</span>
          <h1>Nothing here yet</h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            We couldn&apos;t find an interest record tied to {email}. If you believe this is wrong, contact the FirstContact operator.
          </p>
          <FounderLogoutButton />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <Logo />
        <div className="dashboard-header-org">
          <span>SIGNED IN AS {email.toUpperCase()}</span>
          <strong>{status.organizationName || status.name}</strong>
        </div>
        <FounderLogoutButton />
      </header>

      <div className="dashboard-main">
        <div className="dashboard-panel">
          <h2>PIPELINE STATUS</h2>
          <PipelineSteps status={status.status} />
          <p className="dashboard-lead" style={{ marginTop: 24 }}>
            {STATUS_COPY[status.status]}
          </p>
        </div>

        <div className="dashboard-panel">
          <h2>YOUR PROFILE</h2>
          <div className="profile-grid">
            <div className="profile-field">
              <span>CONTACT</span>
              <p>{status.name}</p>
            </div>
            <div className="profile-field">
              <span>ACCOUNT TYPE</span>
              <p>{status.accountType}</p>
            </div>
            {status.organizationName && (
              <div className="profile-field">
                <span>ORGANIZATION</span>
                <p>{status.organizationName}</p>
              </div>
            )}
            {status.website && (
              <div className="profile-field">
                <span>WEBSITE</span>
                <p>
                  <a className="text-link" href={status.website} target="_blank" rel="noreferrer" style={{ padding: 0 }}>
                    {status.website}
                  </a>
                </p>
              </div>
            )}
            <div className="profile-field">
              <span>LOCATION</span>
              <p>{status.location}</p>
            </div>
            {status.stage && (
              <div className="profile-field">
                <span>STAGE</span>
                <p>{STAGE_LABELS[status.stage]}</p>
              </div>
            )}
            {status.individualRole && (
              <div className="profile-field">
                <span>ROLE</span>
                <p>{status.individualRole}</p>
              </div>
            )}
            <div className="profile-field">
              <span>GOALS</span>
              <p>{status.goals.join(", ")}</p>
            </div>
            <div className="profile-field">
              <span>TARGET REGIONS</span>
              <p>{status.targetRegions.length ? status.targetRegions.join(", ") : "—"}</p>
            </div>
            <div className="profile-field full">
              <span>WHAT YOU&apos;RE BUILDING OR LOOKING FOR</span>
              <p>{status.summary}</p>
            </div>
            <div className="profile-field full">
              <span>CONTEXT YOU SHARED</span>
              <p>{status.context}</p>
            </div>
          </div>
        </div>

        <div className="dashboard-panel">
          <h2>RECORD HISTORY</h2>
          <div className="status-row">
            <span>Submitted</span>
            <strong>{dateFormat.format(new Date(status.createdAt))}</strong>
          </div>
          <div className="status-row">
            <span>Last updated</span>
            <strong>{dateFormat.format(new Date(status.updatedAt))}</strong>
          </div>
          <div className="status-row">
            <span>Times submitted</span>
            <strong>{status.submissionCount}</strong>
          </div>
          <div className="status-row">
            <span>Product updates</span>
            <strong>{status.productUpdates ? "Subscribed" : "Not subscribed"}</strong>
          </div>
        </div>

        <div className="dashboard-panel">
          <h2>WHAT&apos;S NOT AVAILABLE YET</h2>
          <p className="dashboard-lead" style={{ marginBottom: 0 }}>
            Investor discovery, matching, drafting, and outreach are not active on this account. Nothing here is a preview or a demo —
            we only show what is real, so this section stays empty until those features are actually turned on for your profile.
          </p>
        </div>
      </div>
    </div>
  );
}
