import { FounderLogoutButton } from "@/components/founder-logout-button";
import type { MyStatus } from "@/lib/founder-data";

const STATUS_COPY: Record<MyStatus["status"], string> = {
  new: "We've received your information. It's in the queue and hasn't been reviewed by a person yet.",
  reviewing: "A person is actively reviewing your profile right now.",
  invited: "You've been invited to the next step — check the email tied to this account.",
  active: "You're an active participant in FirstContact.",
  declined: "This isn't a fit for FirstContact right now.",
};

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function FounderStatusCard({ email, status }: { email: string; status: MyStatus | null }) {
  return (
    <div className="status-shell">
      <div className="status-card">
        <span className="status-badge">{status ? status.status : "no record found"}</span>
        <h1>{status?.organizationName || status?.name || "Your status"}</h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
          {status
            ? STATUS_COPY[status.status]
            : "We couldn't find an interest record tied to this account. If you believe this is wrong, contact the FirstContact operator."}
        </p>

        {status && (
          <div>
            <div className="status-row">
              <span>Contact</span>
              <strong>{status.name}</strong>
            </div>
            <div className="status-row">
              <span>Type</span>
              <strong>{status.accountType}</strong>
            </div>
            <div className="status-row">
              <span>Goals</span>
              <strong>{status.goals.join(", ")}</strong>
            </div>
            <div className="status-row">
              <span>Submitted</span>
              <strong>{dateFormat.format(new Date(status.createdAt))}</strong>
            </div>
            <div className="status-row">
              <span>Last updated</span>
              <strong>{dateFormat.format(new Date(status.updatedAt))}</strong>
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <small style={{ color: "var(--muted)", fontSize: 11 }}>Signed in as {email}</small>
          <FounderLogoutButton />
        </div>
      </div>
    </div>
  );
}
